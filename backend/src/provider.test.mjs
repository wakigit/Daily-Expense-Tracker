/**
 * Provider checks that need no key and make no network call.
 *
 * The live path is covered by `npm run verify`, which does need a key. These
 * cover the parts that are pure: the Structured Outputs schema, and the
 * promise that nothing works — or leaks — without a key.
 */

import assert from 'node:assert/strict';
import {
  buildSchema, buildReceiptSchema, RECEIPT_PROMPT, isConfigured, MODEL, DEFAULT_MODEL,
  requestIntent, requestReceipt, verifyModel, ProviderNotConfigured,
} from './provider.js';
import { validateIntent } from '../../src/lib/intent.js';
import { validateReceipt } from '../../src/lib/receipt.js';

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
  assert.deepEqual(schema.properties.query.anyOf[0].properties.category.enum, ['food', 'hire', null]);
  assert.deepEqual(schema.properties.expense.properties.category.enum, ['food', 'hire', null]);
  assert.deepEqual(schema.properties.filter.properties.category.enum, ['food', 'hire', null]);
});

check('schema: a user-created category reaches the enum', () => {
  assert.deepEqual(buildSchema(['food', 'cat_123']).properties.query.anyOf[0].properties.category.enum,
    ['food', 'cat_123', null]);
});

check('schema: query carries the unmapped category words', () => {
  const q = schema.properties.query.anyOf[0];
  assert.ok(q.required.includes('category_terms'));
  assert.equal(q.properties.category_terms.type, 'array');
  assert.equal(q.properties.category_terms.items.type, 'string');
});

check('schema: model intents use canonical reads and preserve actions', () => {
  assert.deepEqual(schema.properties.type.enum,
    ['help', 'analyze', 'propose_add', 'find_delete_candidates', 'undo', 'clarify']);
});

check('schema: general query contract includes comparisons, filters and custom categories', () => {
  const q = schema.properties.query.anyOf[0];
  assert.ok(q.properties.operation.enum.includes('compare'));
  assert.deepEqual(q.properties.category.enum, ['food', 'hire', null]);
  assert.deepEqual(q.properties.amountOperator.enum, ['gt','lt','gte','lte',null]);
  assert.ok(q.properties.groupBy.enum.includes('weekday'));
  assert.equal(validateIntent({type:'analyze',query:{operation:'compare',period:'all'}},{cats:[]}).ok,false);
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

/* ── The receipt schema plays by the same strict rules. ── */

const receiptSchema = buildReceiptSchema(CATS);

check('receipt schema: every object forbids extra properties', () => {
  everyObject(receiptSchema, (o) => assert.equal(o.additionalProperties, false));
});

check('receipt schema: every object property is required', () => {
  everyObject(receiptSchema, (o) => {
    const props = Object.keys(o.properties ?? {});
    assert.deepEqual([...(o.required ?? [])].sort(), props.sort());
  });
});

check('receipt schema: the category enum is the caller’s ids plus null', () => {
  assert.deepEqual(receiptSchema.properties.category.enum, ['food', 'hire', null]);
});

check('receipt schema: with no categories, only null is offered', () => {
  assert.deepEqual(buildReceiptSchema([]).properties.category.enum, [null]);
});

check('receipt schema: the total is a string, so "4.50" survives intact', () => {
  assert.ok(receiptSchema.properties.amount.type.includes('string'));
  assert.ok(receiptSchema.properties.amount.type.includes('null'));
});

check('receipt schema: every field but isReceipt may be null', () => {
  for (const key of ['description', 'amount', 'currency', 'date', 'category']) {
    assert.ok(receiptSchema.properties[key].type.includes('null'), `${key} cannot be null`);
  }
  assert.equal(receiptSchema.properties.isReceipt.type, 'boolean');
});

/* The prompt is load-bearing: these three instructions are the difference
   between a usable scan and a confidently wrong one. */
check('receipt prompt: names the total, not the subtotal', () => {
  assert.match(RECEIPT_PROMPT, /subtotal/i);
  assert.match(RECEIPT_PROMPT, /FINAL TOTAL PAID/);
});
check('receipt prompt: forbids inventing a category', () => {
  assert.match(RECEIPT_PROMPT, /[Nn]ever invent one/);
});
check('receipt prompt: prefers null over a guess', () => {
  assert.match(RECEIPT_PROMPT, /null/);
});

check('receipt output: a clean scan survives the shared validator', () => {
  const r = validateReceipt({
    isReceipt: true, description: 'Toast Box', amount: '14.90',
    currency: 'SGD', date: '2026-10-15', category: 'food',
  }, { cats, today: '2026-10-16' });
  assert.equal(r.ok, true);
  assert.equal(r.draft.amount, '14.90');
  assert.deepEqual(r.draft.missing, []);
});

check('receipt output: an all-null scan is a draft of nothing, not an error', () => {
  const r = validateReceipt({
    isReceipt: true, description: null, amount: null,
    currency: null, date: null, category: null,
  }, { cats, today: '2026-10-16' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.draft.missing, ['description', 'amount', 'category', 'date']);
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
  await checkAsync('no key: requestReceipt refuses rather than calling out', async () => {
    await assert.rejects(() => requestReceipt({ base64: 'x', mimeType: 'image/jpeg', context: {} }),
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
