/**
 * Three routes: a health check, the assistant, and the receipt scanner.
 *
 * `POST /assistant/intent` takes a sentence plus a little context, asks the
 * model adapter to turn it into one intent, validates that intent against the
 * SAME schema the frontend uses, and returns it. It returns a proposal — never
 * a change, and never a figure.
 *
 * `POST /assistant/receipt` takes a photograph and returns a DRAFT expense,
 * validated the same way. It also returns a proposal: the fields land in the
 * Add form and a person approves them before anything is written.
 *
 * The expense rows never arrive here. The model is given the category names and
 * today's date and nothing else, so no third party ever receives the ledger.
 * The receipt route is the one place user content does leave the device — the
 * image itself, which cannot be read without being sent. Nothing else goes
 * with it, and it is opt-in per photo.
 *
 * The API key lives in this process's environment and leaves it only in a
 * request to the provider. The browser calls this server; this server calls the
 * provider. A key shipped to the browser is public the moment it ships — see
 * docs/PRD.md §9.
 *
 * Still no dependencies: node:http, and the shared schema imported from the
 * frontend source so the two halves cannot drift apart.
 */

import { createServer } from 'node:http';
import { validateIntent } from '../../src/lib/intent.js';
import { validateReceipt, MAX_UPLOAD_BYTES } from '../../src/lib/receipt.js';
import {
  requestIntent, requestReceipt, isConfigured, ProviderNotConfigured, MODEL,
} from './provider.js';

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '127.0.0.1';

const startedAt = Date.now();

/**
 * Browser callers must be named explicitly. A wildcard would let any page on
 * the internet drive this server through a visitor's browser.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173,https://wakigit.github.io')
  .split(',').map((s) => s.trim()).filter(Boolean);

/** Refuse oversized bodies rather than buffering whatever arrives. */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * The receipt route is the one exception, because it carries an image.
 *
 * Base64 costs four bytes for every three, so the wire budget is the decoded
 * limit plus a third, plus room for the category context alongside it. The
 * limit itself lives in lib/receipt.js with the client that enforces it first.
 */
const MAX_IMAGE_BODY_BYTES = Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + MAX_BODY_BYTES;

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJson(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let overflowed = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (overflowed) return;                 // draining, not buffering
      size += chunk.length;
      if (size > maxBytes) {
        overflowed = true;
        chunks.length = 0;
        // Reject, but let the request finish arriving. Destroying the socket
        // here means the client gets a dropped connection instead of a 413,
        // which reads as "the server is down" rather than "that was too big".
        reject(Object.assign(new Error('body_too_large'), { code: 'body_too_large', status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('invalid_json'), { code: 'invalid_json', status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/** One place that decides what a JSON response looks like. */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    // Health is a liveness signal: a cached answer is a useless answer.
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // Parsed against a dummy origin so a bare path like "/health?x=1" still
  // yields a pathname, and so query strings never leak into route matching.
  const { pathname } = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (pathname === '/health') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return sendJson(res, 405, { error: 'method_not_allowed', allow: ['GET', 'HEAD'] });
    }
    return sendJson(res, 200, {
      status: 'ok',
      service: 'daily-expense-tracker-backend',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  }

  if (pathname === '/assistant/intent') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'method_not_allowed', allow: ['POST'] });
    }
    try {
      const body = await readJson(req);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) return sendJson(res, 400, { error: 'message_required' });

      const context = typeof body.context === 'object' && body.context !== null ? body.context : {};
      const cats = Array.isArray(context.categories) ? context.categories : [];

      const raw = await requestIntent({ message, context });

      // The model's answer is validated HERE as well as on the client. A
      // malformed intent never leaves the server, and the client never trusts
      // that it didn't.
      const checked = validateIntent(raw, { cats });
      if (!checked.ok) {
        return sendJson(res, 502, { error: 'invalid_intent', detail: checked.error });
      }
      return sendJson(res, 200, { intent: checked.intent });
    } catch (err) {
      if (err instanceof ProviderNotConfigured) {
        // 503 is the signal the frontend falls back on.
        return sendJson(res, 503, { error: err.code });
      }
      const status = err?.status ?? 500;
      return sendJson(res, status, { error: err?.code ?? 'internal_error' });
    }
  }

  if (pathname === '/assistant/receipt') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'method_not_allowed', allow: ['POST'] });
    }
    try {
      const body = await readJson(req, MAX_IMAGE_BODY_BYTES);

      const image = typeof body.image === 'object' && body.image !== null ? body.image : {};
      const base64 = typeof image.base64 === 'string' ? image.base64 : '';
      if (!base64) return sendJson(res, 400, { error: 'image_required' });

      // Checked here as well as in the browser. The client downscales to a
      // tenth of this, so anything near the limit did not come from the app.
      const decodedBytes = Math.ceil((base64.length * 3) / 4);
      if (decodedBytes > MAX_UPLOAD_BYTES) {
        return sendJson(res, 413, { error: 'image_too_large', maxBytes: MAX_UPLOAD_BYTES });
      }

      // An allowlist, not a pass-through. mimeType is interpolated into the
      // data URL sent to the provider, so an arbitrary string from the request
      // would be writing part of that URL.
      const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
      const mimeType = ALLOWED.includes(image.mimeType) ? image.mimeType : 'image/jpeg';

      const context = typeof body.context === 'object' && body.context !== null ? body.context : {};
      const cats = Array.isArray(context.categories) ? context.categories : [];

      const raw = await requestReceipt({ base64, mimeType, context });

      // Same two-sided validation as the intent route: a malformed draft never
      // leaves this server, and the client checks it again anyway.
      const checked = validateReceipt(raw, { cats, today: context.today ?? '' });
      if (!checked.ok) {
        // "Not a receipt" is the model doing its job, not a failure of this
        // server. 422 so the client can tell the two apart and say something
        // useful instead of "something went wrong".
        const status = checked.error.code === 'receipt_not_a_receipt' ? 422 : 502;
        return sendJson(res, status, { error: checked.error.code });
      }
      return sendJson(res, 200, { draft: checked.draft });
    } catch (err) {
      if (err instanceof ProviderNotConfigured) {
        return sendJson(res, 503, { error: err.code });
      }
      const status = err?.status ?? 500;
      return sendJson(res, status, { error: err?.code ?? 'internal_error' });
    }
  }

  return sendJson(res, 404, { error: 'not_found', path: pathname });
});

server.listen(PORT, HOST, () => {
  console.log(`[backend] listening on http://${HOST}:${PORT}`);
  console.log(`[backend] health:    http://${HOST}:${PORT}/health`);
  console.log(`[backend] assistant: POST http://${HOST}:${PORT}/assistant/intent`);
  console.log(`[backend] receipt:   POST http://${HOST}:${PORT}/assistant/receipt`);
  console.log(`[backend] provider:  ${isConfigured()
    ? `OpenAI, model ${MODEL}`
    : 'NOT configured — the app falls back to its offline matcher'}`);
  if (isConfigured()) console.log('[backend] run `npm run verify` to confirm that model is available');
});

// Without this, Ctrl-C leaves the port held during a quick restart.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n[backend] ${signal} — closing`);
    server.close(() => process.exit(0));
  });
}
