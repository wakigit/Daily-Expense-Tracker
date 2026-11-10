/**
 * Reading figures back out of an application answer.
 *
 * Its own module so it can be exercised by the deterministic suite rather than
 * only by a full replay. That matters: this file quietly mis-read every
 * EXPLICIT comparison as a weekday/weekend split for as long as it looked for
 * the `current` side key alone, and no test could see it because the only
 * question that would have caught it had no numeric expectation.
 *
 * It reads the application's own typed output. It computes nothing the
 * application did not already compute, and it never consults the oracle.
 */
import { extractPlanResult } from './plan-results.mjs';

/* Only `actualFigures` and the side-key list are another file's business.
   The row helpers and the interpretation-string parser are this reader's
   internals; exporting them would invite a second caller to read figures some
   other way, which is the shape of problem this module exists to prevent. */

/** The side keys an explicit or implicit two-sided comparison leads with. */
export const COMPARISON_HEAD_KEYS = ['current', 'first'];

const sortIds = (rows = []) => rows.map((row) => row.id).slice().sort();
const sumRows = (rows = []) => rows.reduce((n, row) => n + Math.round(Number(row.amount) * 100 + 1e-9), 0);

/** Parse the resolved range the app reports in its own interpretation string. */
function reportedRange(plan) {
  const text = plan?.interpretation?.period ?? '';
  const single = text.match(/^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
  if (single) return { start: single[1], end: single[2] };
  const versus = text.match(/^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2}) vs (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
  if (versus) return { start: versus[1], end: versus[2], earlier: { start: versus[3], end: versus[4] } };
  return null;
}

export function actualFigures(plan) {
  if (plan.planResult) return extractPlanResult(plan);
  const out = { range: reportedRange(plan), text: plan.text };
  if (plan.breakdown) {
    out.shape = 'breakdown';
    out.totalCents = plan.breakdown.totalCents;
    out.count = plan.breakdown.count;
    out.groups = plan.breakdown.groups.map((g) => ({ key: g.key, totalCents: g.totalCents, count: g.count, ids: sortIds(g.evidence?.rows) }));
    out.ids = plan.breakdown.groups.flatMap((g) => sortIds(g.evidence?.rows)).slice().sort();
    return out;
  }
  if (plan.comparison?.sides) {
    const sides = plan.comparison.sides;
    /* Three side vocabularies reach this point, and `src/lib/comparison.js`
       plus `src/lib/queryEngine.js` are the only places that mint them:

         current/earlier   an ordinary implicit comparison
         first/second      an explicit two-sided descriptor — named months,
                           date ranges, or two categories — in the order the
                           question asked for them, with the difference signed
                           the same way (sides[0] minus sides[1])
         weekday/weekend   a day-type split

       Reading only current/earlier left every explicit comparison mis-read as
       a weekday/weekend split with undefined totals, which is why M67 had no
       numeric oracle. So the third branch no longer assumes: an unrecognised
       vocabulary is NAMED, and a named shape fails the shape check in
       run.mjs loudly instead of reporting undefined figures. The expectation
       slots stay current/earlier and are filled positionally, so an explicit
       expectation states its sides in asked order. */
    if (sides.length === 2 && COMPARISON_HEAD_KEYS.includes(sides[0].key)) {
      out.shape = 'compare';
      out.current = { range: { start: sides[0].start, end: sides[0].end }, totalCents: sides[0].totalCents, ids: sortIds(sides[0].evidence?.rows) };
      out.earlier = { range: { start: sides[1].start, end: sides[1].end }, totalCents: sides[1].totalCents, ids: sortIds(sides[1].evidence?.rows) };
      out.differenceCents = plan.comparison.differenceCents;
    } else if (sides.some((s) => s.key === 'weekday')) {
      out.shape = 'day_types';
      const weekday = sides.find((s) => s.key === 'weekday');
      const weekend = sides.find((s) => s.key === 'weekend');
      out.weekday = { totalCents: weekday?.totalCents, calendarDays: weekday?.calendarDays, ids: sortIds(weekday?.evidence?.rows) };
      out.weekend = { totalCents: weekend?.totalCents, calendarDays: weekend?.calendarDays, ids: sortIds(weekend?.evidence?.rows) };
    } else {
      out.shape = `unknown_comparison(${sides.map((s) => s.key).join('+')})`;
    }
    return out;
  }
  if (plan.budgetEvidence) {
    out.shape = 'projection';
    out.budgetCents = plan.budgetEvidence.amountCents;
    out.spentCents = sumRows(plan.evidence?.rows);
    out.remainingCents = out.budgetCents - out.spentCents;
    out.ids = sortIds(plan.evidence?.rows);
    return out;
  }
  out.shape = plan.intent ?? 'total';
  out.ids = sortIds(plan.evidence?.rows);
  out.totalCents = sumRows(plan.evidence?.rows);
  out.count = plan.evidence?.rows?.length ?? 0;
  return out;
}

