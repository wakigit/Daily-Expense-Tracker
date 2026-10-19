/**
 * The evaluation harness.
 *
 * Drives the REAL application path, not a reimplementation of it. Each turn
 * goes through the same sequence `src/App.jsx::askQuestion` uses:
 *
 *   1. resolveFollowup against the live session context (Stage 3). A handled
 *      follow-up never reaches the network, which is why a chain costs fewer
 *      paid calls than it has turns.
 *   2. requestIntent -> POST /assistant/intent -> server-side validateIntent
 *      -> client-side validateIntent again.
 *   3. propose_scope goes through previewSpendingScope, and the harness then
 *      simulates a person approving exactly the proposal that came back
 *      (Stage 4) via confirmSpendingScope.
 *   4. everything else goes through planFromIntent -> executeQuery.
 *   5. a failed request falls back to interpretOffline, exactly as the app does.
 *
 * Scoring is against `expected.js`, which shares no code with the application.
 *
 * Root-cause attribution is diagnostic rather than guessed. For every answer
 * the harness ALSO recomputes the oracle figure for the query the application
 * actually ran. That separates two failures that look identical in a total:
 *   - right arithmetic on the wrong question  -> interpretation
 *   - wrong arithmetic on the right question  -> engine
 * The same split applies to ranges (interpretation vs dates).
 *
 * Recording happens at the HTTP boundary, so `--mock` replays the recorded
 * response through the identical client-side validation and execution path.
 * That is what makes a mock run reproduce a live score instead of
 * approximating it.
 *
 *   node .eval-build/run.js                      # live, records
 *   node .eval-build/run.js --mock               # replay, zero paid calls
 *   node .eval-build/run.js --only M01,M17
 *   node .eval-build/run.js --holdout            # Step 6 only
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { requestIntent, explainIntentFailure } from '../../src/lib/assistantClient.js';
import { planFromIntent } from '../../src/lib/assistant.js';
import { executeQuery } from '../../src/lib/queryEngine.js';
import { interpretOffline } from '../../src/lib/queryOffline.js';
import { previewSpendingScope, confirmSpendingScope } from '../../src/lib/spendingScope.js';
import { resolveFollowup, createAssistantSession } from '../../src/lib/assistantFollowup.js';

import { MAIN, HOLDOUT } from '../../scripts/eval/questions.js';
import { fixtureContext, TODAY } from '../../scripts/eval/fixture.js';
import * as O from '../../scripts/eval/expected.js';

/* ── Paths ───────────────────────────────────────────────────────── */

const EVAL_DIR = resolve(process.cwd(), 'scripts/eval');
const p = (name) => resolve(EVAL_DIR, name);

/* ── Arguments ───────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const MOCK = argv.includes('--mock');
const HOLD = argv.includes('--holdout');
const onlyAt = argv.indexOf('--only');
const ONLY = onlyAt >= 0 ? (argv[onlyAt + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : null;
const noteAt = argv.indexOf('--note');
const NOTE = noteAt >= 0 ? argv[noteAt + 1] : null;
const labelAt = argv.indexOf('--label');
const LABEL = labelAt >= 0 ? argv[labelAt + 1] : (HOLD ? 'holdout' : 'baseline');
const ENDPOINT = 'http://127.0.0.1:8787';

const SET = HOLD ? HOLDOUT : MAIN;
const questions = ONLY ? SET.filter((q) => ONLY.includes(q.id)) : SET;

const RECORDING_FILE = p(HOLD ? 'recorded-intents-holdout.json' : 'recorded-intents.json');

/* ── Transport: real fetch that records, or replay that does not call ── */

let paidCalls = 0;
let httpCalls = 0;
const recording = MOCK && existsSync(RECORDING_FILE)
  ? JSON.parse(readFileSync(RECORDING_FILE, 'utf8'))
  : {};
const fresh = {};

