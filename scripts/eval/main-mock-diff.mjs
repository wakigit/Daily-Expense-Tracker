/**
 * The standing MAIN gate's second half: a per-question diff against a
 * committed baseline.
 *
 * A total alone hides movement. Step 4 shipped a regression that cost M69 and
 * nobody saw it, because the step that introduced it ran no MAIN replay at all
 * and the previous total came from an earlier step. This compares question by
 * question and FAILS on any pass -> fail, so a silent swap (one question breaks,
 * another starts passing, score unchanged) cannot slip through either.
 *
 *   node scripts/eval/main-mock-diff.mjs            compare, exit 1 on regression
 *   node scripts/eval/main-mock-diff.mjs --accept   adopt current as the baseline
 *
 * --accept is deliberate and reviewable: it rewrites a committed file, so the
 * diff shows exactly which question changed and the commit message has to say
 * why.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('./', import.meta.url);
const CURRENT = new URL('results-main-mock.json', ROOT);
const BASELINE = new URL('MAIN-MOCK-BASELINE.json', ROOT);
const ACCEPT = process.argv.includes('--accept');

if (!existsSync(CURRENT)) {
  console.error('No results-main-mock.json. Run `npm run eval:main:mock` rather than this script alone.');
  process.exit(2);
}
const run = JSON.parse(readFileSync(CURRENT, 'utf8'));

/* Compare the right run. A results file is just a file on disk: a leftover
   live run, a HOLDOUT run or a `--only` subset would all parse fine and would
   all produce a confident, meaningless verdict. Check what it is before
   trusting it. */
for (const [field, want] of [['set', 'MAIN'], ['mode', 'mock']]) {
  if (run.summary?.[field] !== want) {
    console.error(`results-main-mock.json is a ${field}=${run.summary?.[field]} run, not ${want}. Re-run \`npm run eval:main:mock\`.`);
    process.exit(2);
  }
}
if (run.results.length !== run.summary.questions) {
  console.error(`results-main-mock.json holds ${run.results.length} of ${run.summary.questions} questions — a subset run cannot be compared against the full baseline.`);
  process.exit(2);
}
if (run.summary.paidCalls) {
  console.error(`results-main-mock.json records ${run.summary.paidCalls} paid call(s); a mock gate must cost nothing.`);
  process.exit(2);
}

const snapshot = {
  /* Provenance, so the committed baseline says what it is. Every other
     tracked artifact in this directory does; a bare score does not tell a
     reviewer which set, which mode or which reference date produced it. */
  set: run.summary.set, mode: run.summary.mode, referenceDate: run.summary.referenceDate,
  acceptedAt: run.summary.finishedAt,
  questions: run.summary.questionsPassed, questionTotal: run.summary.questions,
  turns: run.summary.turnsPassed, turnTotal: run.summary.turns,
  cases: Object.fromEntries(run.results.map((c) => [c.id, {
    pass: c.pass,
    outcomes: c.turns.map((t) => t.gotOutcome).join('>'),
    reasons: c.turns.map((t) => t.semanticReason ?? '-').join('>'),
    sources: c.turns.map((t) => t.source).join('>'),
  }])),
};

if (ACCEPT) {
  writeFileSync(BASELINE, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Baseline adopted: ${snapshot.questions}/${snapshot.questionTotal} questions, ${snapshot.turns}/${snapshot.turnTotal} turns.`);
  console.log('Commit MAIN-MOCK-BASELINE.json with the reason each changed question changed.');
  process.exit(0);
}
if (!existsSync(BASELINE)) {
  console.error('No MAIN-MOCK-BASELINE.json yet. Review this run, then adopt it with --accept.');
  process.exit(2);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));

/* Shift the fixture's reference date and every period in the bank resolves
   somewhere else, so the baseline describes questions that no longer exist in
   the form it recorded them. Comparing across that is worse than not
   comparing: it reports confident per-question regressions that are really
   one deliberate fixture change. Baselines written before this field existed
   carry no referenceDate and are compared as before. */
if (base.referenceDate && base.referenceDate !== snapshot.referenceDate) {
  console.error(`Baseline was taken at reference date ${base.referenceDate}, this run is ${snapshot.referenceDate}. Review the whole bank and re-accept deliberately; a cross-date diff is meaningless.`);
  process.exit(2);
}

const ids = [...new Set([...Object.keys(base.cases), ...Object.keys(snapshot.cases)])].sort();
const regressed = [], fixed = [], moved = [];
for (const id of ids) {
  const was = base.cases[id], now = snapshot.cases[id];
  if (!was) { moved.push(`${id}  ADDED (${now.pass ? 'pass' : 'FAIL'})`); continue; }
  if (!now) { regressed.push(`${id}  REMOVED from the set`); continue; }
  if (was.pass && !now.pass) regressed.push(`${id}  pass -> FAIL   outcomes ${was.outcomes} -> ${now.outcomes}   reasons ${was.reasons} -> ${now.reasons}`);
  else if (!was.pass && now.pass) fixed.push(`${id}  FAIL -> pass   outcomes ${was.outcomes} -> ${now.outcomes}`);
  else if (was.outcomes !== now.outcomes || was.reasons !== now.reasons || was.sources !== now.sources) {
    moved.push(`${id}  ${now.pass ? 'pass' : 'FAIL'} both sides, but behaviour moved: outcomes ${was.outcomes} -> ${now.outcomes}   reasons ${was.reasons} -> ${now.reasons}   sources ${was.sources} -> ${now.sources}`);
  }
}
console.log('='.repeat(78));
console.log(`MAIN --mock gate   ${base.questions}/${base.questionTotal} -> ${snapshot.questions}/${snapshot.questionTotal} questions`);
console.log(`                   ${base.turns}/${base.turnTotal} -> ${snapshot.turns}/${snapshot.turnTotal} turns`);
console.log('='.repeat(78));
for (const [title, rows] of [['REGRESSED', regressed], ['FIXED', fixed], ['BEHAVIOUR MOVED (same verdict)', moved]]) {
  if (!rows.length) continue;
  console.log(`\n${title}`);
  for (const row of rows) console.log(`  ${row}`);
}
if (!regressed.length && !fixed.length && !moved.length) console.log('\nNo per-question change.');
if (regressed.length) {
  console.log(`\nGATE FAILED: ${regressed.length} question(s) regressed. Explain and fix, or adopt deliberately with --accept.`);
  process.exit(1);
}
console.log('\nGate passed: no regression.');
