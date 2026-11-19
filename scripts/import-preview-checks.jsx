import { importPreview, invalidLine, reasonText, COMMIT_FAILED, NOT_A_BACKUP, INVALID_SHOWN } from '../src/lib/importPreview';
import { planImport, parseBackup } from '../src/lib/dataImport';
import { commitImport, commitRestore, previousValues, snapshotToState } from '../src/lib/importCommit';
import { buildBackup } from '../src/lib/dataExport';
import { SAMPLE_PREFIX } from '../src/lib/sampleData';

/**
 * Preview wording and the commit paths behind the two buttons.
 *
 * The wording is asserted exactly. It is the only thing between a file and
 * someone's ledger, so "roughly says the right thing" is not good enough.
 */

const CATS = [
  { id: 'food', label: 'Food & Drinks', color: '#D85A30' },
  { id: 'pub', label: 'Public Transport', color: '#378ADD' },
];
const TODAY = '2026-11-19';
const DEVICE = (over = {}) => ({ expenses: [], cats: CATS, budgets: {}, appName: 'TallyAI', theme: 'forest', motion: 'auto', roastPrefs: {}, sampleMark: null, today: TODAY, ...over });
const row = (over = {}) => ({ id: 'r1', date: '2026-11-02', category: 'food', description: 'Kopi', amount: 1.4, notes: '', ...over });
const envelope = (data) => ({ format: 'tallyai-backup', schemaVersion: 1, app: 'TallyAI', exportedAt: '2026-11-19T00:00:00.000Z', data: { expenses: [], categories: CATS, budgets: { food: 50 }, appName: 'TallyAI', theme: 'forest', motion: 'auto', roastPreferences: {}, ...data } });

function fakeStorage(initial = {}, failOn = null) {
  const store = { ...initial }; const log = [];
  return { store, log, save: async (k, v) => { log.push(k); if (k === failOn) return false; store[k] = v; return true; } };
}

