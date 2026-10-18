/**
 * The oracle. Independently computed expected answers.
 *
 * IMPORTANT: this file imports NOTHING from `src/`. Not a calculation, not a
 * date helper, not a validator. Every figure is recomputed here from
 * `fixture.js` with plain loops and integer cents, using the date helpers
 * defined below. That independence is the whole point: an oracle that called
 * `executeQuery` would agree with the application even when both are wrong, and
 * would turn the evaluation into a tautology.
 *
 * Where the application's documented contract defines a convention, this file
 * re-implements that convention from the written specification rather than
 * importing it. The conventions used are stated explicitly in DEFINITIONS
 * below, so a human can check the oracle itself by reading.
 */

import { EXPENSES, CATS, BUDGETS, TODAY } from './fixture.js';

/**
 * Every convention this oracle applies, written out so the expected figures can
 * be argued with. These mirror the application's documented contract; if the
 * application disagrees with one of these, that is a finding, not a fixture bug.
 */
export const DEFINITIONS = {
  lastNDays: 'Last N days is inclusive of today: start = today - (N-1), end = today.',
  weekStart: 'Calendar weeks start on Monday (ISO). "This week" is weekStart(today) through today.',
  monthToDate: '"This month" is the 1st of the current month through today, not the whole month.',
  lastMonth: '"Last month" is the whole previous calendar month, 1st through its last day.',
  year: '"This year" / year-to-date is 1 January of today\'s year through today.',
  all: '"All time" starts at the earliest recorded date on or before today and ends today.',
  range: 'An explicit range is inclusive; an end after today is capped at today.',
  dayFilter: 'Weekday means Monday-Friday. Weekend means Saturday-Sunday.',
  amounts: 'All arithmetic is in integer cents. A dollar amount is converted once, at the boundary.',
  description: 'Description matching is a case-insensitive literal substring. No stemming, no aliases.',
  compareMonth: 'Compare month: this month-to-date versus the SAME day-of-month span of the previous month, capped at that month\'s last day.',
  compareWeek: 'Compare week: weekStart(today)..today versus the same weekday span shifted back exactly 7 days.',
  breakdownSort: 'Breakdown groups sort by month key chronologically, or by category label alphabetically then id.',
  averages: 'daily_average divides by calendar days in range matching the day filter (zero-spend days included); per_transaction divides by matching row count; calendar_week is the daily rate times seven; calendar_month divides by the number of distinct calendar months the range touches.',
  evidenceIds: 'Evidence ids are the ledger ids of the rows a figure was computed from. Compared as a sorted set: membership is the correctness claim, display order is a presentation concern.',
};

/* ── Independent primitives ──────────────────────────────────────── */

