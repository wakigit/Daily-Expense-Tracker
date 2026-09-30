/**
 * "Was it worth it?" — optional per-expense reactions, and the maths that
 * turns them into an insight.
 *
 * This is the feature that separates a ledger from something that changes
 * behaviour: knowing you spent S$48 on late-night food is accounting; knowing
 * you regretted S$48 of it is a reason to stop.
 *
 * Pure functions only, so they can be tested in Node without React or a DOM.
 */

export const WORTH_OPTIONS = [
  { id: 'yes', emoji: '😍', label: 'Worth it' },
  { id: 'meh', emoji: '😐', label: 'Meh' },
  { id: 'no',  emoji: '😩', label: 'Regret' },
];

const VALID = new Set(WORTH_OPTIONS.map((o) => o.id));

/** Untagged is not a verdict. Anything unrecognised counts as untagged. */
export const isTagged = (expense) => VALID.has(expense?.worth);

export const worthLabel = (id) => WORTH_OPTIONS.find((o) => o.id === id)?.label ?? '';

/**
 * Every figure here is computed against TAGGED expenses only. Counting
 * untagged rows as "not regretted" would quietly inflate the happy number
 * and make the whole card a lie.
 */
export function worthStats(expenses = [], catById) {
  const tagged = expenses.filter(isTagged);

  const totals = { yes: 0, meh: 0, no: 0 };
  const counts = { yes: 0, meh: 0, no: 0 };
  for (const e of tagged) {
    totals[e.worth] += Number(e.amount) || 0;
    counts[e.worth] += 1;
  }

  const taggedTotal = totals.yes + totals.meh + totals.no;

  // Which category carries the most regret, by amount.
  const byCat = {};
  for (const e of tagged) {
    if (e.worth !== 'no') continue;
    byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0);
  }
  const top = Object.entries(byCat).sort(([, a], [, b]) => b - a)[0];
  const topRegret = top
    ? {
        id: top[0],
        label: catById?.(top[0])?.label ?? 'Uncategorised',
        color: catById?.(top[0])?.color ?? '#888',
        amount: top[1],
        share: totals.no > 0 ? top[1] / totals.no : 0,
      }
    : null;

  return {
    tagged,
    taggedCount: tagged.length,
    untaggedCount: expenses.length - tagged.length,
    counts,
    totals,
    taggedTotal,
    regretTotal: totals.no,
    // Share of tagged SPEND regretted, not share of tagged rows — one
    // regretted S$200 matters more than three regretted S$2 coffees.
    regretRate: taggedTotal > 0 ? totals.no / taggedTotal : 0,
    topRegret,
  };
}
