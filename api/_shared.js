/**
 * The plumbing both Vercel Functions share.
 *
 * The Functions are deliberately thin. Everything that decides what an answer
 * is — the schema validation, the size caps, the MIME allowlist — lives in
 * `backend/src/routes.js` and is the same code the local `node:http` server
 * runs. This file only turns a Vercel request into a parsed body and a reply.
 *
 * ── On keeping a public demo endpoint from becoming someone else's free
 *    OCR service ────────────────────────────────────────────────────────
 *
 * CORS does not do this. It is enforced by browsers and governs which *pages*
 * may read a response; `curl` ignores it, and the endpoint's URL necessarily
 * ships inside the public client bundle. Four things actually help, in
 * descending order of how much:
 *
 * 1. **A hard spend cap at the provider.** The only control that still holds
 *    when something here has a bug. It has to be turned on deliberately, a
 *    spend *alert* is only a notification, and even a hard limit can overshoot
 *    slightly because usage is metered with a lag — so set a number whose
 *    overshoot is affordable. This is a dashboard setting, not code.
 * 2. **A platform rate limit** in front of the Function (Vercel's firewall
 *    rules / Attack Challenge Mode). This runs before the Function and before
 *    any provider call, which is the only place a limiter can be both cheap
 *    and reliable.
 * 3. **The per-IP limiter below** — honest about what it is: best-effort.
 *    Serverless instances do not share memory, so a burst spread across cold
 *    starts slips through. It stops the obvious loop, not a determined one.
 * 4. **Small, bounded requests**: the body caps and the provider's own
 *    `max_output_tokens`, both already enforced in the shared code.
 *
 * A token baked into the frontend build is NOT on this list. It ships in the
 * public bundle and can be copied in seconds; it raises the effort of casual
 * abuse and nothing more.
 */

/**
 * Per-IP sliding window, per instance.
 *
 * Deliberately simple and deliberately not trusted: see the note above. The
 * map is bounded so a spray of unique IPs cannot grow it without limit.
 */
const WINDOW_MS = 60_000;
const MAX_IPS = 2_000;
const hits = new Map();

export function rateLimit(req, limit) {
  const now = Date.now();
  // x-forwarded-for is set by Vercel's proxy; the first entry is the client.
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';

  if (hits.size > MAX_IPS) hits.clear();

  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return { ok: false, retryAfter };
  }
  recent.push(now);
  hits.set(ip, recent);
  return { ok: true };
}

/** Reads the body whatever form Vercel hands it over in, with a hard cap. */
export async function readBody(req, maxBytes) {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > maxBytes) {
    const err = new Error('body_too_large');
    err.code = 'body_too_large';
    err.status = 413;
    throw err;
  }

  // Vercel parses JSON bodies for us when the content type says so. When it
  // does not, fall back to reading the stream — still counting bytes, because
  // a missing content-length is not a small body.
  if (req.body !== undefined && req.body !== null) {
    const encoded = typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? req.body : JSON.stringify(req.body);
    assertBodySize(Buffer.byteLength(encoded, 'utf8'), maxBytes);
    return safeParse(Buffer.isBuffer(encoded) ? encoded.toString('utf8') : encoded);
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
    size += bytes.length;
    assertBodySize(size, maxBytes);
    chunks.push(bytes);
  }
  return chunks.length ? safeParse(Buffer.concat(chunks).toString('utf8')) : {};
}

function assertBodySize(size, maxBytes) {
  if (size <= maxBytes) return;
  const err = new Error('body_too_large');
  err.code = 'body_too_large';
  err.status = 413;
  throw err;
}

function safeParse(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const err = new Error('invalid_json');
    err.code = 'invalid_json';
    err.status = 400;
    throw err;
  }
}

export function sendJson(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Same-origin on Vercel, so there is no CORS to grant — and granting none is
  // the right default for an endpoint that costs money to call.
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
}

/**
 * Wraps a handler with the method check, the size cap and the limiter, so
 * neither Function repeats them and neither can quietly skip one.
 */
export function withGuards({ maxBytes, limit, handler }) {
  return async function vercelHandler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'method_not_allowed', allow: ['POST'] });
    }

    const gate = rateLimit(req, limit);
    if (!gate.ok) {
      res.setHeader('Retry-After', String(gate.retryAfter));
      return sendJson(res, 429, { error: 'rate_limited', retryAfterSeconds: gate.retryAfter });
    }

    try {
      const body = await readBody(req, maxBytes);
      const out = await handler(body);
      return sendJson(res, out.status, out.body);
    } catch (err) {
      // Never the provider's raw text, never the key — only a code.
      return sendJson(res, err?.status ?? 500, { error: err?.code ?? 'internal_error' });
    }
  };
}