export async function importPreviewChecks(logic) {
  /* ── Full mode ─────────────────────────────────────────────── */
  const full = importPreview(planImport(DEVICE(), envelope({ expenses: [row(), row({ id: 'r2', description: 'Teh' })] })));
  logic('preview full: confirm state', full.state, 'confirm');
  logic('preview full: title', full.title, 'Import this backup?');
  logic('preview full: counts', full.counts, [
    '2 new transactions', '0 already here, skipped', '0 conflicts kept as the copy on this device',
    '0 rows rejected', '0 unusual rows kept exactly as saved',
  ]);
  logic('preview full: the replace sentence, exactly', full.lines[0],
    "This device has no expenses of its own, so the backup's categories, budgets and settings will replace the current ones.");
  logic('preview full: no sample sentence when there is no sample', full.lines.length, 1);
  logic('preview full: Import and Cancel, not Close', full.closeOnly, false);

  /* ── Full mode with sample removal ─────────────────────────── */
  const sampleDevice = DEVICE({
    expenses: [row({ id: `${SAMPLE_PREFIX}1`, description: 'Sample lunch' })],
    sampleMark: { version: 2, rowCount: 1, previousBudgets: { food: 5 }, appliedBudgets: {}, introducedCategories: [] },
  });
  const withSample = importPreview(planImport(sampleDevice, envelope({ expenses: [row()] })));
  logic('preview sample: still full mode', withSample.state, 'confirm');
  logic('preview sample: the sample sentence, exactly', withSample.lines[1], 'The sample data will be removed.');

  /* ── Merge mode ────────────────────────────────────────────── */
  const merge = importPreview(planImport(DEVICE({ expenses: [row({ id: 'own' })] }), envelope({ expenses: [row({ id: 'new1' })] })));
  logic('preview merge: confirm state', merge.state, 'confirm');
  logic('preview merge: the untouched sentence, exactly', merge.lines[0], 'Your budgets, theme and name are not changed.');
  logic('preview merge: one new row is singular', merge.counts[0], '1 new transaction');

  /* ── Nothing new ───────────────────────────────────────────── */
  const nothing = importPreview(planImport(DEVICE({ expenses: [row({ id: 'same' })] }), envelope({ expenses: [row({ id: 'same' })] })));
  logic('preview nothing: state', nothing.state, 'nothing');
  logic('preview nothing: title', nothing.title, 'Nothing new to import');
  logic('preview nothing: Close only', nothing.closeOnly, true);
  logic('preview nothing: explains why', nothing.lines[0],
    'Every transaction in that backup is already on this device. 1 already here, skipped.');

  logic('preview nothing: does not claim to have kept an unusual row',
    importPreview(planImport(DEVICE({ expenses: [row({ id: 'same', amount: 0 })] }), envelope({ expenses: [row({ id: 'same', amount: 0 })] }))).counts[4],
    '0 unusual rows kept exactly as saved');

  /* ── Refused ───────────────────────────────────────────────── */
  const refusedParse = parseBackup(JSON.stringify({ format: 'tallyai-backup', schemaVersion: 2, data: { expenses: [] } }));
  logic('preview refused: a newer backup is refused at the parse step', refusedParse.ok, false);
  const refused = importPreview({ ok: false, message: refusedParse.message });
  logic('preview refused: state', refused.state, 'refused');
  logic('preview refused: title', refused.title, 'That backup cannot be imported');
  logic('preview refused: shows only the message', refused.lines, ['This backup was made by a newer version of TallyAI.']);
  logic('preview refused: Close only, no counts', [refused.closeOnly, refused.counts.length], [true, 0]);
  logic('preview refused: a null plan is handled', importPreview(null).state, 'refused');

  /* ── Rejected-row wording ──────────────────────────────────── */
  logic('preview rejects: 1-based row numbers in plain words',
    invalidLine({ index: 11, reason: 'date_required' }), 'row 12: date missing');
  logic('preview rejects: each reason has plain words',
    ['date_invalid', 'amount_invalid', 'category_unknown', 'description_wrong_type', 'not_an_object'].map(reasonText),
    ['date not a real date', 'amount not a number', 'category not found', 'description missing', 'not a transaction']);
  logic('preview rejects: an unknown reason still reads as English', reasonText('something_new'), 'cannot be read');
  const many = importPreview(planImport(DEVICE(), envelope({ expenses: Array.from({ length: 13 }, (_, i) => row({ id: `b${i}`, amount: NaN })) })));
  logic('preview rejects: at most ten are listed', many.invalidLines.length, INVALID_SHOWN);
  logic('preview rejects: the rest are counted', many.invalidMore, 3);

  /* ── Kept as-is ────────────────────────────────────────────── */
  const kept = importPreview(planImport(DEVICE(), envelope({ expenses: [row({ amount: 0 }), row({ id: 'r2', description: 'x'.repeat(120) })] })));
  logic('preview kept: counted in the list', kept.counts[4], '2 unusual rows kept exactly as saved');
  logic('preview kept: explained, exactly', kept.lines[kept.lines.length - 1],
    'Some rows have an amount of zero or less, or a description longer than 80 characters. They are kept exactly as they were saved, not changed.');

  /* ── Categories to be created ──────────────────────────────── */
  const newCats = importPreview(planImport(DEVICE(), envelope({
    categories: [...CATS, { id: 'bbt', label: 'Bubble Tea', color: '#abc' }],
    expenses: [row({ id: 'b', category: 'bbt' })],
  })));
  logic('preview categories: named by label', newCats.categories, ['Bubble Tea']);

  /* ── Not a backup ──────────────────────────────────────────── */
  const jpegBytes = '\\xFF\\xD8\\xFF\\xE0\\x00\\x10JFIF\\x00\\x01';
  const jpeg = parseBackup(jpegBytes);
  logic('not a backup: JPEG bytes are refused', jpeg.ok, false);
  logic('not a backup: the message is the plain sentence the card shows',
    /not valid JSON|not a TallyAI backup|empty/.test(jpeg.message), true);
  logic('not a backup: the sentence itself', NOT_A_BACKUP, "That file isn't a TallyAI backup");

  /* ── Commit success and failure ────────────────────────────── */
  const device = DEVICE({ expenses: [row({ id: 'own' })], budgets: { food: 10 } });
  const plan = planImport(device, envelope({ expenses: [row({ id: 'fresh' })] }));
  const prev = previousValues(device);

  const okStore = fakeStorage({ ...prev });
  const okRes = await commitImport(plan, { save: okStore.save, previous: prev });
  logic('commit: success writes the planned rows', okRes.ok, true);
  logic('commit: plan.next is what lands', okStore.store.expenses.map((e) => String(e.id)), ['own', 'fresh']);

  const failStore = fakeStorage({ ...prev }, 'expenses');
  const failRes = await commitImport(plan, { save: failStore.save, previous: prev });
  logic('commit failure: reported', [failRes.ok, failRes.failedKey], [false, 'expenses']);
  logic('commit failure: the ledger on disk is untouched', failStore.store.expenses, device.expenses);
  logic('commit failure: categories and budgets are restored',
    [failStore.store.categories, failStore.store.budgets], [prev.categories, prev.budgets]);
  logic('commit failure: the message the card shows', COMMIT_FAILED,
    'Import failed: not enough storage space on this device. Nothing was changed.');

  /* ── A full restore round trip through export ──────────────── */
  const backup = buildBackup({ expenses: [row({ id: 'x1' }), row({ id: 'x2', description: 'Teh' })], cats: CATS, budgets: { food: 99 }, appName: 'TallyAI', theme: 'forest', motion: 'auto', roastPrefs: {} });
  const restore = planImport(DEVICE(), backup);
  logic('restore: budgets come from the backup in full mode', restore.next.budgets, { food: 99 });
  logic('restore: sampleMark is cleared', restore.next.sampleMark, null);
  logic('restore: the preview offers Import', importPreview(restore).closeOnly, false);
}

