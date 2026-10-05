/**
 * Two routes: a health check and the assistant.
 *
 * `POST /assistant/intent` takes a sentence plus a little context, asks the
 * model adapter to turn it into one intent, validates that intent against the
 * SAME schema the frontend uses, and returns it. It returns a proposal — never
 * a change, and never a figure.
 *
 * The expense rows never arrive here. The model is given the category names and
 * today's date and nothing else, so no third party ever receives the ledger.
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
import { requestIntent, isConfigured, ProviderNotConfigured, MODEL } from './provider.js';

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

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let overflowed = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (overflowed) return;                 // draining, not buffering
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
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

  return sendJson(res, 404, { error: 'not_found', path: pathname });
});

server.listen(PORT, HOST, () => {
  console.log(`[backend] listening on http://${HOST}:${PORT}`);
  console.log(`[backend] health:    http://${HOST}:${PORT}/health`);
  console.log(`[backend] assistant: POST http://${HOST}:${PORT}/assistant/intent`);
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