function transportFor(key) {
  if (MOCK) {
    return async () => {
      const saved = recording[key];
      if (!saved) {
        // A missing recording must not silently become a different result.
        return { ok: false, status: 599, json: async () => ({ error: 'no_recorded_response' }) };
      }
      return { ok: saved.status >= 200 && saved.status < 300, status: saved.status, json: async () => saved.body };
    };
  }
  return async (url, init) => {
    httpCalls += 1;
    const res = await fetch(url, init);
    const status = res.status;
    const body = await res.json().catch(() => null);
    fresh[key] = { status, body };
    /* A 400 is refused by the route before the provider is consulted, so it
       costs nothing. Anything else got past that guard, and the client already
       short-circuits every message the server would answer locally, so it
       reached the model. */
    if (status !== 400) paidCalls += 1;
    return { ok: res.ok, status, json: async () => body };
  };
}

/* ── Translating an app query into an oracle spec ─────────────────── */

const oracleSpec = (q) => ({
  period: q.period,
  dayCount: q.dayCount ?? null,
  start: q.start ?? null,
  end: q.end ?? null,
  category: q.category ?? null,
  description: q.description ?? null,
  day: q.day ?? 'all',
  amountOperator: q.amountOperator ?? null,
  amountCents: q.amountCents ?? null,
  scope: q.spendingScope
    ? {
      includeCategories: q.spendingScope.includeCategories,
      includeTerms: q.spendingScope.includeTerms,
      excludeCategories: q.spendingScope.excludeCategories,
      excludeTerms: q.spendingScope.excludeTerms,
    }
    : null,
});

/** What the oracle says the figure SHOULD be for the query the app actually ran. */
function oracleForQuery(q) {
  const spec = oracleSpec(q);
  try {
    switch (q.operation) {
      case 'breakdown': {
        const r = O.breakdown(spec, q.groupBy);
        return { range: { start: r.start, end: r.end }, totalCents: r.totalCents, count: r.count, ids: r.ids,
          groups: r.groups.map((g) => ({ key: g.key, totalCents: g.totalCents, count: g.count, ids: g.ids })) };
      }
      case 'highest': {
        const r = O.highest(spec, q.groupBy, { aggregate: q.aggregate });
        return { range: { start: r.start, end: r.end }, winnerKeys: r.winnerKeys, peakValue: r.peak, ids: r.ids };
      }
      case 'largest': {
        const r = O.largest(spec);
        return { range: { start: r.start, end: r.end }, peakCents: r.peakCents, ids: r.ids };
      }
      case 'latest': {
        const r = O.latest(spec);
        return { range: { start: r.start, end: r.end }, date: r.date, totalCents: r.totalCents, ids: r.ids };
      }
      case 'day_types': {
        const r = O.dayTypes(spec);
        return { range: { start: r.start, end: r.end },
          weekday: { totalCents: r.weekday.totalCents, calendarDays: r.weekday.calendarDays, ids: r.weekday.ids },
          weekend: { totalCents: r.weekend.totalCents, calendarDays: r.weekend.calendarDays, ids: r.weekend.ids } };
      }
      case 'average': {
        const r = O.average(spec, q.aggregate);
        return { range: { start: r.start, end: r.end }, totalCents: r.totalCents, denominator: r.denominator, valueCents: r.valueCents, ids: r.ids };
      }
      case 'compare': {
        const r = O.compare(q.period, spec);
        return { current: { range: { start: r.current.start, end: r.current.end }, totalCents: r.current.totalCents, ids: r.current.ids },
          earlier: { range: { start: r.earlier.start, end: r.earlier.end }, totalCents: r.earlier.totalCents, ids: r.earlier.ids },
          differenceCents: r.differenceCents };
      }
      case 'projection': {
        const r = O.projection(q.category);
        return { range: { start: r.start, end: r.end }, spentCents: r.spentCents, budgetCents: r.budgetCents, remainingCents: r.remainingCents, ids: r.ids };
      }
      default: {
        const r = O.answer(spec);
        return { range: { start: r.start, end: r.end }, totalCents: r.totalCents, count: r.count, ids: r.ids };
      }
    }
  } catch (err) {
    return { error: String(err?.message ?? err) };
  }
}

/* ── Reading figures back out of an application plan ─────────────── */

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

