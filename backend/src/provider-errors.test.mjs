import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleIntent, handleReceipt, handleRoast } from './routes.js';
import { requestIntent } from './provider.js';

// Exercise the SDK error path and real route handlers with no key or network.
const previousFetch = globalThis.fetch;
const previousKey = process.env.OPENAI_API_KEY;
let upstreamStatus = 401;
let calls = 0;
let lastRequest;
const rawMarker = 'PRIVATE_UPSTREAM_TEXT_MUST_NOT_ESCAPE';
globalThis.fetch = async (url, options) => {
  lastRequest = JSON.parse(options.body);
  calls += 1;
  return new Response(JSON.stringify({ error: { message: rawMarker, type: 'test_error', code: 'upstream_private_code' } }), {
    status: upstreamStatus, headers: { 'content-type': 'application/json' },
  });
};
process.env.OPENAI_API_KEY = 'test-only-placeholder';

const context = { today: '2026-10-17', categories: [{ id: 'food', label: 'Food' }] };
const endpoints = [
  ['intent', () => handleIntent({ message: 'Food spending this month?', context })],
  ['receipt', () => handleReceipt({ image: { base64: 'eA==', mimeType: 'image/png' }, context })],
];

try {
  for (const [name, call] of endpoints) {
    for (const [status, code, expectedStatus] of [
      [401, 'provider_key_rejected', 503],
      [403, 'provider_access_denied', 503],
      [400, 'provider_error', 400],
    ]) {
      await test(`${name}: upstream ${status} returns only safe code ${code}`, async () => {
        upstreamStatus = status;
        const before = calls;
        assert.deepEqual(await call(), { status: expectedStatus, body: { error: code } });
        assert.equal(calls, before + 1);
      });
    }
  }
  await test('roast: provider errors are fixed, bounded request uses no retry even on 429', async () => {
    upstreamStatus = 429;
    const input = { transaction: { description: 'Fictional kopi', amountCents: 200, category: 'Food' }, facts: [], budget: { band: 'none', intensity: 0, categoryUsagePct: null }, angle: 'absurd_accounting', preferences: { name: '', singapore: false, smu: false } };
    const before = calls;
    const reply = await handleRoast(input);
    assert.equal(reply.status, 503);
    assert.equal(reply.body.error, 'roast_unavailable');
    assert.equal(reply.body.diagnostic.code, 'roast_rate_limited');
    assert.equal(reply.body.diagnostic.httpStatus, 429);
    assert.equal(JSON.stringify(reply).includes(rawMarker), false);
    assert.equal(calls, before + 1);
    assert.equal(lastRequest.max_output_tokens, 100);
    assert.equal(lastRequest.text.format.strict, true);
    assert.deepEqual(JSON.parse(lastRequest.input[0].content), input);
  });
  await test('provider exceptions do not retain raw upstream text', async () => {
    upstreamStatus = 400;
    await assert.rejects(requestIntent({ message: 'Food spending?', context }), (err) => {
      assert.equal(err.code, 'provider_error');
      assert.equal(err.message, 'The provider request failed.');
      return true;
    });
  });
  await test('intent: SDK input separates question from category vocabulary and excludes ledger fields', async () => {
    upstreamStatus=400;
    const message='Largest single expense this month?';
    await assert.rejects(requestIntent({message,context:{...context,expenseCount:2,expenses:[{notes:'LEDGER_CANARY'}],unrelated:'LEDGER_CANARY'}}));
    assert.deepEqual(JSON.parse(lastRequest.input[0].content),{message,context:{today:context.today,categories:context.categories,expenseCount:2}});
    assert.equal(JSON.stringify(lastRequest).includes('LEDGER_CANARY'),false);
    assert.equal(lastRequest.text.format.strict,true);
  });
  delete process.env.OPENAI_API_KEY;
  for (const [name, call] of endpoints) {
    await test(`${name}: missing key stays distinct and makes no provider request`, async () => {
      const before = calls;
      assert.deepEqual(await call(), { status: 503, body: { error: 'provider_not_configured' } });
      assert.equal(calls, before);
    });
  }
} finally {
  globalThis.fetch = previousFetch;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
}
