import { requiresTwoSidedAnswer } from './comparisonRequest.js';
import { descriptionOrRequest, unresolvedCoordination } from './explicitFilterRequest.js';
import { normaliseScopeText } from './filterMatching.js';
import { INTENT_LIMITATION, isLimitationReason, limitationClarification, asksMultipartPercentage, mentionedCategories, requestLimitation, needsScopeRules, asksCategoryComparison } from './intentLimitations.js';
import { dialogueIntent } from './assistantDialogue.js';
import { validateQuery } from './queryContract.js';
/**
 * The contract between the model and this application.
 *
 * A model does not return data — it returns a *proposal*, and this file is the
 * gate that proposal has to pass. Nothing downstream ever sees a field the
 * model invented: unknown intent types, unknown metrics, unknown category ids
 * and surplus properties are all rejected or dropped here.
 *
 * Deliberately NOT in this file: any spending figure. The model picks which
 * question is being asked; lib/stats.js computes the answer. See docs/PRD.md
 * §8 — a model asked to total rows is right most of the time, which is worse
 * than being wrong every time, because the errors are silent.
 *
 * Imported by BOTH halves. The backend validates before it replies, so a
 * malformed model response never leaves the server; the frontend validates
 * again on arrival, because a frontend that trusts its backend is one
 * compromised backend away from executing anything. Same file, no drift.
 */

export const INTENT_TYPES = [
  'help',
  'answer',
  'analyze',
  'propose_scope',
  'propose_add',
  'find_delete_candidates',
  'undo',
  'clarify',
];

/** Every figure the assistant can ask for. Each maps to a lib/stats.js call. */
export const METRICS = [
  'compare',
  'total',
  'count',
  'top_day',
  'top_week',
  'top_month',
  'top_category',
  'average_per_day',
  'average_per_week',
  'average_per_month',
];

/** Matches the windows lib/ask.js already understands. */
export const COMPARISON_PERIODS = ['month', 'week'];
export const PERIODS = ['today', 'yesterday', 'week', 'lastweek', 'month', 'lastmonth', 'all'];

export const INTENT_ERR = {
  NOT_OBJECT: 'intent_not_object',
  UNKNOWN_TYPE: 'intent_unknown_type',
  UNKNOWN_METRIC: 'intent_unknown_metric',
  UNKNOWN_PERIOD: 'intent_unknown_period',
  UNKNOWN_CATEGORY: 'intent_unknown_category',
  MISSING_FIELD: 'intent_missing_field',
  BAD_FIELD: 'intent_bad_field',
};

const bad = (code, extra = {}) => ({ ok: false, error: { code, ...extra } });

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const trimmed = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Validates and NARROWS a raw model response.
 *
 * Returns only known fields, so nothing extra reaches the planner even if the
 * model is chatty. `cats` is required for category checks: a hallucinated
 * category id is the kind of error that stays invisible, because the total is
 * still right and only a budget looks wrong later.
 */
