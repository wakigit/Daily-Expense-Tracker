/**
 * Asserts that the harness READS the application correctly.
 *
 * Everything else in this directory checks the application against the oracle.
 * Nothing checked the piece in between — `actual-figures.mjs`, which turns an
 * application answer into the figures `run.mjs` scores. That gap is not
 * hypothetical: the reader looked for the `current` comparison side key alone,
 * so it silently reported every EXPLICIT comparison as a weekday/weekend split
 * with undefined totals, and no gate could see it.
 *
 * The MAIN replay still cannot see it. M67's stored recording is a stale HTTP
 * 502, so the replay falls back offline, and `scoreTurn` returns at the offline
 * branch before any figure is compared. A numeric M67 expectation therefore
 * proves nothing on its own. This file is what proves it, and it needs no
 * recording, no provider and no paid call:
 *
 *   the real app path  ->  actual-figures.mjs  ->  the independent oracle
 *
 * The same gap existed one layer out. Nothing drove `handleIntent` — the
 * SERVER route — with a captured model plan, so a plan the client chain
 * accepts could still be refused before the browser saw it and no gate could
 * see that either. `server-leg-checks.mjs` closes it and runs from here.
 *
 * Questions are driven through `interpretOffline` + `executeQuery`, the app's
 * own local path and the same two functions `run.mjs` falls back to. One
 * question the offline recognizer deliberately declines states its query
 * directly instead; that is contract, not a figure, and it is marked where it
 * happens. The expectations come from `questions.js`, which imports nothing
 * from src/.
 *
 *   npm run eval:harness-checks
 */

import { interpretOffline } from '../../src/lib/queryOffline.js';
import { executeQuery } from '../../src/lib/queryEngine.js';

import { actualFigures, COMPARISON_HEAD_KEYS } from './actual-figures.mjs';
import { serverLegChecks } from './server-leg-checks.mjs';
import { MAIN } from './questions.js';
import { fixtureContext } from './fixture.js';

let failures = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`PASS  ${label}`); return; }
  failures += 1;
  console.log(`FAIL  ${label}${detail ? `  — ${detail}` : ''}`);
}
const sameIds = (a = [], b = []) => a.length === b.length && a.every((id, i) => id === b[i]);
const sameRange = (a, b) => Boolean(a && b) && a.start === b.start && a.end === b.end;

const ledger = fixtureContext();
const question = (id) => {
  const found = MAIN.find((q) => q.id === id);
  if (!found) throw new Error(`${id} is no longer in MAIN; this check must be updated deliberately, not deleted.`);
  return found;
};

/** One question through the application's own local path. No network, ever. */
function appAnswer(text) {
  const parsed = interpretOffline(text, ledger.cats, ledger.today);
  if (!parsed.query) return { error: `interpretOffline produced no query (kind ${parsed.kind})` };
  const reply = executeQuery(parsed.query, { ...ledger, message: text });
  if (reply.kind !== 'answer') return { error: `executeQuery returned ${reply.kind}: ${reply.question ?? reply.text ?? ''}` };
  return { plan: reply, query: parsed.query };
}

/* ── Two-sided comparisons, read against the independent oracle ──── */

/**
 * The whole point of the `first`/`second` work: an explicit two-sided
 * descriptor and an ordinary implicit comparison use different side keys, and
 * both must land in the same two expectation slots in asked order.
 */
