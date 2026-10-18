/**
 * The running total of a month's spending, day by day.
 *
 * This answers a question neither of the other two charts on Home asks. The
 * donut says *where* the money went; the seven-day bars said *which recent
 * days* were heavy. This says *whether the month is on pace* — which is the
 * question a budget actually poses, and the only one of the three that is
 * worth the width of the screen.
 *
 * Every point is a real running total of real rows. Days with no spending are
 * still plotted, because the running total genuinely did not move that day —
 * that is a fact about the month, not an invented point. Nothing here
 * interpolates, smooths, forecasts or extends past today.
 */

import { byDay } from './stats';
import { toCents, fromCents } from './money';

/** Days in a calendar month, from `YYYY-MM`. Month 0 of the next year works. */
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * A chart drawn from one or two days is a chart that invites a conclusion the
 * data cannot support, so it is refused rather than drawn thin.
 */
export const MIN_DAYS_WITH_SPEND = 2;

/**
 * @param {object[]} expenses  Rows for this month only — the caller filters.
 * @param {string}   ym        `YYYY-MM` of the month being shown.
 * @param {string}   todayYmd  Today on the Singapore calendar day.
 * @param {number}   budget    Total monthly budget, 0 when none is set.
 */
export function monthTrend(expenses = [], ym, todayYmd, budget = 0) {
  const last = daysInMonth(ym);
  const isCurrent = todayYmd.slice(0, 7) === ym;

  /* A past month is drawn whole. The current month stops at today: carrying a
     flat line to the 31st would draw eleven days of "no spending" that have
     not happened yet, which reads as fact and is not one. */
  const through = isCurrent ? Math.min(Number(todayYmd.slice(8, 10)), last) : last;

  const daily = byDay(expenses);
  const spendDays = Object.keys(daily).filter((d) => d.slice(0, 7) === ym && daily[d] > 0);

  const points = [];
  let runningCents = 0;
  for (let day = 1; day <= through; day++) {
    const date = `${ym}-${String(day).padStart(2, '0')}`;
    const spentToday = daily[date] || 0;
    runningCents += toCents(spentToday);
    points.push({ date, day, spent: spentToday, total: fromCents(runningCents) });
  }

  const total = points.length ? points[points.length - 1].total : 0;
  const peak = Math.max(total, budget);

  return {
    points,
    through,
    lastDay: last,
    isCurrent,
    total,
    budget,
    /* The y axis has to contain the budget line as well as the curve, or the
       one reference worth having falls off the top of the chart. */
    scaleMax: niceCeil(peak),
    daysWithSpend: spendDays.length,
    enough: spendDays.length >= MIN_DAYS_WITH_SPEND,
  };
}

/**
 * Round an axis maximum up to something a person reads without effort.
 *
 * A y axis topping out at 389.6 makes the reader do arithmetic to place a
 * point; one topping out at 400 does not.
 */
export function niceCeil(value) {
  if (!(value > 0)) return 0;
  const mag = 10 ** Math.floor(Math.log10(value));
  const step = value / mag <= 2 ? mag / 2 : value / mag <= 5 ? mag : mag * 2;
  return Math.ceil(value / step) * step;
}

/**
 * Axis ticks from 0 to max, inclusive of both ends.
 * Four gaps keeps the labels legible at every height the card is drawn at.
 */
export function axisTicks(max, gaps = 4) {
  if (!(max > 0)) return [0];
  return Array.from({ length: gaps + 1 }, (_, i) => (max / gaps) * i);
}
