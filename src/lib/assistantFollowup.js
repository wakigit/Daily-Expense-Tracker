import { validateQuery, validDate } from './queryContract.js';
import { executeQuery, queryRange } from './queryEngine';
import { markOutdatedAnswers } from './answerEvidence';
import { sumCents, toCents } from './money';
import { money } from './format';
import { previewSpendingScope } from './spendingScope';
import { stripGreeting } from './assistantDialogue.js';

const clarify = question => ({ kind: 'clarify', question, text: question });
const winners = ['highest', 'largest', 'latest'];
const regroupable = ['total', 'count', 'list', 'breakdown'];
const amountBound = (operator, amount) => ({ direction: ['gt', 'gte'].includes(operator) ? 'lower' : 'upper', cents: toCents(amount) + (operator === 'gt' ? 1 : operator === 'lt' ? -1 : 0) });
const periods = { 'last month': 'lastmonth', 'the previous month': 'lastmonth', 'last week': 'lastweek', 'the previous week': 'lastweek', 'this month': 'month', 'this week': 'week', today: 'today', yesterday: 'yesterday', 'this year': 'year' };

/** Closed, local amendments. Unconsumed referential wording never becomes a description. */
export function parseFollowup(message) {
  const text = stripGreeting(message).toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  const grammar = text.replace(/[“"][^”"]*[”"]/g, ' ');
  // Independent mutation requests keep their existing confirmation pipeline.
  if (/^(?:please )?(?:add|record|log|save|delete|remove|undo)\b/.test(grammar)) return null;
  const exclusion = text.match(/^(?:please )?exclude (.{1,80})$/);
  if (exclusion) return {kind:'exclude',term:exclusion[1]};
  if (/\b(exclude|excluding|except)\b/.test(grammar) || (/\bwithout\b/.test(grammar) && /^(?:show|list|find|how much|what|which|compare|break|only|and|how about)\b/.test(grammar))) return { kind: 'unsupported', question: 'Exclusions are not supported yet. Please submit a complete question with the description, category and dates you want included.' };
  if (/\b(?:answer\s*#?\s*\d+|first answer|earlier answer|both answers|previous two)\b/.test(grammar)) return { kind: 'unsupported', question: 'I can follow up only on the latest eligible financial calculation, not arbitrary earlier answers. Please resubmit a complete question for another scope.' };
  if (/^(?:please )?(?:show|list)(?: me)? (?:those|these|them|the same)(?: transactions| purchases| expenses| records)?$/.test(text)) return { kind: 'evidence' };
  const group = text.match(/^(?:please )?(?:break (?:that|this|it) down|break down (?:that|this|it)|split (?:that|this|it))(?: by (?:calendar )?(month|category|categories))$/);
  if (group) return { kind: 'group', groupBy: group[1] === 'month' ? 'month' : 'category' };
  const period = text.match(/^(?:and )?(?:(?:what|how) about |and )?(last month|the previous month|last week|the previous week|this month|this week|today|yesterday|this year)$/);
  if (period && /^(?:what|how|and)\b/.test(text)) return { kind: 'period', period: periods[period[1]] };
  const amount = text.match(/^(?:please )?only(?: (?:show|include|keep))?(?: me)?(?: (?:purchases|transactions|expenses|records))? (over|under|at least|at most|more than|less than)\s*(?:s\$|\$|sgd\s*)?(\d{1,9}(?:\.\d{1,2})?)$/);
  if (amount) return { kind: 'amount', amountOperator: ({ over: 'gt', under: 'lt', 'at least': 'gte', 'at most': 'lte', 'more than': 'gt', 'less than': 'lt' })[amount[1]], amount: amount[2] };
  if (/^(?:please )?(?:only\b|(?:show|list)(?: me)? (?:those|these|them)\b|break (?:that|this|it)\b|break down (?:that|this|it)\b|split (?:that|this|it)\b|(?:what|how) about\b)/.test(text)) return { kind: 'unsupported', question: 'Please use one supported follow-up: show those transactions, break that down by month/category, what about last month, or only purchases over an amount. Include the full question for other changes.' };
  return null;
}

export function captureQueryContext(query, answer, ctx, answerId) {
  const checked = validateQuery(query, ctx.cats);
  const referenceDate = answer.followup?.referenceDate ?? answer.referenceDate ?? ctx.today;
  if (checked.ok && checked.query.spendingScope && JSON.stringify(answer.approvedScope)!==JSON.stringify(checked.query.spendingScope)) return null;
  if (!checked.ok || answer.kind !== 'answer' || !validDate(referenceDate)) return null;
  const range = queryRange(checked.query, referenceDate, ctx.expenses);
  return { query: checked.query, range, referenceDate, answerId, answer, changed: false };
}

export function contextIsOutdated(context, ctx) {
  return Boolean(context && (context.changed || markOutdatedAnswers([context.answer], ctx.expenses, ctx.cats, ctx.budgets)[0].outdated));
}

/** Inherited fields come from a validated query, never concatenated prior text. */
export function resolveFollowup(message, context, ctx) {
  const amendment = parseFollowup(message);
  if (!amendment) return { handled: false };
  const reject = question => ({ handled: true, plan: clarify(question) });
  if (amendment.kind === 'unsupported') return reject(amendment.question);
  if (!context) return reject('There is no financial query to follow up yet. Please ask a complete question with a description or category and a date range.');
  if (context.ambiguous) return reject('The latest provider request failed and its fallback answer has a different possible scope. Please submit the complete question so I do not attach your follow-up to the wrong answer.');
  const changed = contextIsOutdated(context, ctx);
  if (amendment.kind === 'exclude') {
    if (!context.query.spendingScope) return reject('Exclusions require a reviewed related-spending scope. Please ask a complete question describing the inclusion rules first.');
    const query={...context.query,spendingScope:{...context.query.spendingScope,excludeTerms:[...context.query.spendingScope.excludeTerms,amendment.term]}};
    const preview=previewSpendingScope(query,{...ctx,today:context.referenceDate});
    return preview.ok?{handled:true,proposal:true,query:preview.query,referenceDate:context.referenceDate,preview}:{handled:true,plan:clarify(preview.question)};
  }
  if (amendment.kind === 'evidence') {
    if (!context.answer.evidence) return reject('That answer has multiple ranges or groups with different meanings. Please submit a complete transaction question naming the range and filters you mean.');
    const evidence = context.answer.evidence;
    return { handled: true, snapshot: true, plan: {
      kind: 'answer', intent: 'evidence', text: `${evidence.rows.length} original supporting ${evidence.rows.length === 1 ? 'transaction' : 'transactions'}, totalling ${money(sumCents(evidence.rows) / 100)}.`,
      detail: `These are historical snapshots from answer #${context.answerId}, not a refreshed ledger total.${changed ? ' Records changed since that answer; ask a complete question for a refreshed result.' : ''}`,
      approvedScope:context.answer.approvedScope, interpretation: context.answer.interpretation, evidence, outdated: changed,
      followup: { answerId: context.answerId, mode: 'snapshot', changed },
    } };
  }
  if (!validateQuery(context.query, ctx.cats).ok) return reject('The referenced category or query is no longer valid. Please submit a complete question using your current categories.');
  // Keep the canonical period and freeze its reference date. This also keeps
  // all-time averages/history correct when an earlier record is added later.
  const referenceDate = amendment.kind === 'period' ? ctx.today : context.referenceDate;
  let query = { ...context.query };
  if (amendment.kind === 'group') {
    if (!regroupable.includes(query.operation)) return reject('I can regroup a total, count, transaction list or complete breakdown. A winner, average, comparison or budget estimate needs a complete new question to avoid changing its meaning.');
    query = { ...query, operation: 'breakdown', groupBy: amendment.groupBy, aggregate: 'total' };
  }
  if (amendment.kind === 'period') query = { ...query, period: amendment.period, start: null, end: null, dayCount: null };
  if (amendment.kind === 'amount') {
    if (winners.includes(query.operation)) return reject('Should that amount filter apply to the winning records or to all candidates? Please submit a complete question so I do not broaden the winner answer.');
    if (query.amountOperator) {
      const prior = amountBound(query.amountOperator, query.amount), next = amountBound(amendment.amountOperator, amendment.amount);
      const narrows = prior.direction === next.direction && (next.direction === 'lower' ? next.cents >= prior.cents : next.cents <= prior.cents);
      if (!narrows) return reject('That amount condition would broaden the previous filter or require two different bounds. Please submit a complete question to replace it; combined amount ranges are not supported.');
    }
    query = { ...query, amountOperator: amendment.amountOperator, amount: amendment.amount };
  }
  const checked = validateQuery(query, ctx.cats);
  if (!checked.ok) return reject(checked.question);
  const plan = executeQuery(checked.query, { ...ctx, today: referenceDate, approvedScope: context.answer.approvedScope });
  if (plan.kind !== 'answer') return { handled: true, plan };
  const followup = { answerId: context.answerId, mode: 'refresh', changed, referenceDate };
  return { handled: true, query: checked.query, plan: { ...plan, followup,
    detail: `${plan.detail} ${changed ? 'Records changed since the referenced answer. This result is recalculated from current records; the old answer stays unchanged.' : 'Recalculated from current records.'}`,
  } };
}

/** One in-memory query and one request generation, never localStorage or model history. */
export function createAssistantSession() {
  let generation = 0, active = null, context = null, ambiguous = false, answerNumber = 0;
  const current = ticket => ticket?.generation === generation;
  return {
    begin() { active?.abort(); active = new AbortController(); return { generation: ++generation, signal: active.signal }; },
    current,
    getContext() { return context && { ...context, ambiguous }; },
    noteLedger(ctx) { if (context && contextIsOutdated(context, ctx)) context = { ...context, changed: true }; },
    accept(ticket, query, plan, ctx) {
      if (!current(ticket) || !query || plan.kind !== 'answer') return null;
      const next = captureQueryContext(query, plan, ctx, answerNumber + 1);
      if (!next) return null;
      context = next; ambiguous = false; return ++answerNumber;
    },
    failed(ticket, financialAnswerDisplayed = false) { if (current(ticket) && financialAnswerDisplayed && context) ambiguous = true; },
    cancel() { active?.abort(); active = null; generation++; },
    reset() { active?.abort(); active = null; context = null; ambiguous = false; answerNumber = 0; generation++; },
  };
}
