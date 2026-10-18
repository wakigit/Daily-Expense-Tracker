/**
 * Asserts every structural property the question bank depends on.
 *
 * Run this after ANY edit to fixture.js. Several questions in the bank rely on
 * exact ties, on one completely empty week, and on a category with an empty
 * month; all three are easy to break by adding one innocuous row.
 *
 * Imports nothing from src/ — own loops, own date helpers, integer cents.
 *
 *   node scripts/eval/fixture-checks.mjs
 */

import { EXPENSES, CATS, BUDGETS, TODAY } from './fixture.js';

const cents = (amount) => Math.round(Number(amount) * 100 + 1e-9);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekdayOf = (date) => DAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];
const shift = (date, n) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + n);
  return value.toISOString().slice(0, 10);
};
const weekStartOf = (date) => shift(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

let failures = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`PASS  ${label}`); return; }
  failures += 1;
  console.log(`FAIL  ${label}${detail ? `  — ${detail}` : ''}`);
}

const ids = EXPENSES.map((row) => row.id);
const catIds = new Set(CATS.map((cat) => cat.id));

// ── Shape ──────────────────────────────────────────────────────────
ok('row count is about 100', EXPENSES.length >= 95 && EXPENSES.length <= 105, `${EXPENSES.length} rows`);
ok('ids unique', new Set(ids).size === ids.length);
ok('every row references a real category (no dangling ids)',
  EXPENSES.every((row) => catIds.has(row.category)),
  EXPENSES.filter((row) => !catIds.has(row.category)).map((r) => r.id).join(', '));
ok('every amount is a positive 2dp value',
  EXPENSES.every((row) => cents(row.amount) > 0 && Math.abs(cents(row.amount) / 100 - row.amount) < 1e-9));
ok('dates sorted ascending', EXPENSES.every((row, i) => i === 0 || EXPENSES[i - 1].date <= row.date));
ok('date span is 2025-12 to the reference date',
  EXPENSES[0].date.startsWith('2025-12') && EXPENSES.at(-1).date === TODAY);

// ── Required categories ────────────────────────────────────────────
ok('seven current defaults present',
  ['food', 'entertainment', 'needs', 'shop', 'pub', 'hire', 'misc'].every((id) => catIds.has(id)));
ok('custom Bubble Tea category present',
  CATS.some((cat) => cat.id === 'bbt' && cat.label === 'Bubble Tea'));
ok('legacy transport id present and resolvable',
  CATS.some((cat) => cat.id === 'transport') && EXPENSES.some((row) => row.category === 'transport'));
ok('legacy label avoids the word "transport" entirely',
  !/transport/i.test(CATS.find((cat) => cat.id === 'transport').label),
  CATS.find((cat) => cat.id === 'transport').label);
ok('no category is labelled exactly "Transport" (keeps the clarification firing)',
  !CATS.some((cat) => /^transport$/i.test(cat.label.trim())));
ok('Public Transport and Private Hire both exist (the clarification needs both)',
  CATS.some((cat) => /^public transport$/i.test(cat.label)) &&
  CATS.some((cat) => /^private hire$/i.test(cat.label)));

// ── Required dates ─────────────────────────────────────────────────
for (const date of ['2025-12-31', '2026-01-01', TODAY]) {
  ok(`has a row on ${date}`, EXPENSES.some((row) => row.date === date));
}
ok('today carries more than one row (same-date cluster)',
  EXPENSES.filter((row) => row.date === TODAY).length > 1);
const sameDate = [...new Set(EXPENSES.map((r) => r.date))]
  .filter((date) => EXPENSES.filter((r) => r.date === date).length > 1);
ok('several same-date clusters exist', sameDate.length >= 8, `${sameDate.length} dates`);

// ── Ties ───────────────────────────────────────────────────────────
const peakAmount = Math.max(...EXPENSES.map((row) => cents(row.amount)));
const largestRows = EXPENSES.filter((row) => cents(row.amount) === peakAmount);
ok('largest transaction is a tie of exactly two rows',
  largestRows.length === 2, largestRows.map((r) => r.id).join(', '));
ok('tied largest amount is 999.99', peakAmount === 99999);

const dayTotals = new Map();
for (const row of EXPENSES) dayTotals.set(row.date, (dayTotals.get(row.date) ?? 0) + cents(row.amount));
const peakDay = Math.max(...dayTotals.values());
const topDays = [...dayTotals].filter(([, total]) => total === peakDay).map(([date]) => date);
ok('top day (all time) is a tie of exactly two dates',
  topDays.length === 2, topDays.join(', '));

// ── Empty week ─────────────────────────────────────────────────────
const weeks = new Set(EXPENSES.map((row) => weekStartOf(row.date)));
let emptyWeeks = [];
for (let date = weekStartOf('2025-12-30'); date <= TODAY; date = shift(date, 7)) {
  if (!weeks.has(date)) emptyWeeks.push(date);
}
ok('at least one complete week inside the span has no rows',
  emptyWeeks.length >= 1, `empty week starts: ${emptyWeeks.join(', ')}`);
