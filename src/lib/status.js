/**
 * The budget status model — §2 of the wallpaper redesign spec.
 *
 * One helper, used everywhere a spent-vs-budget figure is shown, so Home,
 * History and the Budget screen can never disagree about what "close to limit"
 * means. The thresholds live here and nowhere else.
 *
 * The scene is deliberately coarser than the label: it has two states, calm and
 * over, because a wallpaper that changed four times a month would be noise. The
 * label carries the detail; `isOver` is all the wallpaper gets.
 */

/** The three cue keys. Colour is the THIRD cue, after the word and the shape. */
export const CALM = 'calm';
export const WATCH = 'watch';
export const OVER = 'over';

/**
 * @returns {{key: string, label: string, pct: number, over: number, left: number}}
 *   `pct` is uncapped so "108% of budget" can be reported honestly; callers
 *   clamp it themselves when sizing a bar.
 */
export function budgetStatus(spent = 0, budget = 0) {
  const s = Number(spent) || 0;
  const b = Number(budget) || 0;
  const base = { pct: b > 0 ? Math.round((s / b) * 100) : 0, over: Math.max(0, s - b), left: b - s };

  if (b <= 0) return { ...base, key: CALM, label: 'No budget set' };
  if (s > b) return { ...base, key: OVER, label: 'Over budget' };
  if (s === b) return { ...base, key: WATCH, label: 'Budget reached' };
  if (s >= b * 0.75) return { ...base, key: WATCH, label: 'Close to limit' };
  return { ...base, key: CALM, label: 'On track' };
}

/** The wallpaper's entire share of the budget signal. */
export const isOverBudget = (spent, budget) => Number(budget) > 0 && Number(spent) > Number(budget);
