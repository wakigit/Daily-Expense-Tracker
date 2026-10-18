import { normaliseDescription } from './actions';
import { weekStart, addDays, inRange } from './stats';
import { sumCents, toCents } from './money';
import { roastPreferences } from './roastContract';

export const roastFingerprint = row => JSON.stringify([row.id, row.description, row.amount, row.category, row.date, row.notes ?? '']);
export const roastBand = (spent, budget) => budget <= 0 ? { band: 'none', intensity: 0 }
  : spent > budget ? { band: 'over', intensity: 2 }
  : spent * 4 >= budget * 3 ? { band: 'near', intensity: 1 } : { band: 'under', intensity: 0 };

/** Exact description + category only. Distinct saved IDs count separately. */
export function buildRoastInput(row, { expenses, cats, budgets, today, preferences, angleIndex = 0 }) {
  const prefs = roastPreferences(preferences);
  const unique = new Map(expenses.map(e => [e.id, e]));
  unique.set(row.id, row); // Include this save exactly once, even if caller already included it.
  const ledger = [...unique.values()].filter(e => e.date <= today);
  const month = row.date.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const start = `${month}-01`;
  const end = monthEnd < today ? monthEnd : today;
  const week = weekStart(row.date);
  const weekEnd = addDays(week, 6) < today ? addDays(week, 6) : today;
  const categoryRows = inRange(ledger, start, end).filter(e => e.category === row.category);
  const same = e => e.category === row.category && normaliseDescription(e.description) === normaliseDescription(row.description);
  const facts = [];
  if (row.date <= today) {
    for (const [kind, from, through] of [['repeat_week', week, weekEnd], ['repeat_month', start, end]]) {
      const rows = inRange(ledger, from, through).filter(same);
      if (rows.length >= 2) facts.push({ kind, start: from, end: through, count: rows.length, totalCents: sumCents(rows) });
    }
    // Category row counts say nothing about this purchase's history. Keep them local.
    // Category spending is used only to calculate the actual configured budget usage below.
  }
  let budget = { band: row.date < today ? 'historical' : 'none', intensity: 0, categoryUsagePct: null };
  if (row.date === today) {
    const current = inRange(ledger, `${today.slice(0, 7)}-01`, today);
    const totalBudget = cats.reduce((sum, cat) => sum + Math.max(0, toCents(budgets[cat.id] || 0)), 0);
    budget = { ...roastBand(sumCents(current), totalBudget), categoryUsagePct: toCents(budgets[row.category]) > 0 ? Math.round(sumCents(categoryRows) / toCents(budgets[row.category]) * 100) : null };
  }
  // Context is optional material, not a scheduled subject. Keep legacy wire codes for cache compatibility.
  const angles = ['dramatic_narration', 'absurd_accounting', 'corporate_report'];
  return {
    transaction: { description: row.description, amountCents: toCents(row.amount), category: cats.find(c => c.id === row.category)?.label ?? 'Uncategorised' },
    facts, budget, angle: angles[angleIndex % angles.length],
    preferences: { name: angleIndex % 3 === 2 ? prefs.name.trim() : '', singapore: prefs.singapore, smu: prefs.smu },
  };
}

export function offlineRoast(input) {
  const repeat = input.facts.find(f => f.kind === 'repeat_week') ?? input.facts.find(f => f.kind === 'repeat_month');
  if (repeat) return `${repeat.count} recorded matching purchases, S$${(repeat.totalCents / 100).toFixed(2)} spent, apparently once wasn't enough.`;
  if (input.budget.band === 'over') return 'Over budget and still buying stuff, your restraint has left the chat.';
  if (input.budget.band === 'near') return 'Budget almost gone, and this purchase still made the cut.';
  return 'Purchase saved, questionable decision included at no extra charge.';
}
