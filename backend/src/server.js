/**
 * Health, assistant intent, receipt scanner and purchase roaster routes.
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
 * The full ledger never arrives here. Intent uses category names and today's
 * date; receipts send a user-selected image. The roaster receives only the new
 * purchase and a few locally verified aggregates, never notes or ledger rows.
 *
 * The API key lives in this process's environment and leaves it only in a
 * request to the provider. The browser calls this server; this server calls the
 * provider. A key shipped to the browser is public the moment it ships — see
 * docs/PRD.md §9.
 *
 * Still no dependencies: node:http, and the shared schema imported from the
 * frontend source so the two halves cannot drift apart.
 */

import { MAX_ROAST_BYTES } from '../../src/lib/roastContract.js';
import { createServer } from 'node:http';
import { isConfigured, MODEL } from './provider.js';
import {
  handleHealth, handleIntent, handleReceipt, handleRoast, MAX_BODY_BYTES, MAX_IMAGE_BODY_BYTES,
} from './routes.js';

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

/* The body caps now live in routes.js beside the handlers that depend on them,
   so the Vercel Functions enforce the same numbers rather than their own. */

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
    const out = handleHealth({ startedAt });
    return sendJson(res, out.status, out.body);
  }

  /* The /api prefix is accepted as well as the bare path.

     On Vercel these two live at /api/assistant/intent and
     /api/assistant/receipt, because that is where a Function has to sit. One
     client should not need to know which backend it is talking to, so this
     server answers to both spellings and the frontend only ever appends
     /assistant/... to whatever base it was built with. */
  const route = pathname.replace(/^\/api(?=\/)/, '');

  if (route === '/assistant/intent' || route === '/assistant/receipt' || route === '/assistant/roast') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'method_not_allowed', allow: ['POST'] });
    }
    const isRoast = route === '/assistant/roast';
    const isReceipt = route === '/assistant/receipt';
    try {
      const body = await readJson(req, isRoast ? MAX_ROAST_BYTES : isReceipt ? MAX_IMAGE_BODY_BYTES : MAX_BODY_BYTES);
      const out = isRoast ? await handleRoast(body) : isReceipt ? await handleReceipt(body) : await handleIntent(body);
      return sendJson(res, out.status, out.body);
    } catch (err) {
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
