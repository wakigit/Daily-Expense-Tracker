import { commitImport, previousValues } from '../src/lib/importCommit';
import { planImport } from '../src/lib/dataImport';

/**
 * R1 checks: the write is all-or-nothing, and a failure says which key failed
 * and leaves the earlier keys as they were.
 *
 * The fake storage is the point. Real `save()` swallows failure and returns
 * false, so the only way to prove the rollback is to inject a storage that
 * fails on a chosen key and then read back what it holds.
 */

const CATS = [{ id: 'food', label: 'Food & Drinks', color: '#D85A30' }];
const OLD_ROWS = [{ id: 'old', date: '2026-11-01', category: 'food', description: 'Old row', amount: 2, notes: '' }];
const TODAY = '2026-11-18';

const envelope = (data) => ({
  format: 'tallyai-backup', schemaVersion: 1, app: 'TallyAI', exportedAt: '2026-11-18T00:00:00.000Z',
  data: { expenses: [], categories: CATS, budgets: { food: 50 }, appName: 'TallyAI', theme: 'forest', motion: 'auto', roastPreferences: {}, ...data },
});
const row = (over = {}) => ({ id: 'r1', date: '2026-11-02', category: 'food', description: 'Kopi', amount: 1.4, notes: '', ...over });

/** Records every write in order, and fails on one chosen key. */
function fakeStorage(initial = {}, failOn = null) {
  const store = { ...initial };
  const log = [];
  return {
    store, log,
    save: async (key, value) => {
      log.push(key);
      if (key === failOn) return false;
      store[key] = value;
      return true;
    },
  };
}

export async function importCommitChecks(logic) {
  const current = { expenses: OLD_ROWS, cats: CATS, budgets: { food: 10 }, appName: 'TallyAI', theme: 'forest', motion: 'auto', roastPrefs: { enabled: true, name: '', singapore: true, smu: true }, sampleMark: null, today: TODAY };
  const prev = previousValues(current);
  const mergePlan = planImport(current, envelope({ expenses: [row()] }));

  /* ── Happy path, merge ────────────────────────────────────── */
  const fs = fakeStorage({ ...prev });
  const res = await commitImport(mergePlan, { save: fs.save, previous: prev });
  logic('commit: succeeds', res.ok, true);
  logic('commit: write order is categories, budgets, expenses', fs.log, ['categories', 'budgets', 'expenses']);
  logic('commit: merge mode writes no settings', fs.log.includes('appName'), false);
  logic('commit: the new row is on disk', fs.store.expenses.map((e) => String(e.id)), ['old', 'r1']);
  logic('commit: budgets were not replaced in merge mode', fs.store.budgets, { food: 10 });
  logic('commit: it reports which keys it wrote', res.written, ['categories', 'budgets', 'expenses']);

  /* ── Happy path, full ─────────────────────────────────────── */
  const emptyDevice = { expenses: [], cats: CATS, budgets: {}, appName: 'TallyAI', theme: 'forest', motion: 'auto', roastPrefs: {}, sampleMark: null, today: TODAY };
  const fullPlan = planImport(emptyDevice, envelope({ expenses: [row()] }));
  const fs2 = fakeStorage(previousValues(emptyDevice));
  const res2 = await commitImport(fullPlan, { save: fs2.save, previous: previousValues(emptyDevice) });
  logic('commit: full mode succeeds', res2.ok, true);
  logic('commit: full mode writes data first, then settings, then sampleMark', fs2.log,
    ['categories', 'budgets', 'expenses', 'appName', 'theme', 'motion', 'roastPreferences', 'sampleMark']);
  logic('commit: full mode restores the backup budgets', fs2.store.budgets, { food: 50 });
  logic('commit: full mode clears sampleMark', fs2.store.sampleMark, null);

  /* ── Failure on expenses rolls the earlier keys back ──────── */
  const fs3 = fakeStorage({ ...prev }, 'expenses');
  const res3 = await commitImport(mergePlan, { save: fs3.save, previous: prev });
  logic('rollback: reports failure', res3.ok, false);
  logic('rollback: names the key that failed', res3.failedKey, 'expenses');
  logic('rollback: lists what it had already written', [...res3.rolledBack].sort(), ['budgets', 'categories']);
  logic('rollback: categories are back to their old value', fs3.store.categories, prev.categories);
  logic('rollback: budgets are back to their old value', fs3.store.budgets, prev.budgets);
  logic('rollback: expenses on disk are untouched', fs3.store.expenses, OLD_ROWS);
  logic('rollback: it re-wrote exactly the two keys it had changed, newest first', fs3.log,
    ['categories', 'budgets', 'expenses', 'budgets', 'categories']);

  /* ── Failure on the FIRST key changes nothing ─────────────── */
  const fs4 = fakeStorage({ ...prev }, 'categories');
  const res4 = await commitImport(mergePlan, { save: fs4.save, previous: prev });
  logic('rollback: first-key failure is reported', [res4.ok, res4.failedKey], [false, 'categories']);
  logic('rollback: first-key failure rolls nothing back', res4.rolledBack, []);
  logic('rollback: first-key failure writes nothing at all', fs4.log, ['categories']);
  logic('rollback: the store is exactly as it started',
    [fs4.store.categories, fs4.store.budgets, fs4.store.expenses],
    [prev.categories, prev.budgets, prev.expenses]);

  /* ── A save that throws counts as a failure ───────────────── */
  const thrower = { log: [], save: async (key) => { thrower.log.push(key); if (key === 'budgets') throw new Error('quota'); return true; } };
  const res5 = await commitImport(mergePlan, { save: thrower.save, previous: prev });
  logic('rollback: a thrown save is a failure, not a crash', [res5.ok, res5.failedKey], [false, 'budgets']);

  /* ── Refusals ─────────────────────────────────────────────── */
  const fs6 = fakeStorage({ ...prev });
  const res6 = await commitImport({ ok: false, message: 'too big', next: null }, { save: fs6.save, previous: prev });
  logic('commit: a refused plan is never written', [res6.ok, res6.reason], [false, 'no_plan']);
  logic('commit: a refused plan touches storage not at all', fs6.log, []);
  const res7 = await commitImport(null, { save: fs6.save, previous: prev });
  logic('commit: a null plan is refused', res7.ok, false);

  // commitImport is async, so a missing save surfaces as a rejection.
  const rejected = await commitImport(mergePlan, {}).then(() => false, (err) => err instanceof TypeError);
  logic('commit: a missing save function rejects, rather than silently doing nothing', rejected, true);
}