/** Dollars to integer cents. Own implementation, nudged like any honest one. */
export const toCents = (amount) => {
  const scaled = Number(amount) * 100;
  return Math.round(scaled + (scaled >= 0 ? 1e-9 : -1e-9));
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKEND = ['Saturday', 'Sunday'];

/** UTC date-only arithmetic, so no machine timezone or DST can reach a figure. */
export const shiftDate = (date, days) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
export const weekdayName = (date) => DAY_NAMES[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];
export const weekStart = (date) => shiftDate(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
export const isWeekend = (date) => WEEKEND.includes(weekdayName(date));
export const lastDayOfMonth = (ym) => {
  const [year, month] = ym.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};
export const datesBetween = (start, end) => {
  const out = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) out.push(date);
  return out;
};

/** Earliest recorded date on or before today. */
const earliestDate = (rows, today) =>
  rows.filter((row) => row.date <= today).map((row) => row.date).sort()[0] ?? today;

/* ── Range resolution ────────────────────────────────────────────── */

/**
 * @param spec `{period, dayCount?, start?, end?}`
 * @returns `{start, end}` inclusive.
 */
export function resolveRange(spec, today = TODAY, rows = EXPENSES) {
  const { period } = spec;
  const ym = today.slice(0, 7);
  switch (period) {
    case 'today': return { start: today, end: today };
    case 'yesterday': return { start: shiftDate(today, -1), end: shiftDate(today, -1) };
    case 'week': return { start: weekStart(today), end: today };
    case 'lastweek': return { start: shiftDate(weekStart(today), -7), end: shiftDate(weekStart(today), -1) };
    case 'month': return { start: `${ym}-01`, end: today };
    case 'lastmonth': {
      const firstOfThis = `${ym}-01`;
      const endPrev = shiftDate(firstOfThis, -1);
      return { start: `${endPrev.slice(0, 7)}-01`, end: endPrev };
    }
    case 'year': return { start: `${today.slice(0, 4)}-01-01`, end: today };
    case 'last_days': return { start: shiftDate(today, 1 - spec.dayCount), end: today };
    case 'all': return { start: earliestDate(rows, today), end: today };
    case 'range': return { start: spec.start, end: spec.end < today ? spec.end : today };
    default: throw new Error(`unknown period: ${period}`);
  }
}

/** The two windows a comparison uses, re-derived from the written contract. */
export function comparisonWindows(period, today = TODAY) {
  if (period === 'week') {
    const start = weekStart(today);
    return { current: { start, end: today }, earlier: { start: shiftDate(start, -7), end: shiftDate(today, -7) } };
  }
  const ym = today.slice(0, 7);
  const day = Number(today.slice(8));
  const prevYm = shiftDate(`${ym}-01`, -1).slice(0, 7);
  const prevLast = lastDayOfMonth(prevYm);
  return {
    current: { start: `${ym}-01`, end: today },
    earlier: { start: `${prevYm}-01`, end: `${prevYm}-${String(Math.min(day, prevLast)).padStart(2, '0')}` },
  };
}

/* ── Filtering ───────────────────────────────────────────────────── */

const includesText = (haystack, needle) =>
  String(haystack ?? '').toLowerCase().includes(String(needle).toLowerCase());

/** Collapse whitespace and lowercase, matching the documented scope normalisation. */
const normalise = (text) => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const scopeHit = (row, categories, terms) =>
  categories.includes(row.category) || terms.some((term) => normalise(row.description).includes(normalise(term)));

/**
 * @param filter `{start, end, category, description, day, amountOperator,
 *   amountCents, scope}` — scope is `{includeCategories, includeTerms,
 *   excludeCategories, excludeTerms}`.
 */
export function selectRows(filter = {}, rows = EXPENSES) {
  const out = [];
  for (const row of rows) {
    if (filter.start && row.date < filter.start) continue;
    if (filter.end && row.date > filter.end) continue;
    if (filter.category && row.category !== filter.category) continue;
    if (filter.description && !includesText(row.description, filter.description)) continue;
    if (filter.scope) {
      if (!scopeHit(row, filter.scope.includeCategories ?? [], filter.scope.includeTerms ?? [])) continue;
      if (scopeHit(row, filter.scope.excludeCategories ?? [], filter.scope.excludeTerms ?? [])) continue;
    }
    if (filter.day && filter.day !== 'all') {
      const name = weekdayName(row.date);
      if (filter.day === 'weekday' && WEEKEND.includes(name)) continue;
      if (filter.day === 'weekend' && !WEEKEND.includes(name)) continue;
      if (!['weekday', 'weekend'].includes(filter.day) && name !== filter.day) continue;
    }
    if (filter.amountOperator) {
      const c = toCents(row.amount);
      const t = filter.amountCents;
      const pass = filter.amountOperator === 'gt' ? c > t
        : filter.amountOperator === 'lt' ? c < t
        : filter.amountOperator === 'gte' ? c >= t
        : c <= t;
      if (!pass) continue;
    }
    out.push(row);
  }
  // Deduplicate by ledger id, as a reviewed scope's OR-clauses must.
  const seen = new Set();
  return out.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
}

export const totalCents = (rows) => rows.reduce((sum, row) => sum + toCents(row.amount), 0);
export const idsOf = (rows) => rows.map((row) => row.id).slice().sort();

/* ── Aggregations ────────────────────────────────────────────────── */

/** A plain `{start, end, totalCents, count, ids}` answer for a filtered scope. */
export function answer(spec, { today = TODAY, rows = EXPENSES } = {}) {
  const range = resolveRange(spec, today, rows);
  const selected = selectRows({ ...range, ...spec, start: range.start, end: range.end }, rows);
  return { ...range, totalCents: totalCents(selected), count: selected.length, ids: idsOf(selected) };
}

/** Complete breakdown by `category` or `month`, with per-group ids. */
export function breakdown(spec, groupBy, { today = TODAY, rows = EXPENSES } = {}) {
  const range = resolveRange(spec, today, rows);
  const selected = selectRows({ ...range, ...spec, start: range.start, end: range.end }, rows);
  const buckets = new Map();
  for (const row of selected) {
    const key = groupBy === 'month' ? row.date.slice(0, 7) : row.category;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const labelOf = (key) => CATS.find((cat) => cat.id === key)?.label ?? String(key);
  const groups = [...buckets].map(([key, group]) => ({
    key, totalCents: totalCents(group), count: group.length, ids: idsOf(group),
  })).sort((a, b) => (groupBy === 'month'
    ? a.key.localeCompare(b.key)
    : labelOf(a.key).localeCompare(labelOf(b.key), 'en-SG') || String(a.key).localeCompare(String(b.key))));
  return { ...range, groupBy, totalCents: totalCents(selected), count: selected.length, groups, ids: idsOf(selected) };
}

/** Highest-spending group, including every tied winner. */
export function highest(spec, groupBy, { today = TODAY, rows = EXPENSES, aggregate = 'total' } = {}) {
  const range = resolveRange(spec, today, rows);
  const selected = selectRows({ ...range, ...spec, start: range.start, end: range.end }, rows);
  const keyOf = (row) => groupBy === 'weekday' ? weekdayName(row.date)
    : groupBy === 'day' ? row.date
    : groupBy === 'week' ? weekStart(row.date)
    : groupBy === 'month' ? row.date.slice(0, 7)
    : row.category;
  const calendar = datesBetween(range.start, range.end)
    .filter((date) => !spec.day || spec.day === 'all'
      || (spec.day === 'weekday' ? !isWeekend(date) : spec.day === 'weekend' ? isWeekend(date) : weekdayName(date) === spec.day));
  const keys = groupBy === 'weekday' ? DAY_NAMES : [...new Set(selected.map(keyOf))];
  const groups = keys.map((key) => {
    const group = selected.filter((row) => keyOf(row) === key);
    const occurrences = groupBy === 'weekday' ? calendar.filter((date) => weekdayName(date) === key).length : null;
    const total = totalCents(group);
    const value = groupBy === 'weekday' && aggregate === 'daily_average'
      ? (occurrences ? total / occurrences : -1)
      : total;
    return { key, totalCents: total, occurrences, value, ids: idsOf(group) };
  }).filter((group) => group.value >= 0);
  if (!selected.length) return { ...range, winners: [], totalCents: 0, ids: [] };
  const peak = Math.max(...groups.map((group) => group.value));
  const winners = groups.filter((group) => group.value === peak);
  return {
    ...range, groupBy, aggregate, peak, winners,
    winnerKeys: winners.map((w) => w.key).slice().sort(),
    ids: idsOf(winners.flatMap((w) => w.ids.map((id) => ({ id })))),
  };
}

/** Largest single transaction by amount, including ties. */
export function largest(spec, { today = TODAY, rows = EXPENSES } = {}) {
  const range = resolveRange(spec, today, rows);
  const selected = selectRows({ ...range, ...spec, start: range.start, end: range.end }, rows);
  if (!selected.length) return { ...range, peakCents: null, ids: [] };
  const peakCents = Math.max(...selected.map((row) => toCents(row.amount)));
  const winners = selected.filter((row) => toCents(row.amount) === peakCents);
  return { ...range, peakCents, count: winners.length, ids: idsOf(winners) };
}

/** Most recent transaction by DATE, including every row sharing that date. */
export function latest(spec, { today = TODAY, rows = EXPENSES } = {}) {
  const range = resolveRange(spec, today, rows);
  const selected = selectRows({ ...range, ...spec, start: range.start, end: range.end }, rows);
  if (!selected.length) return { ...range, date: null, ids: [] };
  const newest = selected.map((row) => row.date).sort().at(-1);
  const winners = selected.filter((row) => row.date === newest);
  return { ...range, date: newest, count: winners.length, totalCents: totalCents(winners), ids: idsOf(winners) };
}

/** Weekday versus weekend totals and per-calendar-day averages. */
export function dayTypes(spec, { today = TODAY, rows = EXPENSES } = {}) {
  const range = resolveRange(spec, today, rows);
  const selected = selectRows({ ...range, ...spec, start: range.start, end: range.end }, rows);
  const calendar = datesBetween(range.start, range.end);
  const side = (kind) => {
    const group = selected.filter((row) => (kind === 'weekend' ? isWeekend(row.date) : !isWeekend(row.date)));
    const days = calendar.filter((date) => (kind === 'weekend' ? isWeekend(date) : !isWeekend(date))).length;
    const total = totalCents(group);
    return { key: kind, totalCents: total, calendarDays: days, averageCents: days ? total / days : null, ids: idsOf(group) };
  };
  return { ...range, weekday: side('weekday'), weekend: side('weekend') };
}

/** Averages, by the documented denominators. */
export function average(spec, aggregate, { today = TODAY, rows = EXPENSES } = {}) {
  const range = resolveRange(spec, today, rows);
  const selected = selectRows({ ...range, ...spec, start: range.start, end: range.end }, rows);
  const calendar = datesBetween(range.start, range.end)
    .filter((date) => !spec.day || spec.day === 'all'
      || (spec.day === 'weekday' ? !isWeekend(date) : spec.day === 'weekend' ? isWeekend(date) : weekdayName(date) === spec.day));
  const total = totalCents(selected);
  const months = new Set(calendar.map((date) => date.slice(0, 7))).size;
  const denominator = aggregate === 'per_transaction' ? selected.length
    : aggregate === 'calendar_month' ? months
    : calendar.length;
  const valueCents = denominator ? (total / denominator) * (aggregate === 'calendar_week' ? 7 : 1) : null;
  return { ...range, aggregate, totalCents: total, denominator, valueCents, count: selected.length, ids: idsOf(selected) };
}

/** This month-to-date against the matching elapsed span of last month. */
export function compare(period, spec = {}, { today = TODAY, rows = EXPENSES } = {}) {
  const windows = comparisonWindows(period, today);
  const side = (key) => {
    const group = selectRows({ ...windows[key], category: spec.category ?? null, description: spec.description ?? null }, rows);
    return { key, ...windows[key], totalCents: totalCents(group), ids: idsOf(group) };
  };
  const current = side('current');
  const earlier = side('earlier');
  const differenceCents = current.totalCents - earlier.totalCents;
  return {
    current, earlier, differenceCents,
    direction: differenceCents > 0 ? 'more' : differenceCents < 0 ? 'less' : 'the same',
    percentage: earlier.totalCents > 0 ? (Math.abs(differenceCents) / earlier.totalCents) * 100 : null,
  };
}

/** Budget pace for one category this month. */
export function projection(category, { today = TODAY, rows = EXPENSES, budgets = BUDGETS } = {}) {
  const range = resolveRange({ period: 'month' }, today, rows);
  const selected = selectRows({ ...range, category }, rows);
  const spentCents = totalCents(selected);
  const budgetCents = toCents(budgets[category] ?? 0);
  const elapsed = Number(today.slice(8));
  return {
    ...range, category, spentCents, budgetCents, elapsed,
    remainingCents: budgetCents - spentCents,
    perDayCents: elapsed ? spentCents / elapsed : null,
    distinctDates: new Set(selected.map((row) => row.date)).size,
    ids: idsOf(selected),
  };
}

/** Month-by-month totals for one category, for trend questions. */
export function monthlySeries(spec, { today = TODAY, rows = EXPENSES } = {}) {
  const range = resolveRange(spec, today, rows);
  const selected = selectRows({ ...range, ...spec, start: range.start, end: range.end }, rows);
  const buckets = new Map();
  for (const row of selected) {
    const ym = row.date.slice(0, 7);
    buckets.set(ym, (buckets.get(ym) ?? 0) + toCents(row.amount));
  }
  return { ...range, months: [...buckets].sort((a, b) => a[0].localeCompare(b[0])).map(([ym, c]) => ({ ym, totalCents: c })) };
}

/** Each category's share of a filtered total, in exact cents plus a percentage. */
export function shares(spec, { today = TODAY, rows = EXPENSES } = {}) {
  const result = breakdown(spec, 'category', { today, rows });
  return {
    ...result,
    groups: result.groups.map((group) => ({
      ...group,
      percentage: result.totalCents > 0 ? (group.totalCents / result.totalCents) * 100 : null,
    })),
  };
}
