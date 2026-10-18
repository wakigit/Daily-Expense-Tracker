import { dialogueIntent } from '../../src/lib/assistantDialogue.js';
/**
 * What the two assistant routes actually do, with no HTTP in it.
 *
 * Extracted so the same code answers in two places: the local `node:http`
 * server in `server.js`, and the Vercel Functions in `/api`. The alternative
 * was a second copy of the validation, the size caps and the MIME allowlist,
 * which is the kind of duplication that ends with one half of a security check
 * being fixed and the other half not.
 *
 * Each handler takes an already-parsed body and returns `{ status, body }`.
 * Transport decides how to read the request and how to write the reply; this
 * decides what the reply is.
 */

import { validateRoastInput, validateRoastOutput } from '../../src/lib/roastContract.js';
import { roastDiagnostic } from '../../src/lib/roastDiagnostics.js';
import { validateIntent, intentDiagnostic } from '../../src/lib/intent.js';
import { validateReceipt, MAX_UPLOAD_BYTES, RECEIPT_ERR } from '../../src/lib/receipt.js';
import { requestIntent, requestReceipt, requestRoast, ProviderNotConfigured } from './provider.js';

/** Request bodies above this are refused before anything reads them. */
export const MAX_BODY_BYTES = 8 * 1024;

/**
 * The receipt route is the one exception, because it carries an image.
 *
 * Base64 costs four bytes for every three, so the wire budget is the decoded
 * limit plus a third, plus room for the category context alongside it.
 */
export const MAX_IMAGE_BODY_BYTES = Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + MAX_BODY_BYTES;

/** Image types that may be interpolated into the provider's data URL. */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const asObject = (v) => (typeof v === 'object' && v !== null ? v : {});

/** Turns a thrown provider error into the status the frontend expects. */
function providerFailure(err) {
  // 503 is the signal the frontend falls back on.
  if (err instanceof ProviderNotConfigured) return { status: 503, body: { error: err.code } };
  return { status: err?.status ?? 500, body: { error: err?.code ?? 'internal_error' } };
}

/** `GET /health` — a liveness signal, and nothing a caller can act on. */
export function handleHealth({ startedAt = Date.now() } = {}) {
  return {
    status: 200,
    body: {
      status: 'ok',
      service: 'daily-expense-tracker-backend',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * `POST /assistant/intent` — a sentence in, one validated intent out.
 *
 * The model's answer is validated HERE as well as on the client. A malformed
 * intent never leaves the server, and the client never trusts that it didn't.
 */
export async function handleIntent(rawBody, { request = requestIntent } = {}) {
  const body = asObject(rawBody);
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return { status: 400, body: { error: 'message_required' } };

  const context = asObject(body.context);
  const cats = Array.isArray(context.categories) ? context.categories : [];

  try {
    const raw = dialogueIntent(message, cats) ?? await request({ message, context });
    const checked = validateIntent(raw, { cats, message });
    if (!checked.ok) {
      return { status: 502, body: { error: 'invalid_intent', detail: intentDiagnostic(checked.error) } };
    }
    return { status: 200, body: { intent: checked.intent } };
  } catch (err) {
    return providerFailure(err);
  }
}

/**
 * `POST /assistant/receipt` — a photograph in, one validated draft out.
 *
 * Returns a proposal, like the intent route: the fields land in the Add form
 * and a person approves them before anything is written.
 */
export async function handleReceipt(rawBody) {
  const body = asObject(rawBody);

  const image = asObject(body.image);
  const base64 = typeof image.base64 === 'string' ? image.base64 : '';
  if (!base64) return { status: 400, body: { error: 'image_required' } };

  // Checked here as well as in the browser. The client downscales to a tenth
  // of this, so anything near the limit did not come from the app.
  const decodedBytes = Math.ceil((base64.length * 3) / 4);
  if (decodedBytes > MAX_UPLOAD_BYTES) {
    return { status: 413, body: { error: 'image_too_large', maxBytes: MAX_UPLOAD_BYTES } };
  }

  // An allowlist, not a pass-through. mimeType is interpolated into the data
  // URL sent to the provider, so an arbitrary string from the request would be
  // writing part of that URL.
  const mimeType = ALLOWED_IMAGE_TYPES.includes(image.mimeType) ? image.mimeType : 'image/jpeg';

  const context = asObject(body.context);
  const cats = Array.isArray(context.categories) ? context.categories : [];

  try {
    const raw = await requestReceipt({ base64, mimeType, context });
    const checked = validateReceipt(raw, { cats, today: context.today ?? '' });
    if (!checked.ok) {
      // "Not a receipt" is the model doing its job, not a failure of this
      // server. 422 so the client can tell the two apart and say something
      // useful instead of "something went wrong". The codes in RECEIPT_ERR
      // already carry the `receipt_` prefix the client switches on.
      const status = checked.error.code === RECEIPT_ERR.NOT_A_RECEIPT ? 422 : 502;
      return { status, body: { error: checked.error.code } };
    }
    return { status: 200, body: { draft: checked.draft } };
  } catch (err) {
    return providerFailure(err);
  }
}

/** Validated aggregates only. Public callers can forge facts; the app computes its own. */
export async function handleRoast(rawBody, { request = requestRoast } = {}) {
  const started = performance.now();
  const checked = validateRoastInput(rawBody);
  if (!checked.ok) return { status: checked.code === 'roast_too_large' ? 413 : 400, body: { error: checked.code, diagnostic: roastDiagnostic('roast_input_invalid', { completion: 'not_started' }) } };
  try {
    const result = await request(checked.value);
    const diagnostic = roastDiagnostic('roast_ok', result?.diagnostic ?? { elapsedMs: performance.now() - started });
    const output = validateRoastOutput(result?.output ?? result, checked.value);
    if (!output.ok) {
      const failure = roastDiagnostic('roast_server_output_invalid', { ...diagnostic, validation: output.reason });
      console.info('[roast diagnostic]', JSON.stringify(failure));
      return { status: 502, body: { error: 'invalid_roast', diagnostic: failure } };
    }
    console.info('[roast diagnostic]', JSON.stringify(diagnostic));
    return { status: 200, body: { text: output.text, diagnostic } };
  } catch (error) {
    const diagnostic = roastDiagnostic(error?.diagnostic?.code, error?.diagnostic ?? { elapsedMs: performance.now() - started });
    console.info('[roast diagnostic]', JSON.stringify(diagnostic));
    return { status: 503, body: { error: 'roast_unavailable', diagnostic } };
  }
}
