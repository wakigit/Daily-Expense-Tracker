/**
 * Exports the app's own invented sample transactions to JSON for the Chroma demo.
 *
 * This imports `buildSample` from src/lib rather than re-typing the rows, so the
 * index is built over exactly the data the app itself loads from Settings. It
 * reads from src/ and writes only inside tools/chroma-demo/, so nothing the
 * deployed app runs is touched.
 *
 * The data is invented in src/lib/sampleData.js. No real transaction, bank
 * statement, card or account is involved, and nothing here reads a user's
 * browser storage, which is the only place real entries ever live.
 *
 *   node tools/chroma-demo/export-sample.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildSample } from '../../src/lib/sampleData.js';
import { toCents } from '../../src/lib/money.js';
import { DEF_CATS } from '../../src/themes/themes.js';

const here = dirname(fileURLToPath(import.meta.url));

/** The app dates rows on the Asia/Singapore calendar day, so match it here. */
function singaporeToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const LABELS = new Map(DEF_CATS.map((c) => [c.id, c.label]));

/**
 * The sample rows carry no merchant field: the app stores a free-text
 * description and never infers merchant identity from it. Rather than invent
 * one, this records merchant only where the description IS a named place, and
 * leaves it null everywhere else.
 */
const KNOWN_MERCHANTS = ['Toast Box', 'Grab', 'EZ-Link'];

function merchantOf(description) {
  return KNOWN_MERCHANTS.find((m) => description.includes(m)) ?? null;
}

const today = singaporeToday();
const { expenses, months } = buildSample(today);

const transactions = expenses.map((row) => ({
  id: row.id,
  date: row.date,
  description: row.description,
  merchant: merchantOf(row.description),
  category: row.category,
  categoryLabel: LABELS.get(row.category) ?? row.category,
  amountCents: toCents(row.amount),
  notes: row.notes ?? '',
}));

const payload = {
  generatedOn: today,
  source: 'src/lib/sampleData.js (invented sample data, generated relative to today)',
  months,
  count: transactions.length,
  transactions,
};

const out = join(here, 'sample-transactions.json');
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Wrote ${transactions.length} invented sample transactions to ${out}`);
console.log(`Months covered: ${months.join(', ')} (today = ${today})`);
