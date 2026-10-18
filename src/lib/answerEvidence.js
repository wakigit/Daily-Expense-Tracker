import { rowMatches } from './queryContract.js';
import { toCents } from './money';
import { weekStart } from './stats';

/** Select a winning group by its key, never by matching an amount or model IDs. */
export function winningRows(metric, rows, key) {
  return rows.filter((row) => {
    switch (metric) {
      case 'top_day': return row.date === key;
      case 'top_week': return weekStart(row.date) === key;
      case 'top_month': return row.date.slice(0, 7) === key;
      case 'top_category': return row.category === key;
      default: return false;
    }
  });
}

const snapshot = (row, cats) => ({
  id: row.id,
  description: row.description,
  date: row.date,
  category: row.category,
  categoryLabel: cats.find((cat) => cat.id === row.category)?.label ?? row.category,
  amount: row.amount,
  notes: row.notes ?? '',
});

/** Local-only immutable inputs, with a separate scope for detecting later changes.
 * A top answer displays the winning rows; every candidate can affect its winner.
 */
export function captureEvidence(rows, { basis = rows, scope = {}, cats = [] } = {}) {
  return {
    rows: rows.map((row) => snapshot(row, cats)),
    basis: basis.map((row) => snapshot(row, cats)),
    scope: { ...scope, category: scope.category ?? null },
  };
}

export function evidenceIsOutdated(evidence, expenses, cats = []) {
  if (!evidence) return false;
  if (evidence.scope.historyStart) {
    const first = expenses.filter(e => e.date <= evidence.scope.end).map(e => e.date).sort()[0] ?? evidence.scope.end;
    if (first !== evidence.scope.historyStart) return true;
  }
  const current = expenses.filter((row) => rowMatches(row, evidence.scope));
  if (current.length !== evidence.basis.length) return true;
  const byId = new Map(current.map((row) => [row.id, snapshot(row, cats)]));
  return evidence.basis.some((row) => JSON.stringify(byId.get(row.id)) !== JSON.stringify(row));
}

/** Preserve the warning even if a subsequent Undo restores the original rows. */
export function markOutdatedAnswers(messages, expenses, cats, budgets = {}) {
  let changed = false;
  const next = messages.map((message) => {
    const evidence = [message.evidence, ...(message.comparison?.sides ?? []).map(side => side.evidence)];
    const budgetChanged = message.budgetEvidence && toCents(budgets[message.budgetEvidence.category] ?? 0) !== message.budgetEvidence.amountCents;
    if (message.outdated || (!budgetChanged && !evidence.some(item => evidenceIsOutdated(item, expenses, cats)))) return message;
    changed = true;
    return { ...message, outdated: true };
  });
  return changed ? next : messages;
}
