/**
 * Turns a typed question into an answer, using stats.js for every number.
 *
 * This is intent matching, not a language model — and that is deliberate for
 * now: it needs no API key, no backend, costs nothing, and works offline. The
 * questions it handles are the ones actually asked of an expense tracker.
 *
 * When the LLM lands, ONLY this file is replaced: the model picks the intent
 * and period, then calls exactly the same stats functions. The arithmetic
 * never moves into the model.
 */

import { money, ymLabel, dayLabel } from './format';
import {
  inRange, sum, topDay, topWeek, topMonth, topCategory, byCategory,
  averagePerDay, averagePerWeek, averagePerMonth, period, addDays,
} from './stats';

export const SUGGESTIONS = [
  'How much did I spend this week?',
  'Which day did I spend the most?',
  'Which week did I spend the most?',
  'What is my average spending per week?',
  'What do I spend the most on?',
];

const PERIODS = [
  [/\b(today)\b/, 'today'],
  [/\b(yesterday)\b/, 'yesterday'],
  [/\blast\s*week\b/, 'lastweek'],
  [/\blast\s*month\b/, 'lastmonth'],
  [/\bthis\s*week\b|\bthe\s*week\b|\bweekly\b|\bper\s*week\b|\ba\s*week\b/, 'week'],
  [/\bthis\s*month\b|\bthe\s*month\b|\bmonthly\b|\bper\s*month\b|\ba\s*month\b/, 'month'],
  [/\ball\s*time\b|\boverall\b|\bever\b|\btotal\b/, 'all'],
];

const detectPeriod = (q, fallback) => {
  for (const [re, name] of PERIODS) if (re.test(q)) return name;
  return fallback;
};

const detectCategory = (q, cats) =>
  cats.find((c) => c.label && q.includes(c.label.toLowerCase())) || null;

const weekLabel = (startYmd) => `${dayLabel(startYmd)} – ${dayLabel(addDays(startYmd, 6))}`;

/** A gentle nudge when there is simply nothing recorded yet. */
const noData = (label) => ({
  intent: 'empty',
  text: `I don't have any expenses recorded for ${label} yet.`,
});

