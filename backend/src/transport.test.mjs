import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { readBody, withGuards, CORS_ORIGINS } from '../../api/_shared.js';
import { MAX_BODY_BYTES, MAX_IMAGE_BODY_BYTES } from './routes.js';

const tooLarge = (err) => err.status === 413 && err.code === 'body_too_large';

for (const cap of [MAX_BODY_BYTES, MAX_IMAGE_BODY_BYTES]) {
  for (const length of [undefined, '1']) {
    for (const form of ['object', 'string', 'buffer', 'stream']) {
      test(`${cap}: oversized ${form}, content-length ${length}`, async () => {
        const body = { message: '界'.repeat(Math.ceil(cap / 3)) };
        const json = JSON.stringify(body);
        const req = form === 'stream' ? Readable.from([Buffer.from(json)]) : {};
        req.headers = length ? { 'content-length': length } : {};
        if (form !== 'stream') req.body = form === 'object' ? body : form === 'buffer' ? Buffer.from(json) : json;
        await assert.rejects(readBody(req, cap), tooLarge);
      });
    }
  }
}

test('exact UTF-8 size boundary is accepted, one byte less is rejected', async () => {
  const body = { message: '界' };
  const req = { headers: {}, body };
  const size = Buffer.byteLength(JSON.stringify(body));
  assert.deepEqual(await readBody(req, size), body);
  await assert.rejects(readBody(req, size - 1), tooLarge);
});

test('stream cap counts cumulative chunks', async () => {
  const req = Readable.from([Buffer.from('{"a":"'), Buffer.from('x'.repeat(20)), Buffer.from('"}')]);
  req.headers = {};
  await assert.rejects(readBody(req, 20), tooLarge);
});

test('malformed JSON returns 400', async () => {
  await assert.rejects(readBody({ headers: {}, body: '{' }, 20),
    (err) => err.status === 400 && err.code === 'invalid_json');
});

test('guard rejects oversized parsed bodies before calling the provider handler', async () => {
  let called = false;
  const handler = withGuards({ maxBytes: 20, limit: 20, handler: async () => { called = true; } });
  const res = { status(value) { this.code = value; }, setHeader() {}, send(value) { this.body = JSON.parse(value); } };
  await handler({ method: 'POST', headers: {}, body: { message: 'x'.repeat(21) } }, res);
  assert.equal(res.code, 413);
  assert.equal(res.body.error, 'body_too_large');
  assert.equal(called, false);
});

const recorder = () => ({ headers: {}, status(value) { this.code = value; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, send(value) { this.raw = value; this.body = value ? JSON.parse(value) : null; } });

test('cors: GitHub Pages origin gets a preflight answer without reaching the handler', async () => {
  assert.ok(CORS_ORIGINS.includes('https://wakigit.github.io'));
  let called = false;
  const handler = withGuards({ maxBytes: 200, limit: 20, handler: async () => { called = true; return { status: 200, body: {} }; } });
  const res = recorder();
  await handler({ method: 'OPTIONS', headers: { origin: 'https://wakigit.github.io' } }, res);
  assert.equal(res.code, 204);
  assert.equal(res.headers['access-control-allow-origin'], 'https://wakigit.github.io');
  assert.match(res.headers['access-control-allow-methods'], /POST/);
  assert.equal(called, false);
});

test('cors: allowed origin POST carries the allow-origin header', async () => {
  const handler = withGuards({ maxBytes: 200, limit: 20, handler: async () => ({ status: 200, body: { ok: true } }) });
  const res = recorder();
  await handler({ method: 'POST', headers: { origin: 'https://wakigit.github.io', 'x-forwarded-for': '203.0.113.9' }, body: { a: 1 } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'https://wakigit.github.io');
});

test('cors: unknown origins get no allow-origin header and preflight is refused', async () => {
  const handler = withGuards({ maxBytes: 200, limit: 20, handler: async () => ({ status: 200, body: {} }) });
  const pre = recorder();
  await handler({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }, pre);
  assert.equal(pre.code, 405);
  assert.equal(pre.headers['access-control-allow-origin'], undefined);
  const post = recorder();
  await handler({ method: 'POST', headers: { origin: 'https://evil.example', 'x-forwarded-for': '203.0.113.10' }, body: {} }, post);
  assert.equal(post.headers['access-control-allow-origin'], undefined);
});
