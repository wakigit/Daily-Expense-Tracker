/**
 * Step 2 / B2 — one-off diagnostic for the projection rejections (M36-M40).
 *
 * The 502 the app returns carries a deliberately safe diagnostic (a fixed code
 * and field name, never model output), so the recorded baseline cannot tell us
 * WHICH malformed shape the model sent. Three candidates all produce the
 * identical `query.spendingScope` field: an empty placeholder object, a scope
 * with a label but no inclusions, and a real scope on a projection. They need
 * different fixes, so this spends a strictly bounded number of paid calls to
 * look at the raw pre-validation output.
 *
 * PRIVACY: this prints field NAMES, types and the spendingScope value only.
 * The fixture ledger is never sent (the intent route only ever receives the
 * category vocabulary and today's date), no description text is printed, and
 * no key is read or shown here — the key stays in the backend process
 * environment, which is where this script's import of the provider reads it.
 *
 *   node --env-file-if-exists=backend/.env scripts/eval/b2-probe.mjs
 */

import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { requestIntent, MODEL } from '../../backend/src/provider.js';

const MAX_CALLS = 2;

/* Two budget questions, chosen because all five M36-M40 failed identically and
   these two differ in whether the category has a budget configured at all. */
const PROBES = [
  { id: 'M36', message: 'When will my Food & Drinks budget run out?' },
  { id: 'M40', message: 'When will my Entertainment budget run out?' },
];

/* The same vocabulary the app would send: ids and labels, no rows. */
const context = {
  today: '2026-10-19',
  categories: [
    { id: 'food', label: 'Food & Drinks' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'needs', label: 'Daily Needs' },
    { id: 'shop', label: 'Shopping' },
    { id: 'pub', label: 'Public Transport' },
    { id: 'hire', label: 'Private Hire' },
    { id: 'misc', label: 'Others' },
    { id: 'bbt', label: 'Bubble Tea' },
    { id: 'transport', label: 'Travel (old)' },
  ],
  expenseCount: 100,
};

const shape = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
};

console.log(`model ${MODEL} · at most ${MAX_CALLS} paid calls\n`);

let used = 0;
for (const probe of PROBES) {
  if (used >= MAX_CALLS) break;
  used += 1;
  let raw;
  try {
    raw = await requestIntent({ message: probe.message, context });
  } catch (err) {
    console.log(`${probe.id}: provider threw ${err?.code ?? err?.name} — not retrying`);
    continue;
  }

  console.log('='.repeat(70));
  console.log(`${probe.id}  "${probe.message}"`);
  console.log(`top-level fields: ${Object.keys(raw ?? {}).join(', ')}`);
  console.log(`type: ${JSON.stringify(raw?.type)}`);

  const q = raw?.query;
  console.log(`query: ${shape(q)}`);
  if (q && typeof q === 'object') {
    console.log('query field -> shape (values shown only for the enum/flag fields):');
    for (const key of Object.keys(q)) {
      const safe = ['operation', 'period', 'day', 'groupBy', 'aggregate', 'dayCount', 'start', 'end', 'category', 'amountOperator'];
      const suffix = safe.includes(key) ? ` = ${JSON.stringify(q[key])}` : '';
      console.log(`  ${key.padEnd(16)} ${shape(q[key])}${suffix}`);
    }
    /* The whole point of the probe. */
    console.log(`\n  spendingScope RAW VALUE: ${JSON.stringify(q.spendingScope)}`);
  }
  console.log('');
}

/* Self-logging: a paid-call script that does not write the ledger is a trap,
   because the next person to run it will not remember to. */
if (used > 0) {
  appendFileSync(resolve(process.cwd(), 'scripts/eval/calls.log'),
    `${new Date().toISOString()}\tstep=2\tcalls=${used}\tset=DIAGNOSTIC\tpurpose=B2 raw pre-validation shape probe\n`);
}

console.log(`paid calls used: ${used}`);
