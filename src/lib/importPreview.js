/**
 * The words the import preview shows, as data rather than JSX.
 *
 * Pure and separate from the card so the exact wording can be asserted in a
 * test. The preview is the only thing standing between a file and the user's
 * ledger, so what it claims has to be checked, and checking strings inside a
 * rendered component is how wording quietly drifts.
 *
 * Every number here comes from the single `planImport` call the caller already
 * made, so the preview and the write cannot disagree.
 */

import { MAX_DESCRIPTION } from './actions.js';

/** Plain-words version of each rejection reason, for a row the user can find. */
const REASONS = {
  not_an_object: 'not a transaction',
  id_wrong_type: 'unreadable id',
  date_required: 'date missing',
  date_invalid: 'date not a real date',
  amount_invalid: 'amount not a number',
  description_wrong_type: 'description missing',
  notes_wrong_type: 'notes unreadable',
  category_wrong_type: 'category missing',
  category_unknown: 'category not found',
};

export const reasonText = (reason) => REASONS[reason] ?? 'cannot be read';

/** "row 12: date missing" — 1-based, because the user counts from one. */
export const invalidLine = ({ index, reason }) => `row ${index + 1}: ${reasonText(reason)}`;

export const INVALID_SHOWN = 10;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * What the dialog should say, as a structure the card renders directly.
 *
 * `state` is one of:
 *   'refused'   — the file or the merged size was rejected; only a Close button
 *   'nothing'   — a merge that would add nothing; only a Close button
 *   'confirm'   — Import / Cancel
 */
export function importPreview(plan) {
  if (!plan) return { state: 'refused', title: 'That file could not be read', lines: [], counts: [], categories: [], closeOnly: true };

  if (plan.ok === false) {
    return {
      state: 'refused',
      title: 'That backup cannot be imported',
      lines: [plan.message],
      counts: [], categories: [], closeOnly: true,
    };
  }

  const counts = [
    `${plural(plan.new, 'new transaction', 'new transactions')}`,
    `${plan.duplicates} already here, skipped`,
    `${plural(plan.conflicts, 'conflict', 'conflicts')} kept as the copy on this device`,
    `${plural(plan.invalid.length, 'row', 'rows')} rejected`,
    `${plural(plan.keptAsIs, 'unusual row', 'unusual rows')} kept exactly as saved`,
  ];

  const lines = [];
  if (plan.mode === 'full') {
    /* Worded to match planImport: in full mode the budgets and settings are
       replaced, but the categories are MERGED (local labels win, missing ones
       are added). Saying "replace" there was a promise the code does not keep. */
    lines.push("This device has no expenses of its own, so the backup's budgets and settings will replace the current ones, and its categories will be added.");
    if (plan.sampleRemoved > 0) lines.push('The sample data will be removed.');
  } else {
    lines.push('Your budgets, theme and name are not changed.');
  }
  /* True because the Your data card keeps an "Undo last import" button for as
     long as this import's log entry exists, which is the rest of the session.
     The toast's Undo closes with the toast; this sentence does not depend on
     it. */
  lines.push('You can undo this from this page until you close TallyAI.');
  if (plan.keptAsIs > 0) {
    lines.push(`Some rows have an amount of zero or less, or a description longer than ${MAX_DESCRIPTION} characters. They are kept exactly as they were saved, not changed.`);
  }

  const invalidLines = plan.invalid.slice(0, INVALID_SHOWN).map(invalidLine);
  const invalidMore = Math.max(0, plan.invalid.length - INVALID_SHOWN);

  if (plan.mode === 'merge' && plan.new === 0 && plan.introducedCategories.length === 0) {
    return {
      state: 'nothing',
      title: 'Nothing new to import',
      lines: [`Every transaction in that backup is already on this device. ${counts[1]}.`],
      counts, categories: [], invalidLines, invalidMore, closeOnly: true,
    };
  }

  return {
    state: 'confirm',
    title: 'Import this backup?',
    lines,
    counts,
    categories: plan.introducedCategories.map((c) => c.label),
    invalidLines,
    invalidMore,
    closeOnly: false,
  };
}

/** Shown when the write itself fails. Storage is the only way it can. */
export const COMMIT_FAILED = 'Import failed: not enough storage space on this device. Nothing was changed.';
export const NOT_A_BACKUP = "That file isn't a TallyAI backup";
