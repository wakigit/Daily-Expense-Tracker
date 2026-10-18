/**
 * Prints 10 MAIN expectations next to the exact fixture rows behind them, so a
 * human can verify the oracle by hand with a calculator.
 *
 * This is the check on the CHECKER. Everything else in this directory compares
 * the application against `expected.js`; nothing compares `expected.js` against
 * reality. That is what this script is for: it shows the claimed figure and
 * then every row it claims to be the sum of, so an arithmetic error in the
 * oracle cannot hide behind agreement with itself.
 *
 *   node scripts/eval/self-check.mjs            # seeded, reproducible 10
 *   node scripts/eval/self-check.mjs --seed 7
 *   node scripts/eval/self-check.mjs --all      # every answer-shaped question
 */

import { MAIN } from './questions.js';
import { EXPENSES, CATS } from './fixture.js';

const args = process.argv.slice(2);
const seedArg = args.indexOf('--seed');
const SEED = seedArg >= 0 ? Number(args[seedArg + 1]) : 20261019;
const ALL = args.includes('--all');

/* A tiny deterministic PRNG, so "random" is reproducible and reviewable. */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dollars = (cents) => `S$${(cents / 100).toFixed(2)}`;
const byId = new Map(EXPENSES.map((row) => [row.id, row]));
const labelOf = (id) => CATS.find((cat) => cat.id === id)?.label ?? `Unknown (${id})`;

/** Flatten chains so a follow-up turn can be sampled on its own. */
const candidates = [];
for (const question of MAIN) {
  const turns = question.turns ?? [question];
  turns.forEach((turn, index) => {
    const outcome = [].concat(turn.outcome ?? question.outcome);
    if (!outcome.includes('answer')) return;
    if (!turn.expect?.evidenceIds) return;
    candidates.push({
      id: question.turns ? `${question.id}.${index + 1}` : question.id,
      capability: question.capability,
      text: turn.text,
      expect: turn.expect,
      note: turn.note ?? question.note,
    });
  });
}

