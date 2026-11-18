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

import { toCents } from './money.js';
import { isSampleRow } from './sampleData.js';

/** Bumped only when the envelope's shape changes. An importer refuses a higher one. */
export const SCHEMA_VERSION = 1;
export const BACKUP_FORMAT = 'tallyai-backup';

/** Excel on Windows reads a CSV as a legacy codepage without this. */
export const BOM = '﻿';

export const CSV_COLUMNS = ['id', 'date', 'category_id', 'category_label', 'description', 'amount', 'notes'];

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
export const csvFilename = (now = new Date()) => `tallyai-expenses-${stamp(now)}.csv`;

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

/* ── CSV ───────────────────────────────────────────────────────── */

/**
 * A cell a spreadsheet will treat as text, whatever is in it.
 *
 * Two separate problems, in this order:
 *
 * 1. Formula injection. A description is typed on a phone and opened in Excel
 *    on someone's laptop; `=1+1` or `@SUM(A1)` would be evaluated there, and
 *    the same trick reaches external data and shell functions. A leading
 *    apostrophe makes the cell literal. Tab and CR are included because Excel
 *    strips leading whitespace and can re-expose the character behind it.
 * 2. CSV structure. Commas, quotes and newlines have to be quoted or the row
 *    splits in the wrong places. Descriptions are free text, so they will.
 *
 * The apostrophe goes on BEFORE quoting, so it is inside the quoted field.
 */
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Expenses only, for a spreadsheet.
 *
 * The amount is written from the stored number at two decimals, never
 * reformatted from display text and never re-rounded: the stored value is
 * already snapped to a whole cent on entry, and going through cents here and
 * back would be a second rounding of an already-rounded number.
 *
 * CRLF line endings because that is what Excel expects.
 */
export function buildExpensesCsv(expenses = [], cats = []) {
  const labelOf = new Map(cats.map((c) => [c.id, c.label]));
  const rows = exportableExpenses(expenses).map((e) => [
    e.id,
    e.date,
    e.category,
    labelOf.get(e.category) ?? '',
    e.description,
    (toCents(e.amount) / 100).toFixed(2),
    e.notes ?? '',
  ]);
  return BOM + [CSV_COLUMNS, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

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
