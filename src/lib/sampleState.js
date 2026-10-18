/**
 * Loading and removing the sample dataset without losing anything.
 *
 * The rule is that removal is the exact inverse of loading. Two things make
 * that possible:
 *
 * 1. Every sample row carries a `sample-` id, so the rows it added can be
 *    told apart from rows a person typed.
 * 2. Loading records the budgets it replaced. Budgets have no ids to mark, so
 *    the only honest way to take them back is to remember what was there.
 *
 * Nothing here touches storage; it computes the next state and hands it back.
 * The view decides whether to ask first.
 */

import { buildSample, isSampleRow } from './sampleData';

/** Shape of the receipt kept while sample data is loaded. */
export const emptyMark = () => null;

/**
 * Is sample data currently in the store?
 * Asked of the rows themselves rather than of a flag, so a cleared flag or a
 * stale mark can never make the app claim a clean store that is not clean.
 */
export const hasSampleRows = (expenses = []) => expenses.some(isSampleRow);

/** Rows a person entered. The ones removal must never touch. */
export const ownRows = (expenses = []) => expenses.filter((e) => !isSampleRow(e));

/** Rows the sample added. */
export const sampleRows = (expenses = []) => expenses.filter(isSampleRow);

/**
 * Plan a load.
 *
 * `budgets` is replaced wholesale rather than merged, because a half-sample
 * budget set would show figures that belong to neither dataset. What it
 * replaced travels in the mark so removal can put it back exactly.
 *
 * @returns {{expenses, budgets, mark, replacedBudgets: boolean, keptRows: number}}
 */
export function planLoad({ expenses = [], budgets = {}, todayYmd }) {
  const sample = buildSample(todayYmd);
  const kept = ownRows(expenses);          // drops any previous sample rows
  const hadBudgets = Object.keys(budgets).length > 0;

  return {
    expenses: [...kept, ...sample.expenses],
    budgets: sample.budgets,
    mark: {
      loadedAt: new Date().toISOString(),
      todayYmd,
      months: sample.months,
      rowCount: sample.expenses.length,
      previousBudgets: { ...budgets },
      appliedBudgets: { ...sample.budgets },
    },
    replacedBudgets: hadBudgets,
    keptRows: kept.length,
  };
}

/**
 * Plan a removal.
 *
 * Restore unchanged sample budgets, preserving later edits, additions and
 * deletions. Older marks have no applied snapshot, so leave budgets alone.
 *
 * @returns {{expenses, budgets, restoredBudgets: boolean, removed: number}}
 */
export function planRemove({ expenses = [], budgets = {}, mark }) {
  const removed = sampleRows(expenses).length;
  const canRestore = !!mark?.previousBudgets && !!mark?.appliedBudgets;
  const nextBudgets = canRestore ? { ...mark.previousBudgets } : budgets;
  if (canRestore) {
    for (const key of new Set([...Object.keys(mark.appliedBudgets), ...Object.keys(budgets)])) {
      if (Object.hasOwn(budgets, key) === Object.hasOwn(mark.appliedBudgets, key)
          && budgets[key] === mark.appliedBudgets[key]) continue;
      if (Object.hasOwn(budgets, key)) nextBudgets[key] = budgets[key];
      else delete nextBudgets[key];
    }
  }

  return {
    expenses: ownRows(expenses),
    budgets: nextBudgets,
    restoredBudgets: canRestore,
    removed,
  };
}
