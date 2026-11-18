/**
 * Turning the stored state into files the user can keep, and nothing else.
 *
 * Every function here is pure: it takes state and returns a string or an
 * object. Nothing touches localStorage, the DOM, the clipboard or the network,
 * because the one thing that must never go wrong in a backup feature is the
 * backup silently not matching the data — and a pure function can be compared
 * against the ledger in a test, byte for byte.
 *
 * Export is deliberately one-way. There is no import here; see
 * docs/EXPORT-IMPORT-PLAN.md §R1 for why importing needs a different seam.
 */

import { isSampleRow } from './sampleData.js';

/** Bumped only when the envelope's shape changes. An importer refuses a higher one. */
export const SCHEMA_VERSION = 1;
export const BACKUP_FORMAT = 'tallyai-backup';

/* ── Filenames ─────────────────────────────────────────────────── */

/**
 * Local time, not UTC: a file named with yesterday's date because the user is
 * in Singapore and the clock is in London is a support question waiting to
 * happen. Minutes are included so two exports on one day do not collide.
 */
function stamp(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

export const backupFilename = (now = new Date()) => `tallyai-backup-${stamp(now)}.json`;

/* ── What never leaves ─────────────────────────────────────────── */

/**
 * Sample rows are excluded from both exports.
 *
 * They are real rows in `ww_exp`, so exporting them would not be wrong exactly
 * — but `sampleMark` is excluded too (it describes a sample load on THIS
 * device), and without it the receiving device could never remove them again.
 * A backup that permanently welds demo data into someone's real ledger is
 * worse than a backup that omits it.
 */
export const exportableExpenses = (expenses = []) => expenses.filter((e) => !isSampleRow(e));

/* ── JSON backup ───────────────────────────────────────────────── */

/**
 * The full backup envelope.
 *
 * `roastCache` is omitted because it is a disposable cache, and `sampleMark`
 * because of the note above. Everything else the app persists is included, so
 * restoring onto an empty device gives back the same app, not just the rows.
 */
export function buildBackup(state = {}, { now = new Date() } = {}) {
  const expenses = exportableExpenses(state.expenses);
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    app: 'TallyAI',
    exportedAt: now.toISOString(),
    data: {
      expenses,
      categories: Array.isArray(state.cats) ? state.cats : [],
      budgets: state.budgets && typeof state.budgets === 'object' ? state.budgets : {},
      appName: typeof state.appName === 'string' ? state.appName : 'TallyAI',
      theme: typeof state.theme === 'string' ? state.theme : '',
      motion: state.motion === 'on' || state.motion === 'auto' ? state.motion : 'auto',
      roastPreferences: state.roastPrefs && typeof state.roastPrefs === 'object' ? state.roastPrefs : {},
    },
  };
}

export const backupJson = (state, opts) => JSON.stringify(buildBackup(state, opts), null, 2);

/* ── How the file reaches the user ─────────────────────────────── */

/**
 * Which delivery to attempt, decided from capabilities rather than from a
 * user-agent string.
 *
 * An object-URL download is the normal path and works in a browser tab. In a
 * home-screen web app there is no browser chrome and historically that
 * download either opened the JSON as text or did nothing at all, so there the
 * share sheet is tried first and a copyable text box is the floor. The caller
 * must never claim the file was saved: only the OS knows that.
 */
export function deliveryMethod({ standalone = false, canShareFiles = false } = {}) {
  if (!standalone) return 'download';
  return canShareFiles ? 'share' : 'text';
}