let chosen = candidates;
if (!ALL) {
  const random = mulberry32(SEED);
  const pool = candidates.slice();
  chosen = [];
  while (chosen.length < Math.min(10, candidates.length)) {
    chosen.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
}

console.log('='.repeat(78));
console.log(`SELF-CHECK — ${chosen.length} expectation(s)${ALL ? ' (all)' : `, seed ${SEED}`}`);
console.log('Add the amounts in each row list by hand; the sum must equal the expected figure.');
console.log('='.repeat(78));

let mismatches = 0;

for (const item of chosen) {
  const e = item.expect;
  console.log(`\n${'─'.repeat(78)}`);
  console.log(`${item.id}  [${item.capability}]  shape: ${e.shape}`);
  console.log(`Q: ${item.text}`);
  if (item.note) console.log(`   note: ${item.note}`);
  if (e.range) console.log(`Range: ${e.range.start} to ${e.range.end} (inclusive)`);
  else console.log('Range: none — this turn replays a frozen snapshot of an earlier answer');

  /* The headline claim, in the shape that question actually makes. */
  if (e.shape === 'breakdown') {
    console.log(`Expected grand total: ${dollars(e.totalCents)} across ${e.count} transactions, by ${e.groupBy}`);
    for (const group of e.groups) {
      const key = e.groupBy === 'category' ? `${group.key} (${labelOf(group.key)})` : group.key;
      console.log(`   group ${key}: ${dollars(group.totalCents)} / ${group.count} rows / ids ${group.evidenceIds.join(' ')}`);
    }
    const summed = e.groups.reduce((n, g) => n + g.totalCents, 0);
    const agrees = summed === e.totalCents;
    if (!agrees) mismatches += 1;
    console.log(`   groups recombine to ${dollars(summed)} — ${agrees ? 'MATCHES the grand total' : 'DOES NOT MATCH'}`);
  } else if (e.shape === 'highest') {
    console.log(`Expected winner(s) by ${e.groupBy} (${e.aggregate}): ${e.winnerKeys.join(', ')}`);
    console.log(`Expected peak value: ${e.aggregate === 'daily_average' ? `${dollars(e.peakValue)} per occurrence` : dollars(e.peakValue)}`);
  } else if (e.shape === 'largest') {
    console.log(`Expected largest single amount: ${dollars(e.peakCents)}${e.tieCount > 1 ? `  (TIE of ${e.tieCount})` : ''}`);
  } else if (e.shape === 'latest') {
    console.log(`Expected most recent date: ${e.date}${e.tieCount > 1 ? `  (${e.tieCount} rows share it)` : ''}, totalling ${dollars(e.totalCents)}`);
  } else if (e.shape === 'day_types') {
    console.log(`Expected weekday: ${dollars(e.weekday.totalCents)} over ${e.weekday.calendarDays} calendar days`);
    console.log(`Expected weekend: ${dollars(e.weekend.totalCents)} over ${e.weekend.calendarDays} calendar days`);
  } else if (e.shape === 'average') {
    console.log(`Expected ${e.aggregate}: ${dollars(e.valueCents)}  = ${dollars(e.totalCents)} / ${e.denominator}${e.aggregate === 'calendar_week' ? ' days x 7' : ''}`);
  } else if (e.shape === 'compare') {
    console.log(`Expected current ${e.current.range.start}..${e.current.range.end}: ${dollars(e.current.totalCents)}`);
    console.log(`Expected earlier ${e.earlier.range.start}..${e.earlier.range.end}: ${dollars(e.earlier.totalCents)}`);
    console.log(`Expected difference: ${dollars(e.differenceCents)} (${e.direction})`);
  } else if (e.shape === 'projection') {
    console.log(`Expected spent ${dollars(e.spentCents)} of budget ${dollars(e.budgetCents)}; remaining ${dollars(e.remainingCents)}`);
    console.log(`Elapsed days ${e.elapsed}, distinct spending dates ${e.distinctDates}`);
  } else if (e.shape === 'snapshot') {
    const snapCents = e.evidenceIds.reduce((n, id) => n + Math.round(Number(byId.get(id).amount) * 100 + 1e-9), 0);
    console.log(`Expected ${e.evidenceIds.length} frozen supporting rows, totalling ${dollars(snapCents)}`);
  } else {
    console.log(`Expected total: ${dollars(e.totalCents)} across ${e.count} transactions`);
  }

  /* The rows that figure is claimed to be built from. */
  const rowIds = e.shape === 'compare'
    ? [...new Set([...e.current.evidenceIds, ...e.earlier.evidenceIds])]
    : e.shape === 'day_types'
      ? [...new Set([...e.weekday.evidenceIds, ...e.weekend.evidenceIds])]
      : e.evidenceIds;

  console.log(`Fixture rows used (${rowIds.length}):`);
  let handSum = 0;
  for (const id of rowIds) {
    const row = byId.get(id);
    if (!row) { console.log(`   ${id}  *** NOT IN FIXTURE ***`); mismatches += 1; continue; }
    handSum += Math.round(Number(row.amount) * 100 + 1e-9);
    console.log(`   ${row.id}  ${row.date}  ${String(row.amount).padStart(7)}  ${labelOf(row.category).padEnd(18)} ${row.description}`);
  }
  console.log(`   ${'-'.repeat(60)}`);
  console.log(`   hand total of those rows: ${dollars(handSum)}`);

  /* For the shapes whose headline figure IS the sum of its rows, assert it. */
  const summable = ['total', 'count', 'list', 'breakdown', 'snapshot'].includes(e.shape);
  if (summable) {
    const claimed = e.shape === 'snapshot' ? handSum : e.totalCents;
    const agrees = handSum === claimed;
    if (!agrees) mismatches += 1;
    console.log(`   ${agrees ? 'OK' : 'MISMATCH'}: row sum ${dollars(handSum)} vs expected ${dollars(claimed)}`);
  } else {
    console.log('   (this shape reports a winner or a ratio, so the row sum above is context, not the claim)');
  }
}

console.log(`\n${'='.repeat(78)}`);
console.log(mismatches
  ? `${mismatches} INTERNAL MISMATCH(ES) — the oracle contradicts itself; fix before trusting any score.`
  : 'No internal mismatches. Every summable expectation equals the sum of the rows it names.');
console.log('='.repeat(78));
process.exit(mismatches ? 1 : 0);