function actualFigures(plan) {
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
    if (sides.length === 2 && sides[0].key === 'current') {
      out.shape = 'compare';
      out.current = { range: { start: sides[0].start, end: sides[0].end }, totalCents: sides[0].totalCents, ids: sortIds(sides[0].evidence?.rows) };
      out.earlier = { range: { start: sides[1].start, end: sides[1].end }, totalCents: sides[1].totalCents, ids: sortIds(sides[1].evidence?.rows) };
      out.differenceCents = plan.comparison.differenceCents;
    } else {
      out.shape = 'day_types';
      const weekday = sides.find((s) => s.key === 'weekday');
      const weekend = sides.find((s) => s.key === 'weekend');
      out.weekday = { totalCents: weekday?.totalCents, calendarDays: weekday?.calendarDays, ids: sortIds(weekday?.evidence?.rows) };
      out.weekend = { totalCents: weekend?.totalCents, calendarDays: weekend?.calendarDays, ids: sortIds(weekend?.evidence?.rows) };
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

/* ── One turn, through the real app path ─────────────────────────── */

async function runTurn({ text, key, session, ledger }) {
  const ticket = session.begin();

  /* Stage 3: a handled follow-up is entirely local. */
  const followup = resolveFollowup(text, session.getContext(), ledger);
  if (followup.handled) {
    if (followup.proposal) {
      const approved = confirmSpendingScope({ query: followup.query, preview: followup.preview }, { ...ledger, today: followup.referenceDate });
      return { kind: 'propose_scope', source: 'builtin', paid: false,
        proposal: { query: followup.query, count: followup.preview.count },
        approved: approved.kind === 'confirmed' ? approved.plan : null, approvedKind: approved.kind };
    }
    if (followup.plan.kind === 'answer') {
      const answerId = followup.snapshot ? null : session.accept(ticket, followup.query, followup.plan, ledger);
      return { kind: 'answer', source: 'builtin', paid: false, plan: followup.plan, query: followup.query ?? null, answerId, snapshot: Boolean(followup.snapshot) };
    }
    return { kind: 'clarify', source: 'builtin', paid: false, question: followup.plan.question ?? followup.plan.text };
  }

  const before = httpCalls;
  const res = await requestIntent(text, { ...ledger, fetchImpl: transportFor(key), url: ENDPOINT });
  const paid = httpCalls > before;

  /* The app's offline fallback. Never counted as a live pass. */
  if (!res.ok) {
    const parsed = interpretOffline(text, ledger.cats);
    const reply = parsed.query ? executeQuery(parsed.query, { ...ledger, message: text }) : parsed;
    session.failed(ticket, reply.kind === 'answer' && Boolean(reply.evidence || reply.comparison));
    const notice = explainIntentFailure(res.reason);
    if (reply.kind === 'answer') {
      return { kind: 'answer', source: 'offline', paid, plan: { ...reply, detail: [notice, reply.detail].filter(Boolean).join(' ') },
        query: parsed.query ?? null, reason: res.reason, offlineNotice: notice };
    }
    return { kind: 'clarify', source: 'offline', paid, question: reply.question ?? reply.text, reason: res.reason, offlineNotice: notice };
  }

  /* Stage 4: propose, then simulate approving exactly what came back. */
  if (res.intent.type === 'propose_scope') {
    const preview = previewSpendingScope(res.intent.query, ledger);
    if (!preview.ok) return { kind: 'clarify', source: res.source ?? 'model', paid, question: preview.question };
    const approved = confirmSpendingScope({ query: preview.query, preview }, ledger);
    return { kind: 'propose_scope', source: res.source ?? 'model', paid,
      proposal: { query: preview.query, count: preview.count, hasAggregate: ['total', 'totalCents', 'amount'].some((k) => Object.hasOwn(preview, k)) },
      approved: approved.kind === 'confirmed' ? approved.plan : null, approvedKind: approved.kind };
  }

  const plan = planFromIntent(res.intent, { ...ledger, message: text });
  const source = res.source ?? 'model';
  if (plan.kind === 'answer') {
    const query = res.intent.type === 'analyze' ? res.intent.query : null;
    const answerId = session.accept(ticket, query, plan, ledger);
    if (!query && (plan.evidence || plan.comparison)) session.failed(ticket, true);
    return { kind: 'answer', source, paid, plan, query, answerId };
  }
  if (plan.kind === 'clarify') return { kind: 'clarify', source, paid, question: plan.question };
  return { kind: plan.kind, source, paid, plan };
}

/* ── Scoring ─────────────────────────────────────────────────────── */

const accepted = (outcome) => [].concat(outcome ?? []);
const sameIds = (a = [], b = []) => a.length === b.length && a.every((id, i) => id === b[i]);
const sameRange = (a, b) => Boolean(a && b) && a.start === b.start && a.end === b.end;

function scoreTurn({ question, turn, actual }) {
  const want = accepted(turn.outcome ?? question.outcome);
  const expect = turn.expect ?? question.expect ?? null;
  const issues = [];

  /* Honest offline labelling. An offline answer is never a live pass.
     The root cause depends on WHY it went offline: a rejected intent is the
     contract doing its job, while an unreachable provider is not a defect in
     any of the eight code-level causes, so it gets its own bucket rather than
     being filed under one it does not belong to. An unlabelled offline answer
     is the only genuinely dishonest case. */
  if (actual.source === 'offline') {
    issues.push(`fell back to offline (${actual.reason})`);
    if (!actual.offlineNotice || !/offline/i.test(actual.offlineNotice)) {
      return { pass: false, rootCause: 'honesty', issues: [...issues, 'offline answer was NOT labelled as offline'] };
    }
    const rejected = /^(invalid_intent|intent_|unreadable_response|empty_response|unparsable_response)/.test(String(actual.reason));
    return { pass: false, rootCause: rejected ? 'contract' : 'offline-fallback', issues, offline: true };
  }

  /* Outcome type. clarify and unsupported are both "must not produce a figure". */
  const nonFigure = ['clarify', 'unsupported'];
  const satisfied = want.includes(actual.kind)
    || (nonFigure.some((w) => want.includes(w)) && actual.kind === 'clarify');

  if (!satisfied) {
    if (actual.kind === 'answer' && want.every((w) => nonFigure.includes(w))) {
      /* Distinguish a false claim from the wrong response type. Stating a
         figure where a clarification was required is dishonest; replying with
         built-in capability text states nothing false and is a misread of what
         was asked. Both fail, but calling the second one "honesty" misreports
         what went wrong. */
      const text = actual.plan?.text ?? '';
      const statesFigure = /S\$\s?\d/.test(text)
        || Boolean(actual.plan?.evidence?.rows?.length)
        || Boolean(actual.plan?.breakdown) || Boolean(actual.plan?.comparison);
      return { pass: false, rootCause: statesFigure ? 'honesty' : 'interpretation',
        issues: [statesFigure
          ? `answered with a figure where ${want.join('/')} was required: ${text}`
          : `replied with built-in text stating no figure, where ${want.join('/')} was required: ${text}`] };
    }
    if (actual.kind === 'clarify' && want.includes('answer')) {
      return { pass: false, rootCause: 'unsupported-capability', issues: [`clarified instead of answering: ${actual.question}`] };
    }
    if (actual.kind === 'propose_scope' && want.includes('answer')) {
      return { pass: false, rootCause: 'interpretation', issues: ['proposed a scope where a direct answer was expected'] };
    }
    return { pass: false, rootCause: 'interpretation', issues: [`outcome ${actual.kind}, wanted ${want.join('/')}`] };
  }

  /* A scope proposal must calculate nothing, and its approved figure must be
     exactly what the oracle makes of the rules it actually proposed. */
  if (actual.kind === 'propose_scope') {
    if (actual.proposal?.hasAggregate) issues.push('preview leaked an aggregate before approval');
    if (actual.approvedKind !== 'confirmed') {
      issues.push(`approving the returned proposal did not confirm (${actual.approvedKind})`);
      return { pass: false, rootCause: 'contract', issues };
    }
    const oracle = oracleForQuery(actual.proposal.query);
    const got = actualFigures(actual.approved);
    if (got.totalCents !== oracle.totalCents) {
      issues.push(`approved total ${got.totalCents}c but the oracle makes those exact rules ${oracle.totalCents}c`);
      return { pass: false, rootCause: 'engine', issues };
    }
    if (!sameIds(got.ids, oracle.ids)) {
      issues.push(`approved evidence ids ${got.ids.join(' ')} vs oracle ${oracle.ids.join(' ')}`);
      return { pass: false, rootCause: 'evidence', issues };
    }
    return { pass: issues.length === 0, rootCause: issues.length ? 'UX' : null, issues };
  }

  /* Nothing further to assert for a required clarification. */
  if (actual.kind === 'clarify') return { pass: true, rootCause: null, issues };

  if (!expect) return { pass: true, rootCause: null, issues };

  /* Answers: compare figures, ranges and evidence exactly. */
  const got = actualFigures(actual.plan);
  const oracleOfActual = actual.query ? oracleForQuery(actual.query) : null;

  /* A frozen snapshot replay only claims its rows. */
  if (expect.shape === 'snapshot') {
    const ids = got.ids;
    if (!sameIds(ids, expect.evidenceIds)) {
      return { pass: false, rootCause: 'evidence', issues: [`snapshot ids ${ids.join(' ')} vs expected ${expect.evidenceIds.join(' ')}`] };
    }
    return { pass: true, rootCause: null, issues };
  }

  /* A different answer SHAPE means the model chose a different operation.
     That is an interpretation failure by definition, and checking it before
     the figures stops a shape mismatch being misread as bad arithmetic. */
  const wantShape = expect.shape;
  const gotShape = got.shape === 'total' && wantShape === 'count' ? 'count' : got.shape;
  const shapeFamily = (s) => (['total', 'count', 'list'].includes(s) ? 'scalar' : s);
  if (wantShape && shapeFamily(gotShape) !== shapeFamily(wantShape)) {
    return { pass: false, rootCause: 'interpretation',
      issues: [...issues, `answered as "${gotShape}" where "${wantShape}" was required (operation ${actual.query?.operation ?? 'unknown'})`] };
  }

  /* Ranges. interpretation (wrong question) vs dates (wrong resolution). */
  const wantRange = expect.range ?? expect.current?.range;
  const gotRange = got.range ?? got.current?.range;
  if (wantRange && !sameRange(gotRange, wantRange)) {
    const appAgreesWithOracleOnItsOwnQuery = oracleOfActual && sameRange(gotRange, oracleOfActual.range ?? oracleOfActual.current?.range);
    issues.push(`range ${gotRange?.start}..${gotRange?.end} vs expected ${wantRange.start}..${wantRange.end}`);
    return { pass: false, rootCause: appAgreesWithOracleOnItsOwnQuery ? 'interpretation' : 'dates', issues };
  }

  /* Figures, per shape. */
  const figureChecks = [];
  const add = (label, a, b) => { if (a !== b) figureChecks.push(`${label} ${a} vs expected ${b}`); };

  if (expect.shape === 'breakdown') {
    add('grand total (cents)', got.totalCents, expect.totalCents);
    add('row count', got.count, expect.count);
    const gotKeys = (got.groups ?? []).map((g) => String(g.key)).join(',');
    const wantKeys = expect.groups.map((g) => String(g.key)).join(',');
    if (gotKeys !== wantKeys) figureChecks.push(`group keys [${gotKeys}] vs expected [${wantKeys}]`);
    else {
      expect.groups.forEach((wantGroup, i) => {
        const gotGroup = got.groups[i];
        add(`group ${wantGroup.key} total`, gotGroup.totalCents, wantGroup.totalCents);
        add(`group ${wantGroup.key} count`, gotGroup.count, wantGroup.count);
        if (!sameIds(gotGroup.ids, wantGroup.evidenceIds)) figureChecks.push(`group ${wantGroup.key} ids [${gotGroup.ids.join(' ')}] vs expected [${wantGroup.evidenceIds.join(' ')}]`);
      });
    }
    const recombined = (got.groups ?? []).reduce((n, g) => n + g.totalCents, 0);
    add('groups recombined to grand total', recombined, got.totalCents);
  } else if (expect.shape === 'compare') {
    add('current total', got.current?.totalCents, expect.current.totalCents);
    add('earlier total', got.earlier?.totalCents, expect.earlier.totalCents);
    add('difference', got.differenceCents, expect.differenceCents);
    if (!sameRange(got.earlier?.range, expect.earlier.range)) figureChecks.push(`earlier range ${got.earlier?.range?.start}..${got.earlier?.range?.end} vs expected ${expect.earlier.range.start}..${expect.earlier.range.end}`);
  } else if (expect.shape === 'day_types') {
    add('weekday total', got.weekday?.totalCents, expect.weekday.totalCents);
    add('weekday calendar days', got.weekday?.calendarDays, expect.weekday.calendarDays);
    add('weekend total', got.weekend?.totalCents, expect.weekend.totalCents);
    add('weekend calendar days', got.weekend?.calendarDays, expect.weekend.calendarDays);
  } else if (expect.shape === 'projection') {
    add('spent', got.spentCents, expect.spentCents);
    add('budget', got.budgetCents, expect.budgetCents);
    add('remaining', got.remainingCents, expect.remainingCents);
  } else if (expect.shape === 'largest') {
    if (!sameIds(got.ids, expect.evidenceIds)) figureChecks.push(`winner ids [${got.ids.join(' ')}] vs expected [${expect.evidenceIds.join(' ')}] (tie of ${expect.tieCount})`);
  } else if (expect.shape === 'latest') {
    add('total of latest-date rows', got.totalCents, expect.totalCents);
  } else if (expect.shape === 'highest') {
    if (!sameIds(got.ids, expect.evidenceIds)) figureChecks.push(`winner evidence ids [${got.ids.join(' ')}] vs expected [${expect.evidenceIds.join(' ')}]`);
  } else if (expect.shape === 'average') {
    add('total used for the average', got.totalCents, expect.totalCents);
  } else {
    add('total (cents)', got.totalCents, expect.totalCents);
    add('transaction count', got.count, expect.count);
  }

  if (figureChecks.length) {
    /* Right arithmetic on the wrong question, or wrong arithmetic on the right
       one? Compare the app against the oracle's view of the query the app
       ACTUALLY ran. Winner shapes (highest/largest/latest) report no total, so
       for those the row set is the claim and the comparison must use ids. */
    let appAgreesWithOracle = false;
    if (oracleOfActual && !oracleOfActual.error) {
      appAgreesWithOracle = typeof oracleOfActual.totalCents === 'number'
        ? oracleOfActual.totalCents === got.totalCents
        : sameIds(got.ids, oracleOfActual.ids ?? []);
    }
    return { pass: false, rootCause: appAgreesWithOracle ? 'interpretation' : 'engine', issues: [...issues, ...figureChecks] };
  }

  /* Evidence ids, for the shapes whose evidence is the whole matching set. */
  const wantIds = expect.evidenceIds;
  if (wantIds && ['total', 'count', 'list'].includes(expect.shape) && !sameIds(got.ids, wantIds)) {
    return { pass: false, rootCause: 'evidence', issues: [...issues, `evidence ids [${got.ids.join(' ')}] vs expected [${wantIds.join(' ')}]`] };
  }

  return { pass: issues.length === 0, rootCause: issues.length ? 'UX' : null, issues };
}

/* ── Run ─────────────────────────────────────────────────────────── */

const results = [];
const startedAt = new Date().toISOString();

for (const question of questions) {
  const ledger = fixtureContext();
  const session = createAssistantSession();
  const turns = question.turns ?? [question];
  const turnResults = [];

  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i];
    const key = question.turns ? `${question.id}.${i + 1}` : question.id;
    let actual;
    try {
      actual = await runTurn({ text: turn.text, key, session, ledger });
    } catch (err) {
      actual = { kind: 'error', source: 'harness', paid: false, error: String(err?.stack ?? err) };
    }
    const score = actual.kind === 'error'
      ? { pass: false, rootCause: 'contract', issues: [`harness/app threw: ${actual.error?.split('\n')[0]}`] }
      : scoreTurn({ question, turn, actual });

    turnResults.push({
      key, text: turn.text,
      wantOutcome: accepted(turn.outcome ?? question.outcome),
      gotOutcome: actual.kind,
      source: actual.source,
      paid: Boolean(actual.paid),
      pass: score.pass,
      rootCause: score.rootCause,
      issues: score.issues,
      note: turn.note ?? question.note ?? null,
      actualText: actual.plan?.text ?? actual.question ?? null,
      actualQuery: actual.query ?? actual.proposal?.query ?? null,
    });
  }

  results.push({
    id: question.id,
    capability: question.capability,
    chain: Boolean(question.turns),
    pass: turnResults.every((t) => t.pass),
    turns: turnResults,
  });
}

