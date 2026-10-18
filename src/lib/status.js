import { toCents, fromCents } from './money.js';
/**
 * The budget status model — §2 of the wallpaper redesign spec.
 *
 * One helper, used everywhere a spent-vs-budget figure is shown, so Home,
 * History and the Budget screen can never disagree about what "close to limit"
 * means. The thresholds live here and nowhere else.
 *
 * The scene is coarser than the label, but no longer binary: it runs down in
 * three steps as the month is spent, and `decayLevel` below is the whole of
 * that mapping. Five labels collapse onto three scene states, which is the
 * point — the wallpaper reads as a mood, the label carries the detail, and
 * because both are derived from the same three keys they cannot disagree.
 */

/** The three cue keys. Colour is the THIRD cue, after the word and the shape. */
export const BUDGET_WARNING_PCT = 80;
export const CALM = 'calm';
export const WATCH = 'watch';
export const OVER = 'over';

/**
 * @returns {{key: string, label: string, pct: number, over: number, left: number}}
 *   `pct` is uncapped so "108% of budget" can be reported honestly; callers
 *   clamp it themselves when sizing a bar.
 */
export function budgetStatus(spent = 0, budget = 0) {
  const s = toCents(spent);
  const b = toCents(budget);
  const base = { pct: b > 0 ? Math.round((s / b) * 100) : 0, over: fromCents(Math.max(0, s - b)), left: fromCents(b - s) };

  if (b <= 0) return { ...base, key: CALM, label: 'No budget set' };
  if (s > b) return { ...base, key: OVER, label: 'Over budget' };
  if (s === b) return { ...base, key: WATCH, label: 'Budget reached' };
  if (s * 100 >= b * BUDGET_WARNING_PCT) return { ...base, key: WATCH, label: 'Close to limit' };
  return { ...base, key: CALM, label: 'On track' };
}

/**
 * How run-down the wallpaper should look, 0 (healthy) to 2 (run down).
 *
 * Deliberately a projection of `budgetStatus().key` rather than its own set of
 * thresholds. A second set of numbers here would be a second definition of
 * "close to limit", free to drift from the one above — and the first symptom
 * would be a scene that decays while the chip still says "On track".
 *
 * `No budget set` maps to 0, so someone who never sets a budget keeps a healthy
 * world rather than being handed a permanently bleak app.
 */
export function decayLevel(key) {
  if (key === OVER) return 2;
  if (key === WATCH) return 1;
  return 0;
}
