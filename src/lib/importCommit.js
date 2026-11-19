/**
 * Writing an import to storage, atomically enough to be honest about failure.
 *
 * Why this exists at all: today every key is saved by its own effect in
 * `useAppData` (src/hooks/useAppData.js:47-55), and each one throws away the
 * boolean that `save()` returns — while `save()` itself swallows a quota or
 * private-mode failure and returns `false` (src/lib/storage.js:38-44). So a
 * bulk write can half-succeed with nothing noticing: categories on disk,
 * expenses not. For one row at a time that is survivable. For a restore it is
 * not, because the half that landed refers to the half that did not.
 *
 * So an import does not go through those effects. It goes through here, which
 * writes each key in turn, checks every result, and on the first failure puts
 * back what it has already changed before telling the caller.
 *
 * `save` is injected rather than imported so a test can fail on a chosen key.
 * React state is updated by the caller only after this returns ok.
 */

/**
 * Order matters: categories, then budgets, then expenses.
 *
 * Expenses are written last because they refer to categories by id and the
 * budgets are keyed by the same ids. If the write dies halfway, the state left
 * on disk is one where categories exist that nothing points at yet — harmless
 * — rather than rows pointing at categories that were never saved.
 *
 * In full mode the settings and `sampleMark: null` are written too, after the
 * data, since nothing refers to them.
 */
/**
 * Ordered writes with rollback. The shared core of an import and of undoing
 * one, so both get the same guarantee and the same failure report.
 */
async function writeAll(writes, { save, previous = {} }) {
  const done = [];
  for (const [key, value] of writes) {
    let ok = false;
    try {
      ok = await save(key, value);
    } catch {
      ok = false;
    }
    if (ok === false) {
      // Put back only what this call changed, newest first, and do not let a
      // failing rollback write mask which key failed in the first place.
      for (const written of [...done].reverse()) {
        try {
          await save(written, previous[written]);
        } catch { /* nothing better is available; the caller is told anyway */ }
      }
      return { ok: false, failedKey: key, rolledBack: done };
    }
    done.push(key);
  }
  return { ok: true, written: done };
}

/**
 * Order matters: categories, then budgets, then expenses.
 *
 * Expenses are written last because they refer to categories by id and the
 * budgets are keyed by the same ids. If the write dies halfway, the state left
 * on disk is one where categories exist that nothing points at yet — harmless
 * — rather than rows pointing at categories that were never saved.
 *
 * In full mode the settings and `sampleMark: null` are written too, after the
 * data, since nothing refers to them.
 */
export async function commitImport(plan, { save, previous = {} } = {}) {
  if (typeof save !== 'function') throw new TypeError('commitImport needs a save function');
  if (!plan || plan.ok === false || !plan.next) return { ok: false, failedKey: null, reason: 'no_plan' };

  const next = plan.next;
  const writes = [
    ['categories', next.cats],
    ['budgets', next.budgets],
    ['expenses', next.expenses],
  ];
  if (plan.mode === 'full') {
    writes.push(
      ['appName', next.appName],
      ['theme', next.theme],
      ['motion', next.motion],
      ['roastPreferences', next.roastPrefs],
      ['sampleMark', null],
    );
  }
  return writeAll(writes, { save, previous });
}

/**
 * Puts an explicit snapshot back, through the same all-or-nothing path.
 *
 * This is how an import is undone: the log entry holds the previous value of
 * every key the import wrote, including the sample rows and `sampleMark`, and
 * undo writes exactly those keys back. Expenses go first here, the reverse of
 * an import: restoring the old rows before the old categories means there is
 * never a moment where the old rows point at categories already removed.
 */
export async function commitRestore(snapshot, { save, previous = {} } = {}) {
  if (typeof save !== 'function') throw new TypeError('commitRestore needs a save function');
  if (!snapshot || typeof snapshot !== 'object') return { ok: false, failedKey: null, reason: 'no_snapshot' };

  const ORDER = ['expenses', 'budgets', 'categories', 'appName', 'theme', 'motion', 'roastPreferences', 'sampleMark'];
  const writes = ORDER.filter((key) => Object.hasOwn(snapshot, key)).map((key) => [key, snapshot[key]]);
  if (writes.length === 0) return { ok: false, failedKey: null, reason: 'no_snapshot' };
  return writeAll(writes, { save, previous });
}

/**
 * The previous values a rollback needs, in the key names `save` uses.
 * Taken from the same state object the plan was built from, so a caller cannot
 * accidentally roll back to something else.
 */
export function previousValues(current = {}) {
  return {
    categories: current.cats,
    budgets: current.budgets,
    expenses: current.expenses,
    appName: current.appName,
    theme: current.theme,
    motion: current.motion,
    roastPreferences: current.roastPrefs,
    sampleMark: current.sampleMark ?? null,
  };
}

/** The same snapshot as React state, for `applyState` after a restore. */
export function snapshotToState(snapshot = {}) {
  const next = {};
  if (Object.hasOwn(snapshot, 'expenses')) next.expenses = snapshot.expenses;
  if (Object.hasOwn(snapshot, 'categories')) next.cats = snapshot.categories;
  if (Object.hasOwn(snapshot, 'budgets')) next.budgets = snapshot.budgets;
  if (Object.hasOwn(snapshot, 'appName')) next.appName = snapshot.appName;
  if (Object.hasOwn(snapshot, 'theme')) next.theme = snapshot.theme;
  if (Object.hasOwn(snapshot, 'motion')) next.motion = snapshot.motion;
  if (Object.hasOwn(snapshot, 'roastPreferences')) next.roastPrefs = snapshot.roastPreferences;
  if (Object.hasOwn(snapshot, 'sampleMark')) next.sampleMark = snapshot.sampleMark;
  return next;
}
