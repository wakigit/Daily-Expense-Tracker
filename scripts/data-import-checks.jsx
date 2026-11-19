import { parseBackup, planImport, mergeCategories, normaliseSettings, MAX_ROWS, MAX_STATE_BYTES } from '../src/lib/dataImport';
import { buildBackup } from '../src/lib/dataExport';
import { toCents } from '../src/lib/money';
import { SAMPLE_PREFIX } from '../src/lib/sampleData';

/**
 * Import checks. Fictional data only, invented here.
 *
 * The planner is pure, so every case is "given this device and this file, what
 * would happen" — asserted on the counts AND on the next state, because a
 * preview that says "3 new" while writing 4 rows is the exact failure these
 * guard against.
 */

const CATS = [
  { id: 'food', label: 'Food & Drinks', color: '#D85A30' },
  { id: 'pub', label: 'Public Transport', color: '#378ADD' },
];
const TODAY = '2026-11-18';
const DEVICE = (over = {}) => ({ expenses: [], cats: CATS, budgets: {}, sampleMark: null, today: TODAY, ...over });

const row = (over = {}) => ({ id: 'r1', date: '2026-11-02', category: 'food', description: 'Kopi', amount: 1.4, notes: '', ...over });

const envelope = (data) => ({ format: 'tallyai-backup', schemaVersion: 1, app: 'TallyAI', exportedAt: '2026-11-18T00:00:00.000Z', data: { expenses: [], categories: CATS, budgets: {}, appName: 'TallyAI', theme: 'forest', motion: 'auto', roastPreferences: {}, ...data } });