export function validateIntent(raw, { cats = [], message = '' } = {}) {
  if (!isPlainObject(raw)) return bad(INTENT_ERR.NOT_OBJECT);

  // Greetings and genuinely ambiguous highest requests cannot turn into arbitrary totals.
  const dialogue=dialogueIntent(message, cats);
  if(dialogue) return {ok:true,intent:dialogue};
  const type = trimmed(raw.type);
  if (!INTENT_TYPES.includes(type)) return bad(INTENT_ERR.UNKNOWN_TYPE, { type: raw.type ?? null });

  /* `help` is accepted from the model, but nothing the model wrote is shown.
     The reply is the built-in capability text assembled by planFromIntent, and
     `say` is dropped here rather than forwarded, so a model that returns help
     can choose the RESPONSE TYPE and never the words. Rejecting it outright
     sent five honest replies down the offline fallback instead. */
  if(type==='help') {
    const reason=requiresTwoSidedAnswer(message,cats)?(asksCategoryComparison(message,cats)?INTENT_LIMITATION.CATEGORY_COMPARISON:INTENT_LIMITATION.COMPARISON_SHAPE):requestLimitation(message,cats);
    return {ok:true,intent:reason ? limitationClarification(reason,message) : {type:'help'}};
  }

  const catIds = cats.map((c) => c.id);
  const say = trimmed(raw.say);

  if (type === 'analyze' || type === 'propose_scope') {
    const mentioned = mentionedCategories(message,cats);
    const { amountCents: ignored, ...q } = raw.query ?? {};
    const checked = validateQuery(q, cats);
    if (!checked.ok) {
      if (isLimitationReason(checked.limitation)) {
        // category_terms contains unmapped words, not executable IDs. Only a
        // corresponding limitation in the USER request can rescue that metadata.
        // Invented extra category words on an ordinary single-scope request fail.
        if ([INTENT_LIMITATION.MULTIPLE_CATEGORIES,INTENT_LIMITATION.SCOPE_CATEGORY_COVERAGE,INTENT_LIMITATION.FILTER_COVERAGE].includes(checked.limitation)
            && !requestLimitation(message,cats)) return bad(INTENT_ERR.BAD_FIELD,{field:'query.category_terms'});
        const reason = asksMultipartPercentage(message) ? INTENT_LIMITATION.MULTIPART_PERCENTAGE : asksCategoryComparison(message,cats) ? INTENT_LIMITATION.CATEGORY_COMPARISON : checked.limitation;
        return {ok:true,intent:limitationClarification(reason,message)};
      }
      return bad(INTENT_ERR.BAD_FIELD,{field:`query.${checked.field}`});
    }
    if(checked.query.operation!=='compare'&&requiresTwoSidedAnswer(message,cats))return {ok:true,intent:limitationClarification(asksCategoryComparison(message,cats)?INTENT_LIMITATION.CATEGORY_COMPARISON:INTENT_LIMITATION.COMPARISON_SHAPE,message)};
    if(checked.query.operation==='compare'&&checked.query.comparison){
      const query=checked.query, comparison=query.comparison;
      const selected=comparison.kind==='categories'?comparison.categories:[query.category,...query.categories].filter(Boolean);
      const comparisonWords=/\b(?:compare|compared|comparing|comparison|versus|vs)\b|\b(?:more|less|higher|lower|greater|smaller)\b/i.test(message);
      const missing=mentioned.some(c=>!selected.includes(c.id))||selected.some(id=>!mentioned.some(c=>c.id===id));
      const literal=descriptionOrRequest(message);
      const terms=[query.description,...query.descriptionTerms].filter(Boolean).map(normaliseScopeText);
      const tooMany=(message.replace(/[“"][^”"]*[”"]/g,' ').match(/\b(?:vs|versus)\b/gi)??[]).length>1;
      const reason=tooMany?INTENT_LIMITATION.COMPARISON_SHAPE:asksMultipartPercentage(message)?INTENT_LIMITATION.MULTIPART_PERCENTAGE:needsScopeRules(message)?INTENT_LIMITATION.SCOPE_REQUIRED:
        !comparisonWords||missing||unresolvedCoordination(message,cats)||query.descriptionTerms.some(t=>!normaliseScopeText(message).includes(t))||literal?.terms.some(t=>!terms.includes(t))?INTENT_LIMITATION.FILTER_COVERAGE:null;
      if(reason)return {ok:true,intent:limitationClarification(reason,message)};
      return {ok:true,intent:{type:'analyze',query,say:''}};
    }
    let reason = null;
    if (asksMultipartPercentage(message)) reason = INTENT_LIMITATION.MULTIPART_PERCENTAGE;
    else if (asksCategoryComparison(message,cats)) reason = INTENT_LIMITATION.CATEGORY_COMPARISON;
    else if (!checked.query.spendingScope && needsScopeRules(message)) reason = INTENT_LIMITATION.SCOPE_REQUIRED;
    else if (!checked.query.spendingScope && mentioned.length > 1 && !checked.query.categories.length) reason = INTENT_LIMITATION.MULTIPLE_CATEGORIES;
    else if (!checked.query.spendingScope && mentioned.some(c => ![checked.query.category,...checked.query.categories].includes(c.id))) reason = INTENT_LIMITATION.FILTER_COVERAGE;
    else if (!checked.query.spendingScope && checked.query.categories.some(id => !mentioned.some(c=>c.id===id))) reason = INTENT_LIMITATION.FILTER_COVERAGE;
    else if (!checked.query.spendingScope && checked.query.descriptionTerms.some(term => !normaliseScopeText(message).includes(term))) reason = INTENT_LIMITATION.FILTER_COVERAGE;
    else if (!checked.query.spendingScope && unresolvedCoordination(message,cats)) reason = INTENT_LIMITATION.FILTER_COVERAGE;
    else if (!checked.query.spendingScope && descriptionOrRequest(message)?.terms.some(t => ![checked.query.description,...checked.query.descriptionTerms].filter(Boolean).map(normaliseScopeText).includes(t))) reason = INTENT_LIMITATION.FILTER_COVERAGE;
    if (reason) return {ok:true,intent:limitationClarification(reason,message)};
    if (type === 'propose_scope' && !checked.query.spendingScope) return bad(INTENT_ERR.BAD_FIELD,{field:'query.spendingScope'});
    return checked.ok ? { ok: true, intent: { type:checked.query.spendingScope?'propose_scope':type, query: checked.query, say } } : bad(INTENT_ERR.BAD_FIELD, { field: `query.${checked.field}` });
  }

  if (type === 'answer') {
    const q = isPlainObject(raw.query) ? raw.query : {};
    if (q.categories !== undefined || q.descriptionTerms !== undefined || q.comparison !== undefined) return bad(INTENT_ERR.BAD_FIELD,{field:'query.structure'});
    const metric = trimmed(q.metric);
    if (!METRICS.includes(metric)) return bad(INTENT_ERR.UNKNOWN_METRIC, { metric: q.metric ?? null });

    const period = trimmed(q.period) || 'month';
    if (!PERIODS.includes(period)) return bad(INTENT_ERR.UNKNOWN_PERIOD, { period: q.period ?? null });

    if (metric === 'compare' && !COMPARISON_PERIODS.includes(period)) return bad(INTENT_ERR.BAD_FIELD, { field: 'period' });

    const category = q.category == null || q.category === '' ? null : trimmed(q.category);
    if (category !== null && !catIds.includes(category)) {
      return bad(INTENT_ERR.UNKNOWN_CATEGORY, { category, known: catIds });
    }

    // The category WORDS the sentence used, before any mapping. `category` is
    // what the model matched them to; these are what it was matching. Keeping
    // both is what lets the planner notice that "groceries and entertainment"
    // became a single, narrower question — see lib/assistant.js.
    // Both spellings, because this validator runs TWICE on the same payload:
    // once on the server against the model's snake_case reply, then again on
    // the client against the server's already-normalised camelCase one. Reading
    // only the raw spelling silently dropped the field on the second pass, and
    // the guard that depends on it never fired — caught in a browser test, not
    // by any unit test, because each half looked correct on its own.
    const rawTerms = Array.isArray(q.category_terms) ? q.category_terms
      : Array.isArray(q.categoryTerms) ? q.categoryTerms
      : [];
    const categoryTerms = rawTerms.map(trimmed).filter(Boolean).slice(0, 8);
    if(metric!=='compare'&&requiresTwoSidedAnswer(message,cats))return {ok:true,intent:limitationClarification(INTENT_LIMITATION.COMPARISON_SHAPE,message)};

    return {
      ok: true,
      intent: { type, query: { metric, period, category, categoryTerms }, say },
    };
  }

  if (type === 'propose_add') {
    const e = isPlainObject(raw.expense) ? raw.expense : null;
    if (!e) return bad(INTENT_ERR.MISSING_FIELD, { field: 'expense' });

    // Amount and date are passed through as-is: lib/actions.js is the one
    // validator for expense fields and it rejects what it cannot read. Doing it
    // twice, differently, is how two validators drift apart.
    const category = e.category == null || e.category === '' ? null : trimmed(e.category);
    if (category !== null && !catIds.includes(category)) {
      return bad(INTENT_ERR.UNKNOWN_CATEGORY, { category, known: catIds });
    }
    return {
      ok: true,
      intent: {
        type,
        expense: {
          description: trimmed(e.description),
          amount: typeof e.amount === 'number' ? e.amount : trimmed(e.amount),
          category,
          date: trimmed(e.date) || null,
          notes: trimmed(e.notes),
        },
        say,
      },
    };
  }

  if (type === 'find_delete_candidates') {
    const f = isPlainObject(raw.filter) ? raw.filter : {};
    const category = f.category == null || f.category === '' ? null : trimmed(f.category);
    if (category !== null && !catIds.includes(category)) {
      return bad(INTENT_ERR.UNKNOWN_CATEGORY, { category, known: catIds });
    }
    const filter = {
      description: trimmed(f.description) || null,
      amount: f.amount == null || f.amount === '' ? null : f.amount,
      date: trimmed(f.date) || null,
      category,
    };
    // A filter matching everything would offer the whole list for deletion.
    if (!filter.description && filter.amount == null && !filter.date && !filter.category) {
      return bad(INTENT_ERR.MISSING_FIELD, { field: 'filter' });
    }
    return { ok: true, intent: { type, filter, say } };
  }

  if (type === 'undo') {
    const scope = trimmed(raw.scope) || 'last_assistant';
    if (scope !== 'last_assistant') return bad(INTENT_ERR.BAD_FIELD, { field: 'scope', scope });
    return { ok: true, intent: { type, scope, say } };
  }

  // clarify
  if (raw.reason != null && !isLimitationReason(raw.reason)) return bad(INTENT_ERR.BAD_FIELD, {field:'reason'});
  const question = trimmed(raw.question);
  if (!question) return bad(INTENT_ERR.MISSING_FIELD, { field: 'question' });
  const options = Array.isArray(raw.options)
    ? raw.options.map(trimmed).filter(Boolean).slice(0, 6)
    : [];
  const reason = raw.reason ?? requestLimitation(message,cats);
  return { ok: true, intent: reason ? limitationClarification(reason,message) : { type, question, options, say } };
}



/**
 * What the model is allowed to know. Deliberately NOT the expense rows.
 *
 * It needs the category vocabulary to name one, and today's date to resolve
 * "yesterday". It does not need anyone's spending to decide which question is
 * being asked, and sending it would hand a third party the whole ledger for no
 * benefit. The figures are computed here afterwards.
 */
export function buildContext({ cats = [], today = '', expenses = [] } = {}) {
  return {
    today,
    categories: cats.map((c) => ({ id: c.id, label: c.label })),
    expenseCount: expenses.length,
    hasData: expenses.length > 0,
  };
}

/** Public diagnostics contain fixed codes/field names, never model values or category labels. */
export function intentDiagnostic(error) {
  const fields=['message','query','query.structure','query.category_terms','query.description','query.categories','query.descriptionTerms','query.comparison','query.amount','query.projection_filters','query.operation','query.period','query.day','query.aggregate','query.category','query.groupBy','query.range','query.dayCount','query.spendingScope','multiple_categories','expense','filter','question','scope','period','reason'];
  return {code:Object.values(INTENT_ERR).includes(error?.code)?error.code:INTENT_ERR.BAD_FIELD,field:fields.includes(error?.field)?error.field:null};
}