/* ── Aggregate ───────────────────────────────────────────────────── */

const allTurns = results.flatMap((r) => r.turns);
const passedTurns = allTurns.filter((t) => t.pass).length;
const passedQuestions = results.filter((r) => r.pass).length;

const byCapability = {};
for (const r of results) {
  const c = (byCapability[r.capability] ??= { total: 0, passed: 0, failures: [] });
  c.total += 1;
  if (r.pass) c.passed += 1; else c.failures.push(r.id);
}

const byRootCause = {};
for (const t of allTurns) if (!t.pass && t.rootCause) byRootCause[t.rootCause] = (byRootCause[t.rootCause] ?? 0) + 1;

const summary = {
  label: LABEL,
  note: NOTE,
  set: HOLD ? 'HOLDOUT' : 'MAIN',
  mode: MOCK ? 'mock' : 'live',
  startedAt,
  finishedAt: new Date().toISOString(),
  referenceDate: TODAY,
  endpoint: MOCK ? null : ENDPOINT,
  questions: results.length,
  questionsPassed: passedQuestions,
  turns: allTurns.length,
  turnsPassed: passedTurns,
  paidCalls,
  httpCalls,
  offlineTurns: allTurns.filter((t) => t.source === 'offline').length,
  byCapability,
  byRootCause,
};