ok('the 2026-09-07 week is the documented empty one', emptyWeeks.includes('2026-09-07'));

// ── Category with an empty month ───────────────────────────────────
const octEntertainment = EXPENSES.filter((row) => row.category === 'entertainment' && row.date.startsWith('2026-10'));
ok('Entertainment has no October rows', octEntertainment.length === 0);
ok('Entertainment does have rows in other months',
  EXPENSES.some((row) => row.category === 'entertainment'));

// ── Description variants ───────────────────────────────────────────
const hasDesc = (needle) => EXPENSES.some((row) => row.description.toLowerCase().includes(needle.toLowerCase()));
for (const needle of ['grab', 'grab ride', 'grabfood', 'GRAB TO CAMPUS', 'gojek', 'starbucks', '2 chicken rice']) {
  ok(`description variant present: ${needle}`, hasDesc(needle));
}
ok('GrabFood rows are filed under Food & Drinks, not a ride category',
  EXPENSES.filter((row) => /grabfood/i.test(row.description)).every((row) => row.category === 'food'));
ok('both Starbucks casings present',
  EXPENSES.some((row) => row.description.includes('Starbucks')) &&
  EXPENSES.some((row) => row.description.includes('starbucks')));
ok('prompt-injection description present',
  EXPENSES.some((row) => /ignore previous instructions/i.test(row.description)));
ok('amount 0.01 present', EXPENSES.some((row) => cents(row.amount) === 1));
ok('amount 999.99 present', EXPENSES.some((row) => cents(row.amount) === 99999));

// ── Weekday / weekend split ────────────────────────────────────────
const weekendCents = EXPENSES.filter((row) => ['Saturday', 'Sunday'].includes(weekdayOf(row.date)))
  .reduce((sum, row) => sum + cents(row.amount), 0);
const weekdayCents = EXPENSES.reduce((sum, row) => sum + cents(row.amount), 0) - weekendCents;
ok('both weekday and weekend rows exist', weekendCents > 0 && weekdayCents > 0);
ok('weekday and weekend totals are clearly different',
  Math.abs(weekdayCents - weekendCents) > 10000,
  `weekday ${weekdayCents}c vs weekend ${weekendCents}c`);

// ── Upward trend in one category ───────────────────────────────────
const bbtByMonth = {};
for (const row of EXPENSES.filter((r) => r.category === 'bbt')) {
  const ym = row.date.slice(0, 7);
  bbtByMonth[ym] = (bbtByMonth[ym] ?? 0) + cents(row.amount);
}
const trendMonths = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const trendValues = trendMonths.map((ym) => bbtByMonth[ym] ?? 0);
ok('Bubble Tea has 4+ months of history',
  Object.keys(bbtByMonth).length >= 4, Object.keys(bbtByMonth).join(', '));
ok('Bubble Tea rises every month June to October',
  trendValues.every((value, i) => i === 0 || value > trendValues[i - 1]),
  trendMonths.map((ym, i) => `${ym}=${trendValues[i]}c`).join(' '));

// ── Budget bands (October month-to-date) ───────────────────────────
const octByCat = {};
for (const row of EXPENSES.filter((r) => r.date >= '2026-10-01' && r.date <= TODAY)) {
  octByCat[row.category] = (octByCat[row.category] ?? 0) + cents(row.amount);
}
const band = (catId) => {
  const spent = octByCat[catId] ?? 0;
  const budget = cents(BUDGETS[catId] ?? 0);
  if (budget <= 0) return 'none';
  if (spent > budget) return 'over';
  if (spent === budget) return 'exactly100';
  if (spent * 100 >= budget * 80) return '80to99';
  return 'under80';
};
console.log('\n--- October month-to-date per category (cents) ---');
for (const cat of CATS) {
  const spent = octByCat[cat.id] ?? 0;
  const budget = cents(BUDGETS[cat.id] ?? 0);
  const pct = budget > 0 ? ((spent / budget) * 100).toFixed(1) : '--';
  console.log(`  ${cat.id.padEnd(14)} spent ${String(spent).padStart(6)}c  budget ${String(budget).padStart(6)}c  ${String(pct).padStart(6)}%  ${band(cat.id)}`);
}
console.log('');

ok('a category is under 80% of budget', band('food') === 'under80', `food is ${band('food')}`);
ok('a category is 80-99% of budget', band('bbt') === '80to99', `bbt is ${band('bbt')}`);
ok('a category is at exactly 100% of budget', band('pub') === 'exactly100', `pub is ${band('pub')}`);
ok('a category is over 100% of budget', band('hire') === 'over', `hire is ${band('hire')}`);
ok('at least one spent category has no budget at all',
  CATS.some((cat) => BUDGETS[cat.id] === undefined && (octByCat[cat.id] ?? 0) > 0));

console.log(failures ? `\n${failures} FIXTURE CHECK(S) FAILED` : '\nAll fixture checks passed.');
process.exit(failures ? 1 : 0);
