/**
 * The model adapter — the ONLY file that knows which API provider is in use.
 *
 * OpenAI's direct API, official Node SDK, Responses API, Structured Outputs.
 *
 * Structured Outputs rather than "please reply with JSON": with `strict: true`
 * the model cannot emit a field the schema does not describe, and the category
 * enum is built from the caller's real category ids on every request, so an
 * invented category is not a thing the model is able to say. That removes a
 * whole class of failure before lib/intent.js is even consulted — and
 * lib/intent.js still validates afterwards, because a schema the API enforces
 * is not the same as a schema this application has checked.
 *
 * The model is never asked for a figure. It selects a metric and a period from
 * closed lists; lib/assistant.js computes the number from the real rows. See
 * docs/PRD.md §8.
 *
 * OPENAI_API_KEY is read here, from the environment, and nowhere else. It is
 * never logged, never returned in a response, and never sent to the browser.
 */

import OpenAI from 'openai';

export const DEFAULT_MODEL = 'gpt-4.1-mini';

/** Configurable, so the model can be changed without touching code. */
export const MODEL = process.env.OPENAI_MODEL || DEFAULT_MODEL;

export class ProviderNotConfigured extends Error {
  constructor(message = 'No model provider is configured on this server.') {
    super(message);
    this.code = 'provider_not_configured';
    this.status = 503;
  }
}

export class ProviderFailed extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** True once a key is present. Reports presence only — never the value. */
export function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

let client = null;
function getClient() {
  if (!isConfigured()) throw new ProviderNotConfigured();
  // Built lazily so importing this module never requires a key — the tests and
  // the health endpoint must work on a machine that has none.
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/* ── The schema the model must answer in ───────────────────────── */

const METRICS = [
  'total', 'count', 'top_day', 'top_week', 'top_month', 'top_category',
  'average_per_day', 'average_per_week', 'average_per_month',
];
const PERIODS = ['today', 'yesterday', 'week', 'lastweek', 'month', 'lastmonth', 'all'];

/**
 * Strict Structured Outputs requires every property to be listed in `required`
 * and `additionalProperties: false` everywhere. Optional fields are therefore
 * expressed as nullable rather than absent — which is exactly how
 * lib/intent.js already reads them.
 *
 * `categoryIds` comes from the request, so the enum is the user's real
 * categories including any they created themselves.
 */
export function buildSchema(categoryIds = []) {
  const category = { type: ['string', 'null'], enum: [...categoryIds, null] };

  return {
    type: 'object',
    additionalProperties: false,
    required: ['type', 'say', 'query', 'expense', 'filter', 'scope', 'question', 'options'],
    properties: {
      type: {
        type: 'string',
        enum: ['answer', 'propose_add', 'find_delete_candidates', 'undo', 'clarify'],
      },
      say: { type: ['string', 'null'], description: 'One short sentence of context. No figures.' },

      query: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['metric', 'period', 'category', 'category_terms'],
        properties: {
          metric: { type: 'string', enum: METRICS },
          period: { type: 'string', enum: PERIODS },
          category,
          // Every category-like word in the sentence, verbatim and unmapped.
          // The application compares this against `category` to catch a
          // question being silently narrowed.
          category_terms: {
            type: 'array',
            items: { type: 'string' },
            description: 'Each distinct category or spending-area the sentence names, in the user\u2019s own words, unmapped. Empty if none.',
          },
        },
      },

      expense: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['description', 'amount', 'category', 'date', 'notes'],
        properties: {
          description: { type: 'string' },
          // A string, so "4.50" survives intact. lib/actions.js parses it.
          amount: { type: ['string', 'null'] },
          category,
          date: { type: ['string', 'null'], description: 'YYYY-MM-DD, or null for today.' },
          notes: { type: ['string', 'null'] },
        },
      },

      filter: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['description', 'amount', 'date', 'category'],
        properties: {
          description: { type: ['string', 'null'] },
          amount: { type: ['string', 'null'] },
          date: { type: ['string', 'null'] },
          category,
        },
      },

      scope: { type: ['string', 'null'], enum: ['last_assistant', null] },
      question: { type: ['string', 'null'] },
      options: { type: ['array', 'null'], items: { type: 'string' } },
    },
  };
}

