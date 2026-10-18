import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { readBody, withGuards } from '../../api/_shared.js';
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