/* MERGE, never replace. A partial live re-run (`--only`) must leave the
   recordings for untouched questions intact, so a later full replay still
   scores the whole set — the re-run ids against fresh responses and the rest
   against the ones already captured. Overwriting would silently shrink the
   question set and flatter the score. */
if (!MOCK) {
  const previous = existsSync(RECORDING_FILE) ? JSON.parse(readFileSync(RECORDING_FILE, 'utf8')) : {};
  writeFileSync(RECORDING_FILE, `${JSON.stringify({ ...previous, ...fresh }, null, 2)}\n`);
}

const outJson = p(HOLD ? 'results-holdout.json' : `results-${LABEL}.json`);
writeFileSync(outJson, `${JSON.stringify({ summary, results }, null, 2)}\n`);

/* ── Scorecard ───────────────────────────────────────────────────── */

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : 'n/a');
const dollars = (c) => (typeof c === 'number' ? `S$${(c / 100).toFixed(2)}` : String(c));

const failures = allTurns.filter((t) => !t.pass);

const md = [];
md.push(`# Ask evaluation — ${LABEL} (${summary.set})`);
md.push('');
md.push(`Mode **${summary.mode}** · reference date **${TODAY}** · generated ${summary.finishedAt}`);
md.push('');
if (NOTE) { md.push(`> ${NOTE}`); md.push(''); }
md.push('## Score');
md.push('');
md.push('| | Passed | Total | Rate |');
md.push('| --- | ---: | ---: | ---: |');
md.push(`| Questions | ${passedQuestions} | ${results.length} | ${pct(passedQuestions, results.length)} |`);
md.push(`| Turns | ${passedTurns} | ${allTurns.length} | ${pct(passedTurns, allTurns.length)} |`);
md.push('');
md.push(`Paid model calls: **${paidCalls}** (of ${httpCalls} HTTP requests; a 400 never reaches the provider). Offline fallbacks: **${summary.offlineTurns}** (an offline answer never counts as a live pass).`);
md.push('');
md.push('## Per capability');
md.push('');
md.push('| Capability | Passed | Total | Rate | Failing ids |');
md.push('| --- | ---: | ---: | ---: | --- |');
for (const [cap, c] of Object.entries(byCapability).sort((a, b) => a[0].localeCompare(b[0]))) {
  md.push(`| ${cap} | ${c.passed} | ${c.total} | ${pct(c.passed, c.total)} | ${c.failures.join(', ') || '—'} |`);
}
md.push('');
md.push('## Root causes');
md.push('');
if (Object.keys(byRootCause).length === 0) md.push('No failures.');
else {
  md.push('| Root cause | Failing turns |');
  md.push('| --- | ---: |');
  for (const [cause, n] of Object.entries(byRootCause).sort((a, b) => b[1] - a[1])) md.push(`| ${cause} | ${n} |`);
}
md.push('');
md.push('## Failures');
md.push('');
if (!failures.length) md.push('None.');
else {
  md.push('| id | question | wanted | got | root cause | detail |');
  md.push('| --- | --- | --- | --- | --- | --- |');
  for (const t of failures) {
    const detail = t.issues.join('; ').replace(/\|/g, '\\|').slice(0, 400);
    const text = t.text.replace(/\|/g, '\\|').slice(0, 90);
    md.push(`| ${t.key} | ${text} | ${t.wantOutcome.join('/')} | ${t.gotOutcome}${t.source === 'offline' ? ' (offline)' : ''} | ${t.rootCause ?? '—'} | ${detail} |`);
  }
}
md.push('');
md.push('## Definitions used by the oracle');
md.push('');
for (const [k, v] of Object.entries(O.DEFINITIONS)) md.push(`- **${k}**: ${v}`);
md.push('');

