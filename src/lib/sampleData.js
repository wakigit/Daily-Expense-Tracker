/**
 * A fictional month and a bit of a Singapore student's spending.
 *
 * This exists so that someone opening the app for the first time — a judge, on
 * their own phone, with thirty seconds — sees the thing working rather than an
 * empty shell. It is demonstration data and the app says so wherever it shows.
 *
 * Two rules shape it:
 *
 * 1. **It is generated against today, not against a fixed calendar.** Dates
 *    hard-coded to October would be stale in November and would leave the
 *    seven-day chart empty, which is the opposite of the point.
 * 2. **Nothing it writes is lost without being offered back.** Loading it
 *    snapshots whatever was there first, and removing it restores that
 *    snapshot rather than clearing the store — see `src/lib/sampleState.js`.
 *
 * The amounts are invented. No real person, card or statement is involved.
 */

// Extension so this is runnable straight from Node as well as through Vite —
// the suite checks the totals here directly.
import { toCents, fromCents } from './money.js';

/** Marks a row as ours, so removal can take back exactly what it added. */
export const SAMPLE_PREFIX = 'sample-';
export const isSampleRow = (e) => typeof e?.id === 'string' && e.id.startsWith(SAMPLE_PREFIX);

/**
 * One student's habits, by day of the month.
 *
 * Capped at 28 days so the same pattern fits February as well as July — the
 * shape of the month should not depend on which month it lands in. Day 29–31
 * of a long month are deliberately quiet rather than invented.
 *
 * `[day, category, description, amount]`
 */
const PATTERN = [
  [1, 'needs', 'Phone bill', 28.00],
  [1, 'food', 'Kaya toast set', 5.80],
  [2, 'pub', 'EZ-Link top up', 20.00],
  [2, 'food', 'Chicken rice', 6.50],
  [3, 'food', 'Kopi and curry puff', 4.20],
  [4, 'hire', 'Grab to campus', 14.20],
  [4, 'food', 'Laksa', 8.60],
  [5, 'shop', 'Notebook and pens', 18.40],
  [5, 'food', 'Economy rice', 5.40],
  [6, 'food', 'Bubble tea', 6.20],
  [7, 'food', 'Dinner with friends', 32.00],
  [8, 'food', 'Mee pok', 5.00],
  [8, 'pub', 'Bus top up', 10.00],
  [9, 'food', 'Cai fan', 5.60],
  [10, 'misc', 'Birthday gift', 25.00],
  [10, 'food', 'Kopi O', 1.60],
  [11, 'food', 'Katong laksa', 9.80],
  [12, 'hire', 'Grab home late', 16.80],
  [12, 'food', 'Supper prata', 4.40],
  [13, 'food', 'Lunch set', 11.50],
  [14, 'shop', 'T-shirt', 24.90],
  [14, 'food', 'Toast Box', 7.30],
  [15, 'needs', 'Printing credit', 12.00],
  [15, 'food', 'Chicken chop', 13.50],
  [16, 'food', 'Kopi and kaya toast', 4.60],
  [17, 'pub', 'MRT top up', 15.00],
  [17, 'food', 'Yong tau foo', 7.80],
  [18, 'food', 'Nasi lemak', 6.00],
  [19, 'misc', 'Concert ticket', 48.00],
  [20, 'food', 'Fishball noodles', 5.20],
  [21, 'hire', 'Grab in the rain', 12.60],
  [21, 'food', 'Bubble tea', 6.20],
  [22, 'food', 'Chicken rice', 6.50],
  [23, 'shop', 'Phone case', 16.90],
  [24, 'food', 'Ban mian', 6.80],
  [25, 'food', 'Hotpot with friends', 28.00],
  [26, 'food', 'Kopi C', 1.80],
  [27, 'pub', 'EZ-Link top up', 20.00],
  [27, 'food', 'Duck rice', 7.50],
  [28, 'food', 'Mala xiang guo', 14.00],
];

/**
 * The sample's own budgets.
 *
 * Set below what the pattern actually spends, because a demo of a budgeting
 * app that never meets its budget demonstrates nothing. A full month of the
 * pattern costs S$503.60 against S$300 of budget, so **the completed previous
 * month is always over** — which is the reliable way to see the wallpaper's
 * run-down state, whatever today's date is. The current month crosses S$320
 * on its 17th day; before that it is genuinely under, and the app says so.
 */
export const SAMPLE_BUDGETS = {
  food: 120,   // pressed, and over by the middle of a month
  hire: 50,    // comfortably on track, so not every bar is red
  pub: 50,     // close to its limit
  shop: 40,    // over once the month's shopping lands
  needs: 40,   // reaches exactly 100% — the fifth status state
  misc: 20,    // the one a single concert ticket blows
};

/** The sum of every budget above. Asserted in the suite, not trusted. */
export const SAMPLE_BUDGET_TOTAL = 320;

/** What a whole 28-day pattern costs. Hand-summed, then asserted. */
export const PATTERN_TOTAL = 503.60;

/** The first day of a month on which the pattern exceeds SAMPLE_BUDGET_TOTAL. */
export const OVER_BUDGET_FROM_DAY = 17;

const pad = (n) => String(n).padStart(2, '0');

/** `YYYY-MM` shifted by `delta` months, on the real calendar. */
export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Days in `YYYY-MM`. */
export function daysIn(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Build the dataset against a given "today".
 *
 * The previous calendar month is laid down whole, so there is always one
 * complete month to compare against and to step back to. The current month is
 * laid down up to today and no further — a sample that pre-dated the future
 * would be the one lie this app is built not to tell.
 */
export function buildSample(todayYmd) {
  const ym = todayYmd.slice(0, 7);
  const today = Number(todayYmd.slice(8, 10));
  const prev = shiftMonth(ym, -1);

  const rows = [];
  const push = (month, day, cat, desc, amount) => {
    if (day > daysIn(month)) return;
    rows.push({
      id: `${SAMPLE_PREFIX}${month}-${pad(day)}-${rows.length}`,
      date: `${month}-${pad(day)}`,
      category: cat,
      description: desc,
      amount,
      notes: '',
    });
  };

  for (const [day, cat, desc, amount] of PATTERN) push(prev, day, cat, desc, amount);
  for (const [day, cat, desc, amount] of PATTERN) {
    if (day <= today) push(ym, day, cat, desc, amount);
  }

  return { expenses: rows, budgets: { ...SAMPLE_BUDGETS }, months: [prev, ym] };
}

/** Exact total of a row list, in integer cents throughout. */
export function sampleTotal(rows) {
  return fromCents(rows.reduce((cents, r) => cents + toCents(r.amount), 0));
}

/**
 * How much of the pattern has landed by a given day of the month.
 * Used by the suite to check the generator against hand-computed figures.
 */
export function patternTotalThrough(day) {
  return fromCents(
    PATTERN.filter(([d]) => d <= day).reduce((cents, [, , , a]) => cents + toCents(a), 0)
  );
}
