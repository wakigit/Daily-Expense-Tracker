/**
 * Every number the assistant can report.
 *
 * Pure functions over the expense list — no React, no dates from the UI, no
 * formatting. This is deliberate: when the LLM lands, these become its TOOLS.
 * The model decides which question is being asked; this file computes the
 * answer. A model asked to add up 300 rows in its head is right most of the
 * time, which is worse than being wrong every time, because the errors are
 * silent.
 */

const asDate = (ymd) => new Date(`${ymd}T00:00:00`);
const toYmd = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const amount = (e) => Number(e.amount) || 0;

/** Monday-start week, matching how weeks are read in Singapore. */
export function weekStart(ymd) {
  const d = asDate(ymd);
  const dow = (d.getDay() + 6) % 7;   // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return toYmd(d);
}

export function addDays(ymd, n) {
  const d = asDate(ymd);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

export const monthOf = (ymd) => ymd.slice(0, 7);

/** Inclusive range filter. Either bound may be omitted. */
export function inRange(expenses, start, end) {
  return expenses.filter((e) => {
    if (!e?.date) return false;
    if (start && e.date < start) return false;
    if (end && e.date > end) return false;
    return true;
  });
}

export const sum = (expenses) => expenses.reduce((s, e) => s + amount(e), 0);

/** Totals keyed by day, e.g. { '2026-09-28': 12.5 }. */
export function byDay(expenses) {
  const out = {};
  for (const e of expenses) out[e.date] = (out[e.date] || 0) + amount(e);
  return out;
}

export function byWeek(expenses) {
  const out = {};
  for (const e of expenses) {
    const k = weekStart(e.date);
    out[k] = (out[k] || 0) + amount(e);
  }
  return out;
}

export function byMonth(expenses) {
  const out = {};
  for (const e of expenses) {
    const k = monthOf(e.date);
    out[k] = (out[k] || 0) + amount(e);
  }
  return out;
}

export function byCategory(expenses) {
  const out = {};
  for (const e of expenses) out[e.category] = (out[e.category] || 0) + amount(e);
  return out;
}

/** The single biggest entry in a totals map, or null when empty. */
function peak(totals) {
  const entries = Object.entries(totals);
  if (!entries.length) return null;
  // Sort by amount, then by key, so ties resolve to the earlier period rather
  // than to whatever order the object happened to be built in.
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { key: entries[0][0], total: entries[0][1] };
}

export const topDay = (expenses) => peak(byDay(expenses));
export const topWeek = (expenses) => peak(byWeek(expenses));
export const topMonth = (expenses) => peak(byMonth(expenses));
export const topCategory = (expenses) => peak(byCategory(expenses));

/**
 * Mean spend per day across the days actually covered by the data.
 *
 * `mode: 'elapsed'` divides by every calendar day in the span, including days
 * with no spending — which is what someone means by "how much do I spend a
 * day". `mode: 'active'` divides only by days that have an entry.
 */
export function averagePerDay(expenses, { start, end, mode = 'elapsed' } = {}) {
  const items = inRange(expenses, start, end);
  if (!items.length) return 0;

  const days = byDay(items);
  if (mode === 'active') return sum(items) / Object.keys(days).length;

  const dates = Object.keys(days).sort();
  const from = start || dates[0];
  const to = end || dates[dates.length - 1];
  const span = Math.round((asDate(to) - asDate(from)) / 86400000) + 1;
  return sum(items) / Math.max(1, span);
}

export const averagePerWeek = (expenses, opts) => averagePerDay(expenses, opts) * 7;

/** Mean across the calendar months that actually contain data. */
export function averagePerMonth(expenses, opts = {}) {
  const items = inRange(expenses, opts.start, opts.end);
  const months = byMonth(items);
  const n = Object.keys(months).length;
  return n ? sum(items) / n : 0;
}

/* ── Named periods, resolved against a reference date ──────────── */

export function period(name, today = toYmd(new Date())) {
  switch (name) {
    case 'today':      return { start: today, end: today, label: 'today' };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { start: y, end: y, label: 'yesterday' };
    }
    case 'week':       return { start: weekStart(today), end: today, label: 'this week' };
    case 'lastweek': {
      const s = addDays(weekStart(today), -7);
      return { start: s, end: addDays(s, 6), label: 'last week' };
    }
    case 'month':      return { start: `${monthOf(today)}-01`, end: today, label: 'this month' };
    case 'lastmonth': {
      const firstOfThis = `${monthOf(today)}-01`;
      const prev = asDate(firstOfThis);
      prev.setMonth(prev.getMonth() - 1);
      return {
        start: toYmd(prev),
        end: addDays(firstOfThis, -1),   // the day before this month began
        label: 'last month',
      };
    }
    case 'all':
    default:           return { start: undefined, end: undefined, label: 'all time' };
  }
}
