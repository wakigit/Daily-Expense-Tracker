/**
 * Pure search/sort logic for expenses.
 *
 * Deliberately separate from the hook that calls it: pure functions taking
 * data and returning data can be tested directly in Node, with no React and
 * no browser. The hook is then just state plumbing around these.
 */

export const SORTS = ['date', 'amount', 'amount-asc'];

/**
 * Generous matching — people search "grab", "split", "4.50" and "Food"
 * interchangeably, so description, notes, category label and amount all count.
 */
export function matchesQuery(expense, query, catLabel = '') {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (expense.description ?? '').toLowerCase().includes(q) ||
    (expense.notes ?? '').toLowerCase().includes(q) ||
    catLabel.toLowerCase().includes(q) ||
    String(expense.amount).includes(q)
  );
}

/** Returns a new array; never mutates the input. */
export function sortExpenses(items, sort) {
  const out = [...items];
  if (sort === 'amount') out.sort((a, b) => Number(b.amount) - Number(a.amount));
  else if (sort === 'amount-asc') out.sort((a, b) => Number(a.amount) - Number(b.amount));
  else out.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}

export function filterAndSort(items, query, sort, catById) {
  const matched = items.filter((e) =>
    matchesQuery(e, query, catById?.(e.category)?.label ?? '')
  );
  return sortExpenses(matched, sort);
}