/**
 * Undoing an import. The log entry holds the previous value of every key the
 * import wrote, and undo writes exactly those back through the same
 * all-or-nothing path — one step, not one per row.
 */
export async function importUndoChecks(logic) {
  const SAMPLE_ROWS = [
    { id: `${SAMPLE_PREFIX}1`, date: '2026-11-01', category: 'food', description: 'Sample lunch', amount: 9.9, notes: '' },
    { id: `${SAMPLE_PREFIX}2`, date: '2026-11-02', category: 'pub', description: 'Sample bus', amount: 1.2, notes: '' },
  ];
  const MARK = { version: 2, loadedAt: '2026-11-01T00:00:00.000Z', todayYmd: '2026-11-01', months: 'November', rowCount: 2, previousBudgets: { food: 7 }, appliedBudgets: { food: 120 }, introducedCategories: [] };
  const before = DEVICE({ expenses: SAMPLE_ROWS, budgets: { food: 120 }, sampleMark: MARK, appName: 'TallyAI', theme: 'forest' });

  const backup = buildBackup({ expenses: [row({ id: 'real1' }), row({ id: 'real2', description: 'Teh' })], cats: CATS, budgets: { food: 300 }, appName: 'Restored', theme: 'forest', motion: 'on', roastPrefs: {} });
  const plan = planImport(before, backup);
  logic('undo: the import was a full restore that removed the sample', [plan.mode, plan.sampleRemoved], ['full', 2]);

  const prev = previousValues(before);
  const store = fakeStorage({ ...prev });
  const res = await commitImport(plan, { save: store.save, previous: prev });
  logic('undo: the import committed', res.ok, true);
  logic('undo: the sample rows are gone after the import', store.store.expenses.map((e) => String(e.id)), ['real1', 'real2']);
  logic('undo: budgets were replaced by the backup', store.store.budgets, { food: 300 });
  logic('undo: sampleMark was cleared', store.store.sampleMark, null);

  // The one log entry the app records: the previous value of every written key.
  const action = { actionId: 'import-1', kind: 'import', previous: Object.fromEntries(res.written.map((k) => [k, prev[k]])) };
  logic('undo: one entry covers every key the import wrote', Object.keys(action.previous).sort(),
    ['appName', 'budgets', 'categories', 'expenses', 'motion', 'roastPreferences', 'sampleMark', 'theme']);

  const undone = await commitRestore(action.previous, { save: store.save, previous: previousValues({ expenses: store.store.expenses, cats: store.store.categories, budgets: store.store.budgets, appName: store.store.appName, theme: store.store.theme, motion: store.store.motion, roastPrefs: store.store.roastPreferences, sampleMark: store.store.sampleMark }) });
  logic('undo: the restore succeeds', undone.ok, true);
  logic('undo: the sample rows are back', store.store.expenses, SAMPLE_ROWS);
  logic('undo: sampleMark is back, so the sample can be removed again', store.store.sampleMark, MARK);
  logic('undo: the old budgets are back', store.store.budgets, { food: 120 });
  logic('undo: the old app name and motion are back', [store.store.appName, store.store.motion], ['TallyAI', 'auto']);
  logic('undo: expenses were written before categories', store.log.slice(-8, -6), ['expenses', 'budgets']);
  logic('undo: it is one step, not one per row', undone.written.length, 8);

  logic('undo: snapshotToState maps storage keys back to state keys',
    Object.keys(snapshotToState(action.previous)).sort(),
    ['appName', 'budgets', 'cats', 'expenses', 'motion', 'roastPrefs', 'sampleMark', 'theme']);

  /* A failed undo changes nothing and says so. */
  const failing = fakeStorage({ ...prev }, 'categories');
  const bad = await commitRestore(action.previous, { save: failing.save, previous: prev });
  logic('undo: a failed restore is reported with its key', [bad.ok, bad.failedKey], [false, 'categories']);
  logic('undo: a failed restore rolls back what it had written',
    [failing.store.expenses, failing.store.budgets], [prev.expenses, prev.budgets]);
  logic('undo: an empty snapshot is refused', (await commitRestore({}, { save: failing.save })).reason, 'no_snapshot');
  logic('undo: a missing snapshot is refused', (await commitRestore(null, { save: failing.save })).reason, 'no_snapshot');
}
