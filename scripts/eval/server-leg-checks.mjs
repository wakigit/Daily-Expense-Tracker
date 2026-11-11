/**
 * The SERVER leg, replayed from captured model plans. Zero paid calls.
 *
 * Why this file exists. On 2026-11-10 the bounded-plan question
 * `what share of my last 90 days spending was at "…"?` answered live at
 * 02:52Z and was refused live at 12:21Z with `plan_complete_request_required`.
 * Diagnosing it replayed `auditPlanRequest` → `validateIntent` → `executePlan`
 * — the CLIENT chain — which accepted the captured plan and computed the right
 * figure, so the refusal was attributed first to model variance and then to a
 * suspected server regression. Neither was measured, because **nothing drove
 * `backend/src/routes.js::handleIntent` with a captured plan.** The mock
 * browser matrix cannot close that gap either: `mockPlanIntent` IS the
 * recognizer, so it can never produce a model/recognizer field difference.
 *
 * A bisect through this replay settled it: the captured plan is refused at
 * `6ebbcac` with `plan_request_coverage` and accepted from `79ed805` onward,
 * `24e6475` included. The server leg was not regressed. What was missing was
 * the measurement, and this is it.
 *
 * Every case stubs the provider request function, so the real transport is
 * never constructed and no key is read. The assertions are on the TYPED route
 * result — status, intent type, reason — never on rendered text.
 */

import { handleIntent } from '../../backend/src/routes.js';
import { buildContext } from '../../src/lib/intent.js';
import { recognizePlanRequest } from '../../src/lib/planRequest.js';

/** Full provider query shape; derived cents deliberately absent. */
const planStep = (patch = {}) => ({
  operation: 'total', comparison: null, period: 'month', dayCount: null, start: null, end: null,
  category: null, categories: [], descriptionTerms: [], description: null,
  amountOperator: null, amount: null, day: 'all', groupBy: null, aggregate: 'total',
  spendingScope: null, category_terms: [], ...patch,
});
const percentOf = (numerator, denominator) =>
  [{ id: 'd1', operation: 'percent_of', numerator: { step: numerator, field: 'totalCents' }, denominator: { step: denominator, field: 'totalCents' } }];
const twoStep = (q1, q2, derived = percentOf('q2', 'q1')) =>
  ({ version: 1, steps: [{ id: 'q1', query: q1 }, { id: 'q2', query: q2 }], derived });
/** The nine-key closed intent envelope `validatePlanIntent` requires. */
const intentEnvelope = (patch) => ({
  type: null, plan: null, say: null, query: null, expense: null,
  filter: null, scope: null, question: null, options: null, ...patch,
});
const planIntent = (plan) => intentEnvelope({ type: 'plan', plan });
const analyzeIntent = (query) => intentEnvelope({ type: 'analyze', query });

/* ── The real capture, verbatim ──────────────────────────────────── */

/**
 * CAP-2, the raw plan `gpt-4.1-mini` returned for the RECHECK-3 sentence at
 * 2026-11-10T12:30:54Z, byte-identical to CAP-3. It differs from the plan the
 * local grammar recognises in exactly two fields — `q2.descriptionTerms` is
 * `["Popular bookstore"]` where the recognizer writes `q2.description`. One
 * scope, two encodings; `79ed805` folded them, and this is the plan that
 * proves the fold holds on the server leg too.
 *
 * Re-measured live on 2026-11-11 with the live context shape (expenseCount 6):
 * 2 paid calls, both returning this same encoding, both accepted 200/plan.
 */
const CAPTURED = {
  message: 'what share of my last 90 days spending was at "Popular bookstore"?',
  today: '2026-11-10',
  cats: [{ id: 'canteen', label: 'Canteen Meals' }, { id: 'busmrt', label: 'Bus & MRT' }, { id: 'labkit', label: 'Lab Supplies' }],
  expenseCount: 6,
  plan: twoStep(
    planStep({ period: 'last_days', dayCount: 90 }),
    planStep({ period: 'last_days', dayCount: 90, descriptionTerms: ['Popular bookstore'] }),
  ),
};

/* ── Fresh fictional fixture for the regressions ─────────────────── */

/** New categories, new merchant, new reference date: independent of every
    other fixture in this repository, and of the capture above. */
