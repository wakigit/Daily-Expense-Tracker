/**
 * One real Responses API request, end to end.
 *
 *   npm run verify:live
 *
 * `npm run verify` only asks whether the model can be retrieved. That passes
 * with a key that has no quota, no Responses access, or a project policy that
 * blocks the call — so it is not evidence the assistant works. This sends an
 * actual request through the same `requestIntent` the server uses and validates
 * the reply with the same `validateIntent` the app uses.
 *
 * It is the only command here that spends money. Ordinary tests stay mocked.
 *
 * What it will not print:
 *   - the API key, or any part of it
 *   - the raw provider response
 *   - any free text the model produced
 *
 * It reports the fields that come from closed enums — the intent type, and the
 * metric, period and category of an answer. Those cannot carry arbitrary text,
 * so echoing them is safe and is enough to tell whether the model understood.
 */

import { requestIntent, verifyModel, isConfigured, MODEL } from './provider.js';
import { validateIntent } from '../../src/lib/intent.js';

/* Read-only, no personal data, and the categories are invented for the check. */
const SAMPLE_QUESTION = 'How much did I spend on food this week?';
const SAMPLE_CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'hire', label: 'Private hire' },
];
const SAMPLE_CONTEXT = {
  today: new Date().toISOString().slice(0, 10),
  categories: SAMPLE_CATEGORIES,
  expenseCount: 12,
  hasData: true,
};

const line = (label, value) => console.log(`${label.padEnd(20)} ${value}`);

function bail(message, hint) {
  console.log(`\n  ${message}\n`);
  if (hint) console.log(`${hint}\n`);
  process.exit(1);
}

console.log('\nOpenAI live request check\n');
line('OPENAI_API_KEY', isConfigured() ? 'present' : 'MISSING');
line('OPENAI_MODEL', MODEL);

if (!isConfigured()) {
  bail('OPENAI_API_KEY is not set — no request was made.', `  cd backend
  cp .env.example .env     # put the key in .env, never in the repo
  npm run verify:live

The app runs without it: the assistant falls back to its offline matcher.`);
}

// Retrieve first, so "model not available" is reported as itself rather than
// as a failed request.
const available = await verifyModel();
line('model available', available.ok ? `yes — ${available.model}` : 'NO');
if (!available.ok) {
  bail(available.reason, `  ${available.hint}`);
}

line('sample question', JSON.stringify(SAMPLE_QUESTION));
console.log('\nsending one request…\n');

let raw;
try {
  raw = await requestIntent({ message: SAMPLE_QUESTION, context: SAMPLE_CONTEXT });
} catch (err) {
  // provider.js maps provider errors to fixed strings by status code, so this
  // cannot carry a credential or a response body.
  line('result', 'REQUEST FAILED');
  line('reason', err?.message ?? 'unknown');
  bail('The request did not complete.',
    '  401 key rejected · 403 not permitted · 404 model unavailable · 429 out of quota');
}

const checked = validateIntent(raw, { cats: SAMPLE_CATEGORIES });
if (!checked.ok) {
  // Our own error code and field — not the model's output.
  line('result', 'INVALID INTENT');
  line('reason', checked.error.code);
  if (checked.error.field) line('field', checked.error.field);
  bail('The model replied, but not in the agreed shape.',
    '  The reply itself is not printed. Structured Outputs should make this\n  impossible, so treat it as a schema or model mismatch.');
}

const { intent } = checked;
line('result', 'OK');
line('intent type', intent.type);

if (intent.type === 'answer') {
  line('metric', intent.query.metric);
  line('period', intent.query.period);
  line('category', intent.query.category ?? '(none)');
  const sensible = intent.query.metric === 'total' && intent.query.category === 'food';
  console.log(`\n${sensible
    ? 'The model read the sample question correctly.'
    : 'The request worked, though the model read the sample question differently than expected —\nthat is a prompt-quality observation, not a configuration failure.'}`);
} else {
  console.log(`\nThe request worked. The model chose "${intent.type}" for a question that was\nexpected to be an "answer" — again a prompt observation, not a failure.`);
}

console.log('\nNo figure came from the model; the app computes those from the real records.\n');