for (const { id, vocabulary } of [
  { id: 'M67', vocabulary: 'first/second (two explicitly named calendar months)' },
  { id: 'M76', vocabulary: 'current/earlier (implicit this month versus last)' },
]) {
  const q = question(id);
  const expect = q.expect;
  const label = `${id} ${vocabulary}`;

  if (!expect || expect.shape !== 'compare') {
    ok(`${label}: still carries a numeric compare expectation`, false,
      `expect shape is ${expect?.shape ?? 'absent'}; a comparison without figures is the gap this file exists to close`);
    continue;
  }

  const { plan, query, error } = appAnswer(q.text);
  if (error) { ok(`${label}: the app answers it locally`, false, error); continue; }

  const sides = plan.comparison?.sides ?? [];
  ok(`${label}: the app leads with a side key the reader knows`,
    COMPARISON_HEAD_KEYS.includes(sides[0]?.key),
    `sides are [${sides.map((s) => s.key).join(', ')}], reader knows [${COMPARISON_HEAD_KEYS.join(', ')}]`);

  const got = actualFigures(plan);
  ok(`${label}: reads as a comparison, not a day-type split`, got.shape === 'compare', `read as "${got.shape}"`);
  ok(`${label}: first side range`, sameRange(got.current?.range, expect.current.range),
    `${got.current?.range?.start}..${got.current?.range?.end} vs ${expect.current.range.start}..${expect.current.range.end}`);
  ok(`${label}: second side range`, sameRange(got.earlier?.range, expect.earlier.range),
    `${got.earlier?.range?.start}..${got.earlier?.range?.end} vs ${expect.earlier.range.start}..${expect.earlier.range.end}`);
  ok(`${label}: first side total`, got.current?.totalCents === expect.current.totalCents,
    `${got.current?.totalCents} vs ${expect.current.totalCents} cents`);
  ok(`${label}: second side total`, got.earlier?.totalCents === expect.earlier.totalCents,
    `${got.earlier?.totalCents} vs ${expect.earlier.totalCents} cents`);
  ok(`${label}: difference is signed first minus second`, got.differenceCents === expect.differenceCents,
    `${got.differenceCents} vs ${expect.differenceCents} cents`);
  ok(`${label}: first side evidence rows`, sameIds(got.current?.ids ?? [], expect.current.evidenceIds),
    `[${(got.current?.ids ?? []).join(' ')}] vs [${expect.current.evidenceIds.join(' ')}]`);
  ok(`${label}: second side evidence rows`, sameIds(got.earlier?.ids ?? [], expect.earlier.evidenceIds),
    `[${(got.earlier?.ids ?? []).join(' ')}] vs [${expect.earlier.evidenceIds.join(' ')}]`);

  /* Totals that match for the wrong reason are the failure this catches: a
     side can agree on cents while having selected a different window. */
  const sumOf = (ids) => ids.reduce((n, rowId) => {
    const row = ledger.expenses.find((e) => e.id === rowId);
    return n + Math.round(Number(row?.amount ?? 0) * 100 + 1e-9);
  }, 0);
  ok(`${label}: each side's total is the sum of the rows it names`,
    sumOf(got.current?.ids ?? []) === got.current?.totalCents
      && sumOf(got.earlier?.ids ?? []) === got.earlier?.totalCents,
    `${sumOf(got.current?.ids ?? [])}/${got.current?.totalCents} and ${sumOf(got.earlier?.ids ?? [])}/${got.earlier?.totalCents}`);

  ok(`${label}: the app ran a compare operation`, query?.operation === 'compare', `operation ${query?.operation}`);
}

/* ── The day-type split the reader used to confuse these with ───── */