export const SYSTEM_PROMPT = `You turn a person's sentence about their spending into exactly one intent.

You never calculate. You never state an amount, a total or an average. The
application computes every figure from the real records and discards any number
you produce.

Set "type" to one of: answer, propose_add, find_delete_candidates, undo, clarify.
Fill only the object that type needs and leave the others null.

Rules:
- category must be one of the ids provided, or null. Never invent one.
- List every category-like word the sentence uses in query.category_terms, in
  the user's own words, even when you cannot map them. "groceries and
  entertainment" is two terms. Set category only when exactly one term maps
  clearly to a provided id; otherwise leave category null and still list the
  terms. Never map an unrelated word onto a category because it is the only one
  available.
- For propose_add the category is REQUIRED. If the sentence does not make it
  clear, use clarify instead of guessing.
- If the amount is missing or ambiguous, use clarify. Never invent one.
- For a deletion, describe what to look for in filter. Never supply an id; the
  application resolves the match against the real records.
- Prefer clarify over a confident guess.
- "say" may hold one short sentence of context. It must contain no figures.`;

/* ── Model availability ────────────────────────────────────────── */

/**
 * Confirms the configured model is actually reachable by this key.
 *
 * Worth doing explicitly: a model id that the account cannot use fails at
 * request time with a 404 that reads like a bug in this code. Run it at
 * startup, or with `npm run verify`.
 */
export async function verifyModel(model = MODEL) {
  if (!isConfigured()) throw new ProviderNotConfigured('OPENAI_API_KEY is not set.');
  try {
    const found = await getClient().models.retrieve(model);
    return { ok: true, model: found.id };
  } catch (err) {
    const status = err?.status ?? null;
    return { ok: false, model, status, reason: describe(err), hint: hintFor(status) };
  }
}

/** What to actually do about it. A 401 is not fixed by changing the model. */
export function hintFor(status) {
  switch (status) {
    case 401: return 'Check OPENAI_API_KEY in backend/.env — the key was not accepted.';
    case 403: return 'This key is not permitted to use that model. Try another OPENAI_MODEL, or check the project\u2019s model permissions.';
    case 404: return 'Set OPENAI_MODEL to a model id this project can use.';
    case 429: return 'The account is rate limited or out of quota. Check billing and usage limits.';
    default:  return 'Check network access to the provider, then try again.';
  }
}

/** Error text that never includes credentials. */
function describe(err) {
  const status = err?.status;
  if (status === 401) return 'The API key was rejected (401).';
  if (status === 403) return 'This key is not permitted to use that model (403).';
  if (status === 404) return 'That model id is not available to this project (404).';
  if (status === 429) return 'Rate limited or out of quota (429).';
  if (status >= 500) return `The provider returned ${status}.`;
  if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') return 'The provider was unreachable.';
  return err?.message ? String(err.message).slice(0, 200) : 'Unknown provider error.';
}

/* ── The request ───────────────────────────────────────────────── */

/**
 * Ask the model to turn `message` into one intent.
 *
 * @returns the parsed object, to be validated by the caller against
 *   lib/intent.js. It is never trusted as-is.
 */
export async function requestIntent({ message, context = {} }) {
  const openai = getClient();
  const categoryIds = Array.isArray(context.categories)
    ? context.categories.map((c) => c.id).filter(Boolean)
    : [];

  // Category names and today's date. Not the expense rows — see server.js.
  const contextLine = [
    `Today is ${context.today || 'unknown'}.`,
    categoryIds.length
      ? `Categories: ${context.categories.map((c) => `${c.id} (${c.label})`).join(', ')}.`
      : 'No categories are defined.',
    `The person has ${context.expenseCount ?? 0} recorded expenses.`,
  ].join(' ');

  let response;
  try {
    response = await openai.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input: [{ role: 'user', content: `${contextLine}\n\nSentence: ${message}` }],
      text: {
        format: {
          type: 'json_schema',
          name: 'expense_intent',
          strict: true,
          schema: buildSchema(categoryIds),
        },
      },
      // One intent is a short answer; this is a ceiling, not a target.
      max_output_tokens: 400,
    });
  } catch (err) {
    if (err?.status === 401 || err?.status === 403) {
      throw new ProviderNotConfigured(describe(err));
    }
    throw new ProviderFailed('provider_error', describe(err), err?.status ?? 502);
  }

  const text = response.output_text;
  if (!text) throw new ProviderFailed('empty_response', 'The model returned nothing.');

  try {
    return JSON.parse(text);
  } catch {
    // Structured Outputs should make this impossible; if it happens, the
    // fallback is better than a crash.
    throw new ProviderFailed('unparsable_response', 'The model did not return JSON.');
  }
}
