/**
 * Money arithmetic, in integer cents.
 *
 * Amounts are *stored* as decimal numbers — 4.5, not 450 — because that is what
 * every saved expense already contains and migrating them is not worth the
 * risk. Amounts are *calculated* in cents, because adding decimal numbers does
 * not do what it looks like it does:
 *
 *   0.1 + 0.2          === 0.30000000000000004
 *   4.35 + 4.35 + 4.35 === 13.049999999999999
 *
 * Rounding each value to two decimals first does not help. 0.1 and 0.2 are
 * already two decimals; the error is in the addition, not the inputs. Only
 * integers add exactly, so every total goes through `toCents` first and comes
 * back once at the end.
 *
 * Conversion happens at the boundary, so nothing stored changes shape and a
 * row written by the old build sums identically to one written today.
 */

/**
 * Decimal amount to integer cents.
 *
 * The nudge matters: 4.565 * 100 is 456.49999999999994 in binary floating
 * point, which rounds to 456 — a silently lost cent. Pushing it a billionth of
 * a cent away from zero lands it on 457 without affecting any honest value.
 */
export function toCents(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const scaled = n * 100;
  return Math.round(scaled + (scaled >= 0 ? 1e-9 : -1e-9));
}

export const fromCents = (cents) => cents / 100;

/** Exact total of a list, in cents. */
export const sumCents = (items = [], pick = (e) => e.amount) =>
  items.reduce((c, item) => c + toCents(pick(item)), 0);

/** Exact total of a list, converted back to a decimal amount once at the end. */
export const sumAmounts = (items = [], pick) => fromCents(sumCents(items, pick));

/**
 * Totals grouped by a key, summed in cents throughout. Used for per-day,
 * per-week, per-month and per-category breakdowns, all of which previously
 * accumulated floats and could disagree with the grand total by a cent.
 */
export function totalsBy(items = [], keyOf, pick = (e) => e.amount) {
  const cents = Object.create(null);
  for (const item of items) {
    const key = keyOf(item);
    cents[key] = (cents[key] ?? 0) + toCents(pick(item));
  }
  const out = {};
  for (const key of Object.keys(cents)) out[key] = fromCents(cents[key]);
  return out;
}

/** Rounds a decimal amount to a whole cent. Use at entry, not for summing. */
export const roundAmount = (amount) => fromCents(toCents(amount));