{
  /* M33 cannot go through `interpretOffline`: the offline recognizer
     deliberately clarifies on a day-type question rather than guessing, so
     this one query is stated here. The query is contract — the same canonical
     shape the server validates — while every figure below still comes from the
     real engine on one side and the independent oracle on the other. */
  const q = question('M33');
  const dayTypeQuery = {
    operation: 'day_types', period: 'year', start: null, end: null, dayCount: null,
    category: null, description: null, amountOperator: null, amount: null, amountCents: null,
    day: 'all', groupBy: null, aggregate: 'total', comparison: null,
    categoryTerms: [], categories: [], descriptionTerms: [], spendingScope: null,
  };
  const reply = executeQuery(dayTypeQuery, { ...ledger, message: q.text });
  if (reply.kind !== 'answer') {
    ok('M33 weekday/weekend: the app answers a day-type query', false, `${reply.kind}: ${reply.question ?? reply.text ?? ''}`);
  } else {
    const got = actualFigures(reply);
    ok('M33 weekday/weekend: still reads as a day-type split', got.shape === 'day_types', `read as "${got.shape}"`);
    ok('M33 weekday/weekend: weekday total', got.weekday?.totalCents === q.expect.weekday.totalCents,
      `${got.weekday?.totalCents} vs ${q.expect.weekday.totalCents} cents`);
    ok('M33 weekday/weekend: weekend total', got.weekend?.totalCents === q.expect.weekend.totalCents,
      `${got.weekend?.totalCents} vs ${q.expect.weekend.totalCents} cents`);
    ok('M33 weekday/weekend: weekday calendar days', got.weekday?.calendarDays === q.expect.weekday.calendarDays,
      `${got.weekday?.calendarDays} vs ${q.expect.weekday.calendarDays}`);
    ok('M33 weekday/weekend: weekend calendar days', got.weekend?.calendarDays === q.expect.weekend.calendarDays,
      `${got.weekend?.calendarDays} vs ${q.expect.weekend.calendarDays}`);
  }
}

/* ── The silent mis-read itself, as a regression ─────────────────── */

const side = (key, start, end, totalCents, ids) => ({
  key, start, end, totalCents, count: ids.length, calendarDays: 30,
  evidence: { rows: ids.map((id) => ({ id, amount: 1 })) },
});
const comparisonPlan = (sides) => ({
  kind: 'answer', intent: 'compare',
  interpretation: { period: `${sides[0].start} to ${sides[0].end} vs ${sides[1].start} to ${sides[1].end}` },
  comparison: { sides, differenceCents: sides[0].totalCents - sides[1].totalCents },
});

{
  /* The exact bug: a first/second plan read as a weekday/weekend split
     reported `undefined` for every figure and failed with a shape complaint
     that named the wrong cause. */
  const got = actualFigures(comparisonPlan([
    side('first', '2026-09-01', '2026-09-30', 14840, ['a1', 'a2']),
    side('second', '2026-07-01', '2026-07-31', 105239, ['b1']),
  ]));
  ok('a synthetic first/second plan is a comparison', got.shape === 'compare', `read as "${got.shape}"`);
  ok('a synthetic first/second plan keeps asked order',
    got.current?.totalCents === 14840 && got.earlier?.totalCents === 105239,
    `${got.current?.totalCents} then ${got.earlier?.totalCents}`);
  ok('a synthetic first/second plan signs first minus second', got.differenceCents === 14840 - 105239,
    String(got.differenceCents));
  ok('a synthetic first/second plan reports no undefined figure',
    [got.current?.totalCents, got.earlier?.totalCents, got.differenceCents].every((n) => typeof n === 'number'));
}

{
  /* A vocabulary the reader does not know must be NAMED, not quietly folded
     into one of the shapes above. A named shape fails run.mjs's shape check
     with its own keys in the message; `day_types` full of `undefined` does
     not. This is what stops the original bug recurring under a new key. */
  const got = actualFigures(comparisonPlan([
    side('alpha', '2026-09-01', '2026-09-30', 100, ['a1']),
    side('beta', '2026-07-01', '2026-07-31', 200, ['b1']),
  ]));
  ok('an unknown side vocabulary is named rather than mis-read',
    got.shape === 'unknown_comparison(alpha+beta)', `read as "${got.shape}"`);
  ok('an unknown side vocabulary claims no figures',
    got.current === undefined && got.weekday === undefined,
    `current ${JSON.stringify(got.current)}, weekday ${JSON.stringify(got.weekday)}`);
}

/* ── The server leg, replayed from captured plans ────────────────── */

await serverLegChecks(ok);

console.log(failures ? `\n${failures} HARNESS CHECK(S) FAILED` : '\nAll harness checks passed.');
process.exit(failures ? 1 : 0);