export function answer(question, { expenses = [], cats = [], today } = {}) {
  const q = String(question || '').toLowerCase().trim();
  if (!q) return { intent: 'none', text: 'Ask me about your spending.' };

  // "this month" is a PERIOD, not the subject. Strip period phrases before
  // working out what is being asked about, or "what do I spend the most on
  // this month" gets read as "which month did I spend the most".
  const subject = q
    .replace(/\b(this|last|per|each|every|a|the)\s+(week|month|day)\b/g, ' ')
    .replace(/\b(today|yesterday|weekly|monthly|daily|overall|ever|all\s*time)\b/g, ' ');

  const cat = detectCategory(q, cats);
  const wantsAverage = /\baverage\b|\bavg\b|\bmean\b|\btypical\b|\busually\b|\bon average\b/.test(q);
  const wantsMost = /\bmost\b|\bhighest\b|\bbiggest\b|\blargest\b|\btop\b|\bworst\b/.test(q);
  const wantsCount = /\bhow many\b|\bcount\b|\bnumber of\b/.test(q);

  /* ── Which day / week / month was biggest ──────────────────── */
  if (wantsMost && /\bday\b/.test(subject)) {
    const p = period(detectPeriod(q, 'all'), today);
    const items = inRange(expenses, p.start, p.end);
    const top = topDay(items);
    if (!top) return noData(p.label);
    return {
      intent: 'topDay',
      text: `Your biggest day ${p.label === 'all time' ? 'so far' : p.label} was ${dayLabel(top.key)}, at ${money(top.total)}.`,
      detail: (() => {
        const n = inRange(items, top.key, top.key).length;
        return `${n} ${n === 1 ? 'entry' : 'entries'} that day.`;
      })(),
    };
  }

  if (wantsMost && /\bweek\b/.test(subject)) {
    const p = period(detectPeriod(q, 'all'), today);
    const items = inRange(expenses, p.start, p.end);
    const top = topWeek(items);
    if (!top) return noData(p.label);
    return {
      intent: 'topWeek',
      text: `Your biggest week was ${weekLabel(top.key)}, at ${money(top.total)}.`,
      detail: `Week beginning Monday ${dayLabel(top.key)}.`,
    };
  }

  if (wantsMost && /\bmonth\b/.test(subject)) {
    const top = topMonth(expenses);
    if (!top) return noData('any month');
    return {
      intent: 'topMonth',
      text: `Your biggest month was ${ymLabel(top.key)}, at ${money(top.total)}.`,
    };
  }

  /* ── What do I spend the most on ───────────────────────────── */
  if (wantsMost && (/\bon\b|\bcategory\b|\bwhat\b/.test(q) || !/\bday\b|\bweek\b|\bmonth\b/.test(subject))) {
    const p = period(detectPeriod(q, 'all'), today);
    const items = inRange(expenses, p.start, p.end);
    const top = topCategory(items);
    if (!top) return noData(p.label);
    const label = cats.find((c) => c.id === top.key)?.label ?? 'Uncategorised';
    const share = Math.round((top.total / sum(items)) * 100);
    return {
      intent: 'topCategory',
      text: `You spend the most on ${label} — ${money(top.total)} ${p.label === 'all time' ? 'all time' : p.label}.`,
      detail: `That's ${share}% of everything you've spent${p.label === 'all time' ? '' : ` ${p.label}`}.`,
    };
  }

  /* ── Averages ──────────────────────────────────────────────── */
  if (wantsAverage) {
    const scope = cat ? expenses.filter((e) => e.category === cat.id) : expenses;
    if (!scope.length) return noData(cat ? cat.label : 'anything');
    const suffix = cat ? ` on ${cat.label}` : '';

    if (/\bday\b|\bdaily\b/.test(q)) {
      return {
        intent: 'avgDay',
        text: `You spend about ${money(averagePerDay(scope))} a day${suffix}.`,
        detail: 'Averaged across every day since your first entry.',
      };
    }
    if (/\bmonth\b|\bmonthly\b/.test(q)) {
      return {
        intent: 'avgMonth',
        text: `You spend about ${money(averagePerMonth(scope))} a month${suffix}.`,
        detail: 'Averaged across the months that have entries.',
      };
    }
    return {
      intent: 'avgWeek',
      text: `You spend about ${money(averagePerWeek(scope))} a week${suffix}.`,
      detail: `That's roughly ${money(averagePerDay(scope))} a day.`,
    };
  }

  /* ── How many entries ──────────────────────────────────────── */
  if (wantsCount) {
    const p = period(detectPeriod(q, 'month'), today);
    const items = inRange(expenses, p.start, p.end).filter((e) => !cat || e.category === cat.id);
    return {
      intent: 'count',
      text: `${items.length} ${items.length === 1 ? 'entry' : 'entries'} ${p.label}${cat ? ` on ${cat.label}` : ''}, totalling ${money(sum(items))}.`,
    };
  }

  /* ── Plain totals ──────────────────────────────────────────── */
  if (/\bhow much\b|\bspend\b|\bspent\b|\btotal\b/.test(q)) {
    const p = period(detectPeriod(q, 'month'), today);
    const items = inRange(expenses, p.start, p.end).filter((e) => !cat || e.category === cat.id);
    if (!items.length) return noData(`${p.label}${cat ? ` on ${cat.label}` : ''}`);

    const total = sum(items);
    const answerText = cat
      ? `You spent ${money(total)} on ${cat.label} ${p.label}.`
      : `You spent ${money(total)} ${p.label}.`;

    // Without a category, naming the biggest one makes the total actionable.
    let detail;
    if (!cat) {
      const top = topCategory(items);
      const label = cats.find((c) => c.id === top?.key)?.label;
      if (label) detail = `Most of it on ${label} (${money(top.total)}).`;
    } else {
      detail = `${items.length} ${items.length === 1 ? 'entry' : 'entries'}.`;
    }
    return { intent: 'total', text: answerText, detail };
  }

  return {
    intent: 'unknown',
    text: "I can't answer that one yet.",
    detail: 'Try asking about totals, averages, or your biggest day, week or category.',
  };
}
