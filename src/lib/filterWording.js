/**
 * Plain-English names for the filters an answer was actually calculated under.
 *
 * This exists because of a real wrong answer. Asked "which weekday has my
 * highest average spending?", the model grouped by day-of-week AND added a
 * Monday-to-Friday filter, so the true winner (a Saturday) was removed from
 * contention before the comparison happened. The answer named a weekday with a
 * precise figure and was wrong, and the only clue was the bare word "weekday"
 * in the interpretation line — which reads as "grouped by weekday", not "we
 * threw away the weekend".
 *
 * So no filter is ever described by its internal token again. `weekday` is not
 * a label, it is a restriction, and it says so: "Mondays to Fridays only".
 *
 * Shared by the engine's visible answer text and its interpretation line, so
 * the two cannot describe the same query differently.
 */

/**
 * A day filter named as a restriction rather than a grouping.
 * `all` returns null: there is nothing to disclose when nothing is excluded.
 */
export function dayFilterPhrase(day) {
  if (!day || day === 'all') return null;
  if (day === 'weekday') return 'Mondays to Fridays only (weekends excluded)';
  if (day === 'weekend') return 'Saturdays and Sundays only (weekdays excluded)';
  return `${day}s only`;
}

/** The amount condition in words, with the threshold the user supplied. */
export function amountFilterPhrase(operator, formattedAmount) {
  if (!operator) return null;
  const word = { gt: 'over', lt: 'under', gte: 'at least', lte: 'at most' }[operator];
  return word ? `${word} ${formattedAmount}` : null;
}

/**
 * Every RESTRICTION in force, in plain words, most significant first.
 *
 * Deliberately excludes "All categories": that is the absence of a filter, and
 * listing it as one trains the reader to skim the line that matters.
 *
 * @param parts.categoryLabel resolved category label, or null for all
 * @param parts.description literal description substring, or null
 * @param parts.amountPhrase from `amountFilterPhrase`, or null
 * @param parts.day raw day token from the validated query
 * @returns {string[]} possibly empty
 */
export function activeFilterPhrases({ categoryLabel = null, description = null, amountPhrase = null, day = 'all' } = {}) {
  return [
    categoryLabel && `category ${categoryLabel}`,
    description && `descriptions containing “${description}”`,
    amountPhrase,
    dayFilterPhrase(day),
  ].filter(Boolean);
}

/**
 * One sentence disclosing the restrictions, for the visible answer text.
 *
 * Returns an empty string when nothing is restricted, so callers can append it
 * unconditionally without producing a trailing "Counting everything."
 */
export function filterDisclosure(phrases = []) {
  if (!phrases.length) return '';
  return ` Counting only: ${phrases.join('; ')}.`;
}
