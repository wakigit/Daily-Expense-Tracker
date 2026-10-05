/**
 * Provider checks that need no key and make no network call.
 *
 * The live path is covered by `npm run verify`, which does need a key. These
 * cover the parts that are pure: the Structured Outputs schema, and the
 * promise that nothing works — or leaks — without a key.
 */

import assert from 'node:assert/strict';
import { buildSchema, isConfigured, MODEL, DEFAULT_MODEL, requestIntent, verifyModel, ProviderNotConfigured } from './provider.js';
import { validateIntent } from '../../src/lib/intent.js';

const checks = [];
const check = (name, fn) => {
  try { fn(); checks.push([name, true, '']); }
  catch (err) { checks.push([name, false, err.message]); }
};
const checkAsync = async (name, fn) => {
  try { await fn(); checks.push([name, true, '']); }
  catch (err) { checks.push([name, false, err.message]); }
};

const CATS = ['food', 'hire'];
const schema = buildSchema(CATS);

/* ── Strict Structured Outputs has rules; breaking them 400s at request time. */
const everyObject = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'object' || (Array.isArray(node.type) && node.type.includes('object'))) visit(node);
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) v.forEach((x) => everyObject(x, visit));
    else everyObject(v, visit);
  }
};

check('schema: every object forbids extra properties', () => {
  everyObject(schema, (o) => assert.equal(o.additionalProperties, false, 'missing additionalProperties:false'));
});

check('schema: every object property is required', () => {
  everyObject(schema, (o) => {
    const props = Object.keys(o.properties ?? {});
    assert.deepEqual([...(o.required ?? [])].sort(), props.sort());
  });
});

check('schema: the category enum is the real ids plus null', () => {
  assert.deepEqual(schema.properties.query.properties.category.enum, ['food', 'hire', null]);
  assert.deepEqual(schema.properties.expense.properties.category.enum, ['food', 'hire', null]);
  assert.deepEqual(schema.properties.filter.properties.category.enum, ['food', 'hire', null]);
});

check('schema: a user-created category reaches the enum', () => {
  assert.deepEqual(buildSchema(['food', 'cat_123']).properties.query.properties.category.enum,
    ['food', 'cat_123', null]);
});

check('schema: query carries the unmapped category words', () => {
  const q = schema.properties.query;
  assert.ok(q.required.includes('category_terms'));
  assert.equal(q.properties.category_terms.type, 'array');
  assert.equal(q.properties.category_terms.items.type, 'string');
});

check('schema: the intent types match lib/intent.js', () => {
  assert.deepEqual(schema.properties.type.enum,
    ['answer', 'propose_add', 'find_delete_candidates', 'undo', 'clarify']);
});

/* ── Anything the schema permits must survive lib/intent.js. ── */
const cats = [{ id: 'food', label: 'Food' }, { id: 'hire', label: 'Private hire' }];
const shaped = (over) => ({
  type: 'answer', say: null, query: null, expense: null,
  filter: null, scope: null, question: null, options: null, ...over,
});

check('schema output: an answer validates', () => {
  const r = validateIntent(shaped({ query: { metric: 'total', period: 'week', category: 'food', category_terms: ['food'] } }), { cats });
  assert.equal(r.ok, true);
  assert.deepEqual(r.intent.query.categoryTerms, ['food']);
});
check('schema output: a propose_add validates', () => {
  const r = validateIntent(shaped({
    type: 'propose_add',
    expense: { description: 'Kopi', amount: '1.40', category: 'food', date: null, notes: null },
  }), { cats });
  assert.equal(r.ok, true);
  assert.equal(r.intent.expense.amount, '1.40');
});
check('schema output: nulled-out sibling fields do not break validation', () => {
  const r = validateIntent(shaped({ type: 'undo', scope: 'last_assistant' }), { cats });
  assert.equal(r.ok, true);
});
check('schema output: a clarify validates', () => {
  const r = validateIntent(shaped({ type: 'clarify', question: 'Which category?', options: ['Food'] }), { cats });
  assert.equal(r.ok, true);
});

/* ── No key: refuse, do not crash, do not leak. ── */
check('model id is configurable and defaults sensibly', () => {
  assert.equal(typeof MODEL, 'string');
  assert.ok(MODEL.length > 0);
  assert.equal(DEFAULT_MODEL, 'gpt-4.1-mini');
});

if (!process.env.OPENAI_API_KEY) {
  check('no key: isConfigured reports false', () => assert.equal(isConfigured(), false));
  await checkAsync('no key: requestIntent refuses rather than calling out', async () => {
    await assert.rejects(() => requestIntent({ message: 'hi', context: {} }),
      (e) => e instanceof ProviderNotConfigured && e.status === 503);
  });
  await checkAsync('no key: verifyModel refuses too', async () => {
    await assert.rejects(() => verifyModel(), (e) => e instanceof ProviderNotConfigured);
  });
  check('no key: the error text carries no credential', () => {
    const e = new ProviderNotConfigured('OPENAI_API_KEY is not set.');
    assert.ok(!/sk-/.test(e.message));
  });
}

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok, detail] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
process.exit(failed.length ? 1 : 0);
