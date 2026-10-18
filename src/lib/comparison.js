import { addDays, weekStart, inRange } from './stats';
import { sumCents, fromCents } from './money';
import { money } from './format';
import { captureEvidence } from './answerEvidence';

/** Inclusive calendar windows. A shorter prior month is capped, never rolled over. */
export function comparisonRanges(period, today) {
  if (period === 'week') {
    const start = weekStart(today);
    return { current: { start, end: today }, earlier: { start: addDays(start, -7), end: addDays(today, -7) }, capped: false };
  }
  if (period !== 'month') return null;
  const [year, month, day] = today.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  return {
    current: { start: `${today.slice(0, 7)}-01`, end: today },
    earlier: { start: `${previous}-01`, end: `${previous}-${String(Math.min(day, lastDay)).padStart(2, '0')}` },
    capped: day > lastDay,
  };
}

export function comparisonAnswer({ period, category = null }, { expenses = [], cats = [], today }) {
  const ranges = comparisonRanges(period, today);
  const cat = cats.find(c => c.id === category);
  if (!ranges || (category !== null && !cat)) return { kind: 'clarify', question: 'Which category and current month or week should I compare?' };
  const sides = ['current', 'earlier'].map(key => {
    const scope = { ...ranges[key], category };
    const rows = inRange(expenses, scope.start, scope.end).filter(row => category === null || row.category === category);
    return { key, label: key === 'current' ? `This ${period} to date` : `Previous ${period}, matching dates`, ...ranges[key], totalCents: sumCents(rows), evidence: captureEvidence(rows, { scope, cats }) };
  });
  const [current, earlier] = sides;
  const differenceCents = current.totalCents - earlier.totalCents;
  const direction = differenceCents > 0 ? 'more' : differenceCents < 0 ? 'less' : 'the same';
  const percentage = earlier.totalCents > 0 ? Math.abs(differenceCents) / earlier.totalCents * 100 : null;
  const difference = money(fromCents(Math.abs(differenceCents)));
  const movement = differenceCents === 0 ? `The recorded totals are the same (${difference} difference).` : `You recorded ${difference} ${direction}.`;
  const limitations = [];
  if (sides.some(side => !side.evidence.rows.length)) limitations.push('At least one range has no recorded expenses. These figures are not a reliable spending trend; missing records may explain the difference.');
  if (ranges.capped) limitations.push('The previous month is shorter, so its range ends at month-end. The two ranges have different numbers of days.');
  return {
    kind: 'answer', intent: 'compare',
    text: `${movement} ${money(fromCents(current.totalCents))} this ${period} to date versus ${money(fromCents(earlier.totalCents))} in the earlier range.`,
    detail: [percentage === null ? 'Percentage unavailable because the earlier total is zero.' : `${percentage.toFixed(1)}% ${differenceCents === 0 ? 'change' : direction} than the earlier total.`, ...limitations].join(' '),
    interpretation: { category: cat?.label ?? 'All categories', period: `${current.start} to ${current.end} vs ${earlier.start} to ${earlier.end}` },
    comparison: { sides, differenceCents, direction, percentage },
  };
}

/** Conservative local interpretation: unresolved or multiple subjects need clarification. */
export function matchComparison(question, cats) {
  const q = question.toLowerCase();
  if (!/\b(compare|compared|comparison|versus|vs)\b|\b(more|less|same)\b.*\bthan\b/.test(q)) return null;
  const period = /\bthis month\b/.test(q) && /\blast month\b/.test(q) ? 'month'
    : /\bthis week\b/.test(q) && /\blast week\b/.test(q) ? 'week' : null;
  let remainder = q;
  const matches = [];
  for (const cat of [...cats].sort((a, b) => b.label.length - a.label.length)) {
    const label = cat.label.toLowerCase();
    if (!label) continue;
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'gu');
    if (re.test(remainder)) { matches.push(cat); remainder = remainder.replace(re, ' '); }
  }
  remainder = remainder.replace(/\b(did|how|does|do|my|i|spend|spending|spent|more|less|same|compare|compared|comparison|with|to|than|this|last|month|week|all|total|expenses|on|the|is|was|versus|vs)\b/g, ' ').replace(/[\s?.,!'’]/g, '');
  if (!period || matches.length > 1 || remainder) return { kind: 'clarify', question: 'I can compare this month with last month, or this week with last week, for all spending or one category. Which period and category do you mean?' };
  return { query: { metric: 'compare', period, category: matches[0]?.id ?? null } };
}
