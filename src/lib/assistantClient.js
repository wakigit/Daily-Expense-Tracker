/**
 * Talks to the backend, and knows when to give up.
 *
 * The offline matcher in lib/ask.js is not a placeholder — it is the fallback,
 * and it stays usable forever. Any failure here (no backend running, no
 * provider configured, a timeout, a malformed intent) returns `ok: false` and
 * the caller answers from lib/ask.js instead. The app is never worse off for
 * the model being unreachable, which matters because the deployed build on
 * GitHub Pages has no backend to call at all.
 *
 * No key is read here and none ever will be. This runs in the browser; a key
 * reaching it is a published key.
 */

import { dialogueIntent } from './assistantDialogue.js';
import { validateIntent, buildContext, intentDiagnostic } from './intent';

/**
 * Where the backend lives. A URL, not a secret, so VITE_ is correct here —
 * unlike an API key, which must never carry that prefix because Vite inlines
 * every VITE_* variable into the public bundle.
 */
export const ASSISTANT_URL =
  import.meta.env?.VITE_ASSISTANT_URL ?? 'http://127.0.0.1:8787';

const TIMEOUT_MS = 12_000;

/** The local answer remains available when the model request fails. */
export function explainIntentFailure(reason) {
  switch (reason) {
    case 'provider_not_configured': return 'Answered offline. No model is connected.';
    case 'provider_key_rejected': return 'Answered offline. The server AI key was rejected.';
    case 'provider_access_denied': return 'Answered offline. AI access was denied. Check the server key and model permissions.';
    case 'unreachable': case 'no_fetch': case 'provider_connection_failed': return 'Answered offline. Connection to the assistant failed.';
    case 'timeout': case 'provider_timeout': return 'Answered offline. The assistant request timed out.';
    case 'invalid_intent': case 'unreadable_response': case 'empty_response': case 'unparsable_response': return 'Answered offline. AI interpretation failed validation.';
    case 'provider_error': return 'Answered offline. The model provider request failed.';
    case 'http_404': case 'http_405': return 'Answered offline. The assistant endpoint is unavailable.';
    default: return reason?.startsWith('intent_') ? 'Answered offline. AI interpretation failed validation.' : 'Answered offline. The assistant request failed.';
  }
}

/**
 * @returns {Promise<{ok: true, intent: object} | {ok: false, reason: string}>}
 *   Never throws. A rejected promise here would mean an unanswered message.
 */
export async function requestIntent(message, { cats, today, expenses, fetchImpl, url } = {}) {
  const local=dialogueIntent(message);
  if(local) {
    const checked=validateIntent(local,{cats,message});
    if(checked.ok) return {ok:true,intent:checked.intent,source:'builtin'};
  }
  const endpoint = `${url ?? ASSISTANT_URL}/assistant/intent`;
  const doFetch = fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { ok: false, reason: 'no_fetch' };

  // Only the category vocabulary and today's date leave the device. Not the rows.
  const context = buildContext({ cats, today, expenses });

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const res = await doFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
      signal: controller?.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const diagnostic=body.error==='invalid_intent'?intentDiagnostic(body.detail):null;
      if(diagnostic) console.info('[assistant diagnostic]',JSON.stringify({phase:'server',httpStatus:res.status,...diagnostic}));
      return { ok: false, reason: body.error ?? `http_${res.status}`, ...(diagnostic?{diagnostic}:{}), httpStatus:res.status };
    }

    const body = await res.json().catch(() => null);
    if (!body || typeof body !== 'object') return { ok: false, reason: 'unreadable_response' };

    // Validated again on arrival. The server already checked, but a frontend
    // that trusts its backend is one compromised backend away from executing
    // whatever it is handed.
    const checked = validateIntent(body.intent, { cats, message });
    if (!checked.ok) {
      const diagnostic=intentDiagnostic(checked.error);
      console.info('[assistant diagnostic]',JSON.stringify({phase:'client',httpStatus:res.status,...diagnostic}));
      return {ok:false,reason:diagnostic.code,diagnostic,httpStatus:res.status};
    }

    return { ok: true, intent: checked.intent, endpoint, httpStatus: res.status };
  } catch (err) {
    return { ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