const outMd = p(HOLD ? 'SCORECARD-holdout.md' : `SCORECARD-${LABEL}.md`);
/* Trim trailing blanks so the file ends with exactly one newline and
   `git diff --check` stays quiet. */
while (md.length && md.at(-1) === '') md.pop();
writeFileSync(outMd, `${md.join('\n')}\n`);

/* ── Paid-call log ───────────────────────────────────────────────── */

if (!MOCK && paidCalls > 0) {
  const purposeAt = argv.indexOf('--purpose');
  const purpose = purposeAt >= 0 ? argv[purposeAt + 1] : `${LABEL} run of ${summary.set}`;
  const stepAt = argv.indexOf('--step');
  const step = stepAt >= 0 ? argv[stepAt + 1] : '1';
  mkdirSync(dirname(p('calls.log')), { recursive: true });
  appendFileSync(p('calls.log'),
    `${new Date().toISOString()}\tstep=${step}\tcalls=${paidCalls}\tset=${summary.set}\tpurpose=${purpose}\n`);
}

/* ── Console ─────────────────────────────────────────────────────── */

console.log('='.repeat(78));
console.log(`${summary.set} — ${summary.mode} — ${passedQuestions}/${results.length} questions, ${passedTurns}/${allTurns.length} turns`);
console.log(`paid model calls: ${paidCalls}   http calls: ${httpCalls}   offline fallbacks: ${summary.offlineTurns}`);
console.log('='.repeat(78));
for (const [cause, n] of Object.entries(byRootCause).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${cause}`);
}
console.log('');
for (const t of failures) {
  console.log(`FAIL ${t.key.padEnd(8)} ${t.rootCause ?? '—'}`);
  console.log(`     Q: ${t.text.slice(0, 100)}`);
  console.log(`     wanted ${t.wantOutcome.join('/')}, got ${t.gotOutcome}${t.source === 'offline' ? ' (offline)' : ''}`);
  for (const issue of t.issues) console.log(`     - ${issue}`);
}
console.log(`\nwrote ${outJson}`);
console.log(`wrote ${outMd}`);
if (!MOCK) console.log(`wrote ${RECORDING_FILE}`);