const CATS = [{ id: 'studio', label: 'Pottery Studio' }, { id: 'rail', label: 'Rail Pass' }, { id: 'stationery', label: 'Stationery' }];
const TODAY = '2027-04-18';
const SHARE = 'what share of my last 60 days spending was at "Inkwell depot"?';
const BREAKDOWN = 'What share of my spending this month went to each category?';
const UNPARSEABLE = 'What share of my spending this month went to each category, and what was my biggest single purchase?';
const sixty = (patch = {}) => planStep({ period: 'last_days', dayCount: 60, ...patch });
const DEPOT = 'Inkwell depot';

/** A breakdown query is not a plan step; this is the ordinary query shape. */
const analyzeQuery = (patch = {}) => ({
  operation: 'breakdown', period: 'month', start: null, end: null, dayCount: null,
  category: null, description: null, amountOperator: null, amount: null, day: 'all',
  groupBy: 'category', aggregate: 'total', comparison: null,
  categories: [], descriptionTerms: [], spendingScope: null, category_terms: [], ...patch,
});

/**
 * One question through the REAL route with a stubbed provider.
 * Returns the typed verdict plus how many times the stub was consulted.
 */
async function serverLeg({ message, today, cats, expenseCount = 0, raw }) {
  const context = buildContext({ cats, today, expenses: Array.from({ length: expenseCount }, (_, i) => ({ id: `f${i + 1}`, date: today, category: cats[0].id, description: 'fixture row', amount: 1, notes: '' })) });
  let calls = 0;
  const result = await handleIntent({ message, context }, { request: async () => { calls += 1; return structuredClone(raw); } });
  return {
    calls,
    status: result.status,
    type: result.body.intent?.type ?? null,
    reason: result.body.intent?.reason ?? result.body.error ?? null,
    field: result.body.detail?.field ?? null,
    hasPlan: Boolean(result.body.intent?.plan),
    hasQuery: Object.hasOwn(result.body.intent ?? {}, 'query'),
  };
}

