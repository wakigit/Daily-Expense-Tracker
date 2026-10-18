/**
 * Sends a prepared receipt image to the backend and returns a draft.
 *
 * Same shape and same promises as lib/assistantClient.js: no key is read here,
 * nothing throws, and every failure comes back as `{ ok: false, reason }`.
 *
 * Unlike the assistant, there is NO offline fallback. Reading a photograph
 * needs a vision model; lib/ask.js cannot substitute for one. So this feature
 * is the first in the app that simply does not work without a backend, and the
 * deployed GitHub Pages build has none. The button says so plainly when the
 * scan fails rather than failing silently — see `explainFailure` — because the
 * form underneath still works and typing it in is a real answer.
 *
 * The timeout is much longer than the assistant's. A vision request on a 1280px
 * image routinely takes 8–15 seconds, and 12s cut off answers that were about
 * to arrive.
 */

import { validateReceipt } from './receipt';
import { ASSISTANT_URL } from './assistantClient';

const TIMEOUT_MS = 30_000;

/**
 * @param {{base64: string, mimeType: string}} image — from lib/receiptImage.js
 * @returns {Promise<{ok: true, draft: object} | {ok: false, reason: string}>}
 */
export async function requestReceipt(image, { cats = [], today = '', fetchImpl, url } = {}) {
  const endpoint = `${url ?? ASSISTANT_URL}/assistant/receipt`;
  const doFetch = fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { ok: false, reason: 'no_fetch' };
  if (!image?.base64) return { ok: false, reason: 'image_missing' };

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const res = await doFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: { base64: image.base64, mimeType: image.mimeType },
        // The category vocabulary and today's date, exactly as the assistant
        // sends them. No expense rows — the receipt is the only user content
        // that leaves the device here, and it is the one the user just chose.
        context: { today, categories: cats.map((c) => ({ id: c.id, label: c.label })) },
      }),
      signal: controller?.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, reason: body.error ?? `http_${res.status}` };
    }

    const body = await res.json().catch(() => null);
    if (!body || typeof body !== 'object') return { ok: false, reason: 'unreadable_response' };

    // Validated again on arrival, for the reason given in assistantClient.js.
    const checked = validateReceipt(body.draft, { cats, today });
    if (!checked.ok) return { ok: false, reason: checked.error.code };

    return { ok: true, draft: checked.draft };
  } catch (err) {
    return { ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Failure reasons as something a person can act on. */
export function explainFailure(reason) {
  switch (reason) {
    case 'receipt_not_a_receipt':   return "That doesn't look like a receipt — try another photo.";
    case 'timeout':                 return 'That took too long. Try a smaller or clearer photo.';
    case 'unreachable':
    case 'no_fetch':                return 'Scanning is unavailable — the assistant is offline.';
    case 'provider_not_configured': return 'Scanning is unavailable — no model is connected.';
    case 'provider_key_rejected':   return 'Scanning is unavailable. The server AI key was rejected. Your form is unchanged.';
    case 'provider_access_denied':  return 'Scanning is unavailable. AI access was denied. Check the server key and model permissions. Your form is unchanged.';
    case 'image_too_large':         return 'That photo is too large to read.';
    case 'body_too_large':          return 'That photo is too large to send.';
    default:                        return "Couldn't read that one. Try again, or type it in.";
  }
}
