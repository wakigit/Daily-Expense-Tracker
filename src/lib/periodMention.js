/**
 * Does the question name a month that the resolved date range does not cover?
 *
 * This exists because of a real wrong answer. Asked "Compare my September
 * spending with my July spending", the assistant answered with October versus
 * September — both figures genuine, neither month the one requested, and
 * nothing in the reply admitting the substitution. The comparison operation can
 * only express "this period versus the one before it", so naming two arbitrary
 * months is not something it can represent; the honest response is to say so.
 *
 * The guard is deliberately narrow: explicit month names and ISO dates only.
 * It never infers a period, never rewrites a query, and only ever turns an
 * answer into a clarification. Because a false positive would refuse a question
 * the app can genuinely answer, the detector errs the other way throughout —
 * when a word could plausibly not be a month, it is not treated as one.
 *
 * Shared by the server and the browser through `validateIntent`, so both halves
 * reach the same verdict on the same sentence.
 */

/** Month words with no other common English meaning. Counted on sight. */
const PLAIN_MONTHS = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  april: 4, apr: 4,
  june: 6, jun: 6,
  july: 7, jul: 7,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

/**
 * Month words that are ordinary English first and months second.
 *
 * "May I ask", "I march to campus", "an august occasion". These are only read
 * as months when something else in the sentence makes a date reading likely.
 */
const AMBIGUOUS_MONTHS = { may: 5, march: 3, mar: 3, august: 8, aug: 8 };

/** Readings that are definitely not a month, removed before anything else. */
const NOT_A_MONTH = [
  // The modal verb, which is the single most common false positive.
  /\bmay\s+(?:i|we|you|he|she|it|they|be|been|being|have|has|had|not|never|also|still|well|need|needs|want|wants|wish|get|take|seem|seems|appear|appears|include|includes|vary|differ|contain|contains|affect|affects|help|apply|applies|change|exist|explain|look|mean|make|result)\b/g,
  // Marching, not March.
  /\bmarch(?:es|ed|ing)\b/g,
  /\bmarch\s+(?:on|to|into|past|through|up|down|against|with|alongside)\b/g,
  // "an august institution"
  /\b(?:an|the|most|very|truly)\s+august\b/g,
];

/**
 * Words that make a nearby ambiguous word read as a date.
 * "in March", "my May spending", "compared with August".
 */
const DATE_LEAD = /(?:^|\b)(?:in|for|during|of|since|from|to|with|between|through|until|till|after|before|vs|versus|than|compare|compared|comparing|comparison|my|last|this|early|late|mid|back\s+in|month\s+of)\s+$/;
const DATE_TRAIL = /^\s*(?:\d{1,4}\b|(?:spending|spend|spent|expenses?|total|totals|purchases?|transactions?|bills?|budget|figures?)\b)/;

/** Quoted text is a description term the user typed, never a period. */
const stripQuoted = (text) => String(text ?? '').replace(/[“"'][^”"']*[”"']/g, ' ');

/**
 * Month numbers (1-12) the question explicitly names.
 * @returns {Set<number>}
 */
export function mentionedMonths(message) {
  const found = new Set();
  let text = stripQuoted(message).toLocaleLowerCase('en-SG');

  // ISO dates are unambiguous, so take them before any word-level guessing.
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) found.add(month);
  }
  text = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');

  // Remove the readings that are definitely not months.
  for (const pattern of NOT_A_MONTH) text = text.replace(pattern, ' ');

  for (const [word, month] of Object.entries(PLAIN_MONTHS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) found.add(month);
  }

  for (const [word, month] of Object.entries(AMBIGUOUS_MONTHS)) {
    const pattern = new RegExp(`\\b${word}\\b`, 'g');
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(0, match.index);
      const after = text.slice(match.index + word.length);
      if (DATE_LEAD.test(before) || DATE_TRAIL.test(after)) { found.add(month); break; }
    }
  }

  return found;
}

/** Month numbers covered by a list of inclusive `{start, end}` ranges. */
export function coveredMonths(ranges = []) {
  const covered = new Set();
  for (const range of ranges) {
    if (!range?.start || !range?.end || range.end < range.start) continue;
    let cursor = `${range.start.slice(0, 7)}-01`;
    const limit = range.end.slice(0, 7);
    // Bounded: at most one step per calendar month in the range.
    for (let guard = 0; guard < 4000; guard += 1) {
      const ym = cursor.slice(0, 7);
      covered.add(Number(ym.slice(5, 7)));
      if (ym >= limit) break;
      const next = new Date(`${cursor}T00:00:00Z`);
      next.setUTCMonth(next.getUTCMonth() + 1);
      cursor = `${next.toISOString().slice(0, 7)}-01`;
    }
  }
  return covered;
}

/**
 * The months a question names that none of its resolved ranges touch.
 *
 * Compared by month NUMBER, not year: someone saying "September" almost always
 * means the most recent one, and demanding a year match would refuse questions
 * the app answers correctly. Leniency here costs nothing — a missed conflict
 * leaves today's behaviour unchanged, while a false conflict refuses real work.
 *
 * @returns {number[]} sorted, empty when there is no conflict
 */
export function uncoveredMentionedMonths(message, ranges = []) {
  const mentioned = mentionedMonths(message);
  if (!mentioned.size) return [];
  const covered = coveredMonths(ranges);
  return [...mentioned].filter((month) => !covered.has(month)).sort((a, b) => a - b);
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export const monthName = (month) => MONTH_NAMES[month - 1] ?? String(month);