export async function serverLegChecks(ok) {
  /* The captured plan, through the server route. This is the case that was
     refused live, and the one the bisect pinned to 79ed805. */
  const captured = await serverLeg({ ...CAPTURED, raw: planIntent(CAPTURED.plan) });
  ok('server leg: the captured CAP-2 plan is accepted as a plan',
    captured.status === 200 && captured.type === 'plan' && captured.hasPlan,
    `${captured.status} ${captured.type} ${captured.reason ?? ''}`);
  ok('server leg: the captured plan reached the route through exactly one stubbed provider call',
    captured.calls === 1, `stub consulted ${captured.calls} time(s)`);
  ok('server leg: the capture really does differ from the recognizer, or it proves nothing',
    (() => {
      const rec = recognizePlanRequest(CAPTURED.message, { cats: CAPTURED.cats, today: CAPTURED.today });
      if (!rec.ok) return false;
      const model = CAPTURED.plan.steps[1].query, local = rec.plan.steps[1].query;
      return model.description === null && model.descriptionTerms.length === 1
        && local.description === 'Popular bookstore' && local.descriptionTerms.length === 0;
    })(),
    'the fixture must keep the two-field encoding difference the fold exists to tolerate');

  /* Same shape, fresh fictional vocabulary, both literal-description
     encodings. Either is one scope written two ways and both must pass. */
  for (const [label, q2] of [
    ['list encoding', sixty({ descriptionTerms: [DEPOT] })],
    ['scalar encoding', sixty({ description: DEPOT })],
  ]) {
    const got = await serverLeg({ message: SHARE, today: TODAY, cats: CATS, expenseCount: 4, raw: planIntent(twoStep(sixty(), q2)) });
    ok(`server leg: a fresh literal-description share is accepted with the ${label}`,
      got.status === 200 && got.type === 'plan', `${got.status} ${got.type} ${got.reason ?? ''}`);
  }

  /* Refusals that must stay refusals. Each is a plan the audit cannot match
     to the recognised request, and each must clarify the WHOLE request with
     the one typed reason and no query. */
  for (const [label, plan] of [
    ['a model-resolved explicit range instead of the requested relative window',
      twoStep(planStep({ period: 'range', start: '2027-02-18', end: '2027-04-18' }),
        planStep({ period: 'range', start: '2027-02-18', end: '2027-04-18', descriptionTerms: [DEPOT] }))],
    ['the steps in the opposite order',
      twoStep(sixty({ descriptionTerms: [DEPOT] }), sixty(), percentOf('q1', 'q2'))],
    ['a truncated literal term', twoStep(sixty(), sixty({ descriptionTerms: ['Inkwell'] }))],
    ['the merchant mapped onto a category', twoStep(sixty(), sixty({ category: 'stationery', category_terms: ['Stationery'] }))],
    ['a day filter the question never asked for', twoStep(sixty(), sixty({ descriptionTerms: [DEPOT], day: 'weekday' }))],
    ['the denominator narrowed by the same merchant', twoStep(sixty({ descriptionTerms: [DEPOT] }), sixty({ descriptionTerms: [DEPOT] }))],
  ]) {
    const got = await serverLeg({ message: SHARE, today: TODAY, cats: CATS, expenseCount: 4, raw: planIntent(plan) });
    ok(`server leg: refuses ${label}`,
      got.status === 200 && got.type === 'clarify' && got.reason === 'plan_complete_request_required' && !got.hasPlan && !got.hasQuery,
      `${got.status} ${got.type} ${got.reason ?? ''}`);
  }

  /* The anti-partial guard, through the server leg, both ways. */
  const oneSided = await serverLeg({ message: SHARE, today: TODAY, cats: CATS, expenseCount: 4,
    raw: analyzeIntent(analyzeQuery({ operation: 'total', groupBy: null, period: 'last_days', dayCount: 60, descriptionTerms: [DEPOT] })) });
  ok('server leg: a one-sided scalar total for a share question is refused with no query',
    oneSided.status === 200 && oneSided.type === 'clarify'
    && oneSided.reason === 'plan_complete_request_required' && !oneSided.hasQuery,
    `${oneSided.status} ${oneSided.type} ${oneSided.reason ?? ''}`);

  const unparseable = await serverLeg({ message: UNPARSEABLE, today: TODAY, cats: CATS, expenseCount: 4,
    raw: analyzeIntent(analyzeQuery({ operation: 'largest', groupBy: null })) });
  ok('server leg: an unparseable multi-part share question is refused a scalar answer',
    unparseable.status === 200 && unparseable.type === 'clarify'
    && unparseable.reason === 'plan_complete_request_required' && !unparseable.hasQuery,
    `${unparseable.status} ${unparseable.type} ${unparseable.reason ?? ''}`);

  /* M69, through the server leg: a COMPLETE breakdown answers the whole
     question and must still come back as an analyze answer. */
  const complete = await serverLeg({ message: BREAKDOWN, today: TODAY, cats: CATS, expenseCount: 4, raw: analyzeIntent(analyzeQuery()) });
  ok('server leg: M69 — a complete category breakdown still answers a recognised share question',
    complete.status === 200 && complete.type === 'analyze', `${complete.status} ${complete.type} ${complete.reason ?? ''}`);
  const narrowed = await serverLeg({ message: BREAKDOWN, today: TODAY, cats: CATS, expenseCount: 4, raw: analyzeIntent(analyzeQuery({ category: 'studio', category_terms: ['Pottery Studio'] })) });
  ok('server leg: a breakdown narrowed to one category is still refused',
    narrowed.status === 200 && narrowed.type === 'clarify' && narrowed.reason === 'plan_complete_request_required',
    `${narrowed.status} ${narrowed.type} ${narrowed.reason ?? ''}`);

  /* A plan the contract rejects outright must stay a server-side 502, never a
     semantic clarification: an invalid intent must not leave the server. */
  const invalid = await serverLeg({ message: SHARE, today: TODAY, cats: CATS, expenseCount: 4,
    raw: planIntent(twoStep(sixty(), sixty({ descriptionTerms: [DEPOT], category_terms: [DEPOT] }))) });
  ok('server leg: category metadata naming a merchant is an invalid intent, not a clarification',
    invalid.status === 502 && invalid.reason === 'invalid_intent' && invalid.field === 'plan',
    `${invalid.status} ${invalid.reason ?? ''} ${invalid.field ?? ''}`);
}