export function dataImportChecks(logic) {
  /* ── parseBackup: malformed input ──────────────────────────── */
  const bad = (name, text, wantFragment) => {
    const r = parseBackup(text);
    logic(`parse: ${name} is refused`, r.ok, false);
    logic(`parse: ${name} explains itself`, (r.message ?? '').includes(wantFragment), true);
  };
  bad('an empty string', '', 'empty');
  bad('whitespace only', '   \n ', 'empty');
  bad('a non-string', 12, 'empty');
  bad('text that is not JSON', 'hello {', 'not valid JSON');
  bad('a JSON array', '[1,2,3]', 'not a TallyAI backup');
  bad('a JSON string', '"hello"', 'not a TallyAI backup');
  bad('an object with no envelope', '{"a":1}', 'not a TallyAI backup');
  bad('the wrong format name', JSON.stringify({ format: 'other', schemaVersion: 1 }), 'not a TallyAI backup');
  bad('a missing schemaVersion', JSON.stringify({ format: 'tallyai-backup' }), 'which version');
  bad('no data block', JSON.stringify({ format: 'tallyai-backup', schemaVersion: 1 }), 'no data in it');
  bad('expenses not an array', JSON.stringify(envelope({ expenses: { a: 1 } })), 'no list of transactions');

  const newer = parseBackup(JSON.stringify({ format: 'tallyai-backup', schemaVersion: 2, data: { expenses: [] } }));
  logic('parse: schemaVersion 2 is refused', newer.ok, false);
  logic('parse: schemaVersion 2 names the newer version, exactly',
    newer.message, 'This backup was made by a newer version of TallyAI.');

  logic('parse: a valid envelope is accepted', parseBackup(JSON.stringify(envelope({ expenses: [row()] }))).ok, true);

  /* ── Size and row guards ───────────────────────────────────── */
  const big = `{"format":"tallyai-backup","schemaVersion":1,"pad":"${'x'.repeat(6 * 1024 * 1024)}"}`;
  const bigResult = parseBackup(big);
  logic('parse: a 6 MB file is refused', bigResult.ok, false);
  logic('parse: the 6 MB refusal names the limit', bigResult.message.includes('5.0 MB'), true);
  logic('parse: the 6 MB file is refused BEFORE parsing (no envelope error)',
    bigResult.message.includes('too large'), true);
  // Bytes, not characters: 3-byte characters trip the limit at a third the length.
  const multibyte = `{"format":"tallyai-backup","schemaVersion":1,"pad":"${'鸡'.repeat(2 * 1024 * 1024)}"}`;
  logic('parse: the limit counts bytes, not characters', parseBackup(multibyte).ok, false);

  const tooMany = parseBackup(JSON.stringify(envelope({ expenses: Array.from({ length: MAX_ROWS + 1 }, (_, i) => row({ id: `r${i}` })) })));
  logic('parse: 20,001 rows is refused', tooMany.ok, false);
  logic('parse: the row refusal states the count', tooMany.message.includes('20,001'), true);
  logic('parse: exactly 20,000 rows is allowed',
    parseBackup(JSON.stringify(envelope({ expenses: Array.from({ length: MAX_ROWS }, (_, i) => row({ id: `r${i}` })) }))).ok, true);

  /* ── Round trip ────────────────────────────────────────────── */
  const ledger = [
    row({ id: 'e-1', amount: 4.8, description: 'Kopi and toast' }),
    row({ id: 17, category: 'pub', amount: 12, description: 'MRT top up', notes: 'legacy' }),
  ];
  const exported = buildBackup({ expenses: ledger, cats: CATS, budgets: { food: 200 }, appName: 'TallyAI', theme: 'forest', motion: 'auto', roastPrefs: { enabled: true, name: '', singapore: true, smu: true } });
  const trip = planImport(DEVICE(), exported);
  logic('round trip: mode is full on an empty device', trip.mode, 'full');
  logic('round trip: every row is new', [trip.new, trip.duplicates, trip.conflicts, trip.invalid.length], [2, 0, 0, 0]);
  logic('round trip: rows come back with the same ids', trip.next.expenses.map((e) => String(e.id)), ['e-1', '17']);
  logic('round trip: amounts are identical in cents',
    trip.next.expenses.map((e) => toCents(e.amount)), ledger.map((e) => toCents(e.amount)));
  logic('round trip: descriptions and notes survive',
    trip.next.expenses.map((e) => [e.description, e.notes]), [['Kopi and toast', ''], ['MRT top up', 'legacy']]);
  logic('round trip: budgets are restored in full mode', trip.next.budgets, { food: 200 });
  logic('round trip: settings are restored in full mode', [trip.next.appName, trip.next.theme, trip.next.motion], ['TallyAI', 'forest', 'auto']);
  logic('round trip: settingsChanged is true in full mode', trip.settingsChanged, true);
  logic('round trip: a row keeps only the six known fields',
    Object.keys(trip.next.expenses[0]).sort(), ['amount', 'category', 'date', 'description', 'id', 'notes']);

  /* ── Re-import adds nothing ────────────────────────────────── */
  const device2 = DEVICE({ expenses: trip.next.expenses });
  const again = planImport(device2, exported);
  logic('re-import: nothing new', [again.new, again.duplicates, again.conflicts], [0, 2, 0]);
  logic('re-import: mode is merge once the device has rows', again.mode, 'merge');
  logic('re-import: the ledger is unchanged', again.next.expenses, device2.expenses);

  /* ── A pre-5-October ledger survives a round trip untouched ── */

  /* Shaped like data the app stored before the action layer (b6d72d6):
     numeric Date.now() ids, an unbounded untrimmed description, an amount
     parseFloat left at three decimals, a zero amount the min="0" input
     allowed, and notes with a newline. None of it would pass today's Add-form
     rules, and all of it is in real ledgers. */
  const LEGACY = [
    { id: 1759636800000, date: '2026-10-05', category: 'food', description: 'x'.repeat(120), amount: 4.567, notes: '' },
    { id: 1759636800001, date: '2026-10-06', category: 'food', description: '  Kopi   and    toast  ', amount: 2.5, notes: 'line one\nline two' },
    { id: 1759636800002, date: '2026-10-07', category: 'pub', description: 'Free ride', amount: 0, notes: '' },
    { id: 1759636800003, date: '2026-10-08', category: 'food', description: 'Kopi', amount: 1.4, notes: '' },
  ];
  const legacyBackup = buildBackup({ expenses: LEGACY, cats: CATS, budgets: { food: 150 }, appName: 'TallyAI', theme: 'forest', motion: 'auto', roastPrefs: {} });
  const legacyIn = planImport(DEVICE(), legacyBackup);
  logic('legacy: nothing is rejected', [legacyIn.invalid.length, legacyIn.new], [0, 4]);
  logic('legacy: every row is stored byte-identical to the export', legacyIn.next.expenses, LEGACY);
  logic('legacy: the 120-character description is not truncated',
    legacyIn.next.expenses[0].description.length, 120);
  logic('legacy: the untrimmed description keeps its spacing',
    legacyIn.next.expenses[1].description, '  Kopi   and    toast  ');
  logic('legacy: 4.567 is not snapped to a cent', legacyIn.next.expenses[0].amount, 4.567);
  logic('legacy: amount 0 survives', legacyIn.next.expenses[2].amount, 0);
  logic('legacy: the newline in notes survives', legacyIn.next.expenses[1].notes, 'line one\nline two');
  logic('legacy: numeric ids stay numeric', legacyIn.next.expenses.map((e) => typeof e.id), ['number', 'number', 'number', 'number']);
  logic('legacy: two rows are flagged as kept as-is', legacyIn.keptAsIs, 2);

  /* The failure this fix exists for: re-importing a backup onto the device it
     came from must report duplicates, never conflicts. */
  const legacyAgain = planImport(DEVICE({ expenses: legacyIn.next.expenses }), legacyBackup);
  logic('legacy: re-import on the same device adds nothing',
    [legacyAgain.new, legacyAgain.duplicates, legacyAgain.conflicts], [0, 4, 0]);
  logic('legacy: re-import leaves the ledger identical', legacyAgain.next.expenses, LEGACY);
  logic('legacy: re-import rejects nothing', legacyAgain.invalid.length, 0);

  /* ── Duplicates, conflicts, real repeats ───────────────────── */
  const twoKopis = planImport(DEVICE(), envelope({ expenses: [
    row({ id: 'k1', amount: 1.4, description: 'Kopi' }),
    row({ id: 'k2', amount: 1.4, description: 'Kopi' }),
  ] }));
  logic('duplicates: two identical kopis with different ids both survive', twoKopis.new, 2);
  logic('duplicates: and neither is called a duplicate', [twoKopis.duplicates, twoKopis.conflicts], [0, 0]);

  const conflict = planImport(
    DEVICE({ expenses: [row({ id: 'c1', amount: 9.99, description: 'Local version' })] }),
    envelope({ expenses: [row({ id: 'c1', amount: 1.4, description: 'File version' })] }),
  );
  logic('conflict: counted as a conflict, not a duplicate', [conflict.conflicts, conflict.duplicates, conflict.new], [1, 0, 0]);
  logic('conflict: the local row wins', conflict.next.expenses.map((e) => e.description), ['Local version']);

  const numeric = planImport(
    DEVICE({ expenses: [row({ id: '17' })] }),
    envelope({ expenses: [row({ id: 17 })] }),
  );
  logic('duplicates: numeric 17 matches string "17"', [numeric.duplicates, numeric.new], [1, 0]);

  const noId = planImport(DEVICE(), envelope({ expenses: [row({ id: undefined })] }));
  logic('ids: a row with no id is imported with a fresh one', noId.new, 1);
  logic('ids: the fresh id is a string', typeof noId.next.expenses[0].id, 'string');

  /* ── Categories ────────────────────────────────────────────── */
  const unknownCat = planImport(DEVICE(), envelope({
    categories: [...CATS, { id: 'bbt', label: 'Bubble Tea', color: '#abc' }],
    expenses: [row({ id: 'b1', category: 'bbt', description: 'Koi' })],
  }));
  logic('categories: a missing category is created', unknownCat.introducedCategories.map((c) => c.id), ['bbt']);
  logic('categories: the row lands in it, not in cats[0]',
    unknownCat.next.expenses.map((e) => e.category), ['bbt']);
  logic('categories: the created category is in the next state',
    unknownCat.next.cats.map((c) => c.id), ['food', 'pub', 'bbt']);

  const relabel = planImport(
    DEVICE({ cats: [{ id: 'food', label: 'Makan', color: '#D85A30' }] }),
    envelope({ categories: [{ id: 'food', label: 'Food & Drinks', color: '#000' }], expenses: [row({ id: 'm1' })] }),
  );
  logic('categories: same id, different label keeps the LOCAL label',
    relabel.next.cats.map((c) => c.label), ['Makan']);
  logic('categories: nothing is introduced when the id already exists', relabel.introducedCategories.length, 0);

  logic('categories: a row naming a category in neither place is rejected',
    planImport(DEVICE(), envelope({ expenses: [row({ id: 'x', category: 'ghost' })] })).invalid.map((i) => i.reason),
    ['category_unknown']);
  logic('categories: a row with no category is rejected, never defaulted to cats[0]',
    planImport(DEVICE(), envelope({ expenses: [row({ id: 'x', category: undefined })] })).invalid.map((i) => i.reason),
    ['category_wrong_type']);

  logic('mergeCategories: ignores junk entries',
    mergeCategories(CATS, [null, 'nope', { label: 'no id' }]).categories.length, 2);

  /* ── Rows the app could already be storing: kept, never rewritten ── */
  for (const [name, over] of [
    ['a 120-character description', { description: 'x'.repeat(120) }],
    ['leading, trailing and doubled spaces', { description: '  Kopi   and    toast  ' }],
    ['three decimal places', { amount: 4.567 }],
    ['amount 0', { amount: 0 }],
    ['a negative amount', { amount: -5 }],
    ['an amount above the form cap', { amount: 1e9 }],
    ['notes with a newline', { notes: 'line one\nline two' }],
    ['an empty description', { description: '' }],
  ]) {
    const p = planImport(DEVICE(), envelope({ expenses: [row({ id: 'legacy', ...over })] }));
    logic(`stored row: ${name} is accepted`, [p.new, p.invalid.length], [1, 0]);
    logic(`stored row: ${name} is kept byte-identical`,
      p.next.expenses[0], { id: 'legacy', ...row({ id: 'legacy', ...over }), ...over });
  }

  logic('stored row: a missing notes field becomes an empty string',
    planImport(DEVICE(), envelope({ expenses: [{ id: 'n', date: '2026-11-02', category: 'food', description: 'Kopi', amount: 1 }] })).next.expenses[0].notes, '');

  /* ── "Kept as-is" count ───────────────────────────────────── */
  logic('keptAsIs: a normal row is not counted', planImport(DEVICE(), envelope({ expenses: [row()] })).keptAsIs, 0);
  logic('keptAsIs: amount 0 is counted', planImport(DEVICE(), envelope({ expenses: [row({ amount: 0 })] })).keptAsIs, 1);
  logic('keptAsIs: a negative amount is counted', planImport(DEVICE(), envelope({ expenses: [row({ amount: -1 })] })).keptAsIs, 1);
  logic('keptAsIs: a description over 80 characters is counted',
    planImport(DEVICE(), envelope({ expenses: [row({ description: 'x'.repeat(81) })] })).keptAsIs, 1);
  logic('keptAsIs: exactly 80 characters is not counted',
    planImport(DEVICE(), envelope({ expenses: [row({ description: 'x'.repeat(80) })] })).keptAsIs, 0);
  logic('keptAsIs: three decimals alone is not counted', planImport(DEVICE(), envelope({ expenses: [row({ amount: 4.567 })] })).keptAsIs, 0);
  logic('keptAsIs: counts rows, not reasons',
    planImport(DEVICE(), envelope({ expenses: [row({ id: 'a', amount: 0, description: 'y'.repeat(100) })] })).keptAsIs, 1);
  logic('keptAsIs: a skipped duplicate is NOT counted',
    planImport(DEVICE({ expenses: [row({ id: 'z', amount: 0 })] }), envelope({ expenses: [row({ id: 'z', amount: 0 })] })).keptAsIs, 0);
  logic('keptAsIs: a conflict is NOT counted',
    planImport(DEVICE({ expenses: [row({ id: 'z', amount: 5 })] }), envelope({ expenses: [row({ id: 'z', amount: 0 })] })).keptAsIs, 0);
  logic('keptAsIs: a rejected row is NOT counted',
    planImport(DEVICE(), envelope({ expenses: [row({ id: 'z', amount: 0, date: 'nope' })] })).keptAsIs, 0);
  logic('keptAsIs: only the added row of a mixed file is counted',
    planImport(DEVICE({ expenses: [row({ id: 'have', amount: 0 })] }),
      envelope({ expenses: [row({ id: 'have', amount: 0 }), row({ id: 'fresh', amount: 0 })] })).keptAsIs, 1);
  logic('keptAsIs: a kept-as-is row is still a new row',
    planImport(DEVICE(), envelope({ expenses: [row({ amount: 0 })] })).new, 1);

  /* ── Rows that genuinely cannot be stored ─────────────────── */
  for (const [name, bad2, reason] of [
    ['a missing date', { date: undefined }, 'date_required'],
    ['an empty date', { date: '   ' }, 'date_required'],
    ['2026-02-31', { date: '2026-02-31' }, 'date_invalid'],
    ['a non-date string', { date: 'yesterday' }, 'date_invalid'],
    ['a date with surrounding spaces', { date: ' 2026-11-02 ' }, 'date_invalid'],
    ['a numeric date', { date: 20261102 }, 'date_required'],
    ['amount NaN', { amount: NaN }, 'amount_invalid'],
    ['amount Infinity', { amount: Infinity }, 'amount_invalid'],
    ['a string amount', { amount: '12.30' }, 'amount_invalid'],
    ['a null amount', { amount: null }, 'amount_invalid'],
    ['a missing description', { description: undefined }, 'description_wrong_type'],
    ['a numeric description', { description: 5 }, 'description_wrong_type'],
    ['numeric notes', { notes: 5 }, 'notes_wrong_type'],
    ['an object id', { id: { a: 1 } }, 'id_wrong_type'],
    ['an unmatchable category', { category: 'ghost' }, 'category_unknown'],
    ['a missing category', { category: undefined }, 'category_wrong_type'],
  ]) {
    const p = planImport(DEVICE(), envelope({ expenses: [row({ id: 'bad', ...bad2 })] }));
    logic(`unusable: ${name} is rejected`, p.invalid.map((i) => i.reason), [reason]);
    logic(`unusable: ${name} writes nothing`, p.next.expenses.length, 0);
  }
  logic('unusable: a non-object row is rejected',
    planImport(DEVICE(), envelope({ expenses: [null, 'x', 5] })).invalid.map((i) => i.reason),
    ['not_an_object', 'not_an_object', 'not_an_object']);
  logic('unusable: good rows import alongside bad ones',
    (() => { const p = planImport(DEVICE(), envelope({ expenses: [row({ id: 'ok' }), row({ id: 'no', amount: NaN })] })); return [p.new, p.invalid.length]; })(),
    [1, 1]);
  logic('unusable: a rejected row reports its index',
    planImport(DEVICE(), envelope({ expenses: [row({ id: 'ok' }), row({ id: 'no', amount: NaN })] })).invalid[0].index, 1);

  /* ── Prototype pollution and unknown keys ──────────────────── */
  const dirty = JSON.parse('{"id":"p1","date":"2026-11-02","category":"food","description":"Kopi","amount":1.4,"notes":"","__proto__":{"polluted":true},"constructor":"x","extra":"y"}');
  const clean = planImport(DEVICE(), envelope({ expenses: [dirty] }));
  logic('pollution: the stored row has only the six fields',
    Object.keys(clean.next.expenses[0]).sort(), ['amount', 'category', 'date', 'description', 'id', 'notes']);
  logic('pollution: no extra key survives', 'extra' in clean.next.expenses[0], false);
  logic('pollution: Object.prototype is untouched', ({}).polluted, undefined);

  /* ── Mode selection and R2 ─────────────────────────────────── */
  logic('mode: empty device is full', planImport(DEVICE(), envelope({ expenses: [row()] })).mode, 'full');
  logic('mode: a device with its own rows is merge',
    planImport(DEVICE({ expenses: [row({ id: 'own' })] }), envelope({ expenses: [row({ id: 'f' })] })).mode, 'merge');
  const sampleRow = row({ id: `${SAMPLE_PREFIX}1`, description: 'Sample lunch' });
  const sampleDevice = DEVICE({ expenses: [sampleRow], sampleMark: { version: 2, rowCount: 1, previousBudgets: {}, appliedBudgets: {}, introducedCategories: [] } });
  const r2 = planImport(sampleDevice, envelope({ expenses: [row({ id: 'real' })] }));
  logic('R2: a sample-only device still counts as empty', r2.mode, 'full');
  logic('R2: the sample rows are removed and reported', r2.sampleRemoved, 1);
  logic('R2: no sample row survives', r2.next.expenses.map((e) => String(e.id)), ['real']);
  logic('R2: sampleMark is cleared', r2.next.sampleMark, null);
  logic('merge mode: budgets and settings are left alone',
    (() => { const p = planImport(DEVICE({ expenses: [row({ id: 'own' })], budgets: { food: 10 } }), envelope({ budgets: { food: 999 }, appName: 'Other', expenses: [] })); return [p.next.budgets, p.next.appName, p.settingsChanged]; })(),
    [{ food: 10 }, undefined, false]);

  /* ── Settings normalisation ────────────────────────────────── */
  logic('settings: the legacy app name is rewritten', normaliseSettings({ appName: 'Expense Tracker' }).appName, 'TallyAI');
  logic('settings: a removed theme falls back', normaliseSettings({ theme: 'pinkbow' }).theme !== 'pinkbow', true);
  logic('settings: a junk motion value falls back to auto', normaliseSettings({ motion: 'wobble' }).motion, 'auto');
  logic('settings: roast preferences are normalised to the known keys',
    Object.keys(normaliseSettings({ roastPreferences: { enabled: false, junk: 1 } }).roastPrefs).sort(),
    ['enabled', 'name', 'singapore', 'smu']);

  /* ── Size of the merged result ─────────────────────────────── */
  logic('size: a normal import reports a small estimate', planImport(DEVICE(), envelope({ expenses: [row()] })).estimatedBytes < 5000, true);
  // Legal rows, or they would all be rejected as too long and nothing would be measured.
  const fat = Array.from({ length: 20_000 }, (_, i) => row({ id: `f${i}`, description: 'x'.repeat(80), notes: 'y'.repeat(80) }));
  const fatPlan = planImport(DEVICE(), envelope({ expenses: fat }));
  logic('size: a merged result over the limit is refused', fatPlan.ok, false);
  logic('size: the refusal names both figures and says nothing changed',
    fatPlan.message.includes('4.0 MB') && fatPlan.message.includes('Nothing has been changed'), true);
  logic('size: a refused plan carries no next state', fatPlan.next, null);
  logic('size: a refused plan still reports its counts', fatPlan.new > 0, true);
  logic('size: the limit constant is 4 MB', MAX_STATE_BYTES, 4 * 1024 * 1024);
}
