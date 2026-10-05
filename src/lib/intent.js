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
  'answer',
  'propose_add',
  'find_delete_candidates',
  'undo',
  'clarify',
];

/** Every figure the assistant can ask for. Each maps to a lib/stats.js call. */
export const METRICS = [
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
export function validateIntent(raw, { cats = [] } = {}) {
  if (!isPlainObject(raw)) return bad(INTENT_ERR.NOT_OBJECT);

  const type = trimmed(raw.type);
  if (!INTENT_TYPES.includes(type)) return bad(INTENT_ERR.UNKNOWN_TYPE, { type: raw.type ?? null });

  const catIds = cats.map((c) => c.id);
  const say = trimmed(raw.say);

  if (type === 'answer') {
    const q = isPlainObject(raw.query) ? raw.query : {};
    const metric = trimmed(q.metric);
    if (!METRICS.includes(metric)) return bad(INTENT_ERR.UNKNOWN_METRIC, { metric: q.metric ?? null });

    const period = trimmed(q.period) || 'month';
    if (!PERIODS.includes(period)) return bad(INTENT_ERR.UNKNOWN_PERIOD, { period: q.period ?? null });

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
  const question = trimmed(raw.question);
  if (!question) return bad(INTENT_ERR.MISSING_FIELD, { field: 'question' });
  const options = Array.isArray(raw.options)
    ? raw.options.map(trimmed).filter(Boolean).slice(0, 6)
    : [];
  return { ok: true, intent: { type, question, options, say } };
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
