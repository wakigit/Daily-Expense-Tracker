# Step4B1: dormant bounded plan core

This deterministic implementation gate passes locally. It does **not** enable multi-part answers in the current browser/provider, prove live interpretation, or authorise publication.

## Baseline and scope

Started 2026-10-20 00:51:07 UTC on checkpoint/2026-10-19-wip at 3f760aa31a5bdd8ba50a5f943457844fef2b8cf3. The only starting diff was the approved Step4A design in docs/ASSISTANT-UPGRADE-PLAN.md. The complete original design diff was preserved and hashed before any edits. This stage includes that prior approved writing with implementation attribution, without squashing/replacing checkpoint history. Production/main remains 6cf9345.

Elapsed time and milestone status are recorded in scripts/eval/step4b1-provenance.json. No new functionality after the deadline cutoff. Zero paid requests; calls.log is unchanged because there are no actual calls to log. No dependencies, model changes, live-provider activation, App/session/UI integration, server restarts, browser data access, publication or HOLDOUT inspection/run/change. MAIN expectations, recordings and live harness remain unchanged.

## Changed files and interfaces

- src/lib/planContract.js: buildPlanSchema, buildPlanIntentSchema, validatePlan, validatePlanIntent, canonical full query builder, byte/resource limits and static scope containment.
- src/lib/planRequest.js: recognizePlanRequest, auditPlanRequest and a dormant guardPlanResponse against one-sided answers to recognised complete multipart questions.
- src/lib/planEngine.js: executePlan, exact signed planDifference and rational planShare, code-generated bound step questions. It reuses existing query execution/matching/dates/money/evidence without rewriting those modules.
- scripts/plan-fixture.js, plan-checks.jsx, plan-output-size.mjs: independent fictional inputs, deterministic numerical/safety tests and reproducible offline size assessment.
- backend/src/plan.test.mjs and backend/package.json: 34 Node shared-schema/validator/request-audit regressions added to npm test. Only the test command changes, not server startup.
- scripts/smoke.jsx: registers 184 additional deterministic checks. Existing checks stay active.
- docs/ASSISTANT-UPGRADE-PLAN.md: approved design preserved and implementation/deferred status added. scripts/eval/step4b1-provenance.json records expected/actual values, source-integrity checks and measurements.

The existing provider and validateIntent do not import or recognise the new plan type. App, answer UI, session, offline routing and evaluation harness do not call the executor/guard. Ordinary intents remain compatible. Plan intent validation is independently exported and round-tripped in Node tests, not substituted into the existing live handler.

## Contract and semantic boundaries

One to four full existing total queries; common resolved dates; zero to two difference/percent_of nodes; at least two displayed results. Consecutive q1–q4 / d1–d2 IDs; named left/right or numerator/denominator references to existing base totalCents only. No model figures, prose labels, ledger IDs, formulas or approval flags. Reject unknown fields, malformed/unknown/derived/self/cyclic references, conflicting scalar/list filters, duplicate queries/results, missing IDs/categories and unsupported operations/scopes. Canonical plan queries use the existing wire fields; calculated threshold amountCents is never accepted from a model.

All-request coverage is checked independently of model metadata. The bounded grammar supports the three target families, custom configured labels, quoted literal terms and OR filters, common relative/named/ISO periods and supported day/amount restrictions. It verifies requested outputs, scopes, dates and ordered operands; unsupported or unconsumed components clarify the complete original question. A separately requested total does not inherit the first part's merchant/day/amount restriction. Common dates are shared. A share numerator retains its denominator's explicitly requested scope. Ambiguous/conflicting attachment clarifies.

Calendar/day/generic-word category names that conflict with the sentence grammar clarify. Multiword literal terms require quotes. Ordinary OR totals and comparison-only questions are not captured as plans. Static subset proof is deliberately conservative: same or additional restrictions, category subsets, no inferred stronger-string/amount relationships. Matching evidence containment is checked too, but cannot replace static proof with accidental current-row matches. The default difference shorthand requires whole total then a restricted total; otherwise use explicit named subtraction. Negative results from an explicitly reversed subtraction are permitted, negative/refund source records are not.

No reviewed scopes, counts, sums, ratios, nested comparisons, different per-part periods, averages, breakdowns, projections, winners/actions or derived chains. Unknown/incomplete components never cause a partial answer. Schema and semantic failures are typed separately; this gate does not relabel them as provider outages or patch returned model fields.

## Atomic typed calculation and provenance

One cloned/frozen local expenses/categories/reference-date snapshot supplies every base step. Identical duplicate IDs collapse privately; conflicts invalidate the plan. Existing stored rows and ordinary scalar deduplication behaviour remain unchanged. The complete semantic audit precedes ordinary execution with a code-generated, fully scoped per-step question, preserving guards. Base clarification blocks the entire answer.

Base results contain canonical query/scope, resolved dates, safe integer totalCents, count, SGD unit, complete immutable evidence and code-generated interpretation. Category fingerprints include empty scalar/list selections; deduplicate scopes make future stale checks consistent with execution. Exact derived inputs, ordered references, units, evidence dependencies, formula and rounding are retained. No artificial difference transaction list exists. Relevant edits, currency/category changes and empty-category removal are detectable using existing evidenceIsOutdated; App traversal/session integration is intentionally deferred.

BigInt intermediates avoid unsafe sum/difference/percentage multiplication. Every source amount and emitted cents result must be finite/nonnegative source spending and safe integer cents. Money and currency are checked in the nonmonetary scope before an amount threshold, so NaN or a foreign nominal amount cannot silently disappear through a monetary comparison. Explicit non-SGD selected records fail; absent currency keeps the legacy SGD convention. Percent shares round half away from zero to two decimals, preserving exact input cents. Zero denominator returns unavailable_zero_denominator without a percentage value or display. Historical results remain frozen after source mutation. Existing comparison 33.3% formatting is unchanged.

## Independent expected versus actual

Reference date 2027-03-10. All expectations below were specified independently, not obtained by running application functions.

| Case | Expected | Actual |
| --- | --- | --- |
| Total / Food | 4000 / 1000 cents; counts 3 / 1; IDs p1,p2,p3 / p1; 25.00% | Exact match |
| Total less Transit | 4000 − 1200 = 2800 cents; Transit ID p2 | Exact match |
| 90-day literal Amazon | 2026-12-11–2027-03-10 inclusive; 7000 / 1800 cents; counts 6 / 1; IDs p1–p6 / p3; 25.71% | Exact match |
| Four queries, two derived | 4000 / 1000 / 1200 / 1800; 25.00% and 2800 cents | Exact match |
| Empty January window | 0 / 0; zero rows; unavailable share, no percentage | Exact match |
| True zero numerator | 3000 / 0; 0.00% | Exact match |
| Rational rounding | 1/3 = 33.33%; 1/20000 = 0.01%; 2/3 = 66.67% | Exact match |
| Explicit reversed subtraction | Transit − total = -2800 | Exact match; reversed operands for original question rejected |
| Relevant Food edit | Old 4000 / 1000 and 25.00% frozen/stale; fresh 4100 / 1100 = 26.83% | Exact match |
| Existing comparison | Current 4000 versus previous 3000, +1000, earlier baseline, 33.3% | Exact match; unchanged engine |

Additional tests reject malformed/cyclic/oversized plans, extra/missing parts/filters, static containment despite coincidental matched rows, incompatible units, overlapping sums, missing categories, duplicate IDs, explicit foreign currency, nonfinite/overflow money, and approval bypass. Snapshot getter instrumentation proves one original amount read supplies both base calculations. Literal metacharacters are not regex and ledger instructions remain evidence data.

Resource limits: 16 KiB instruction and metadata caps, four/two nodes, six displayed parts, 160-character generated headings, 10000 distinct matched rows and 20000 memberships. Tests cover both row/membership limits and valid maximum instructions whose result metadata exceeds its cap; all return no partial base results. Complete evidence is not truncated. Rendering pagination is deferred with UI integration.

## Output-size assessment

Run node scripts/plan-output-size.mjs offline. Sizes are actual UTF-8 JSON bytes.

| Example | Inner plan | Complete intent envelope | Rough bytes/4 estimate only |
| --- | ---: | ---: | ---: |
| Two-query share | 815 | 935 | 234 |
| Two-query difference | 801 | 921 | 231 |
| 90-day literal share | 804 | 924 | 231 |
| Four-query/two-derived | 1600 | 1720 | 430 |
| Four-query maximum lists | 7565 | 7685 | 1922 |

Standalone plan intent schema: 10240 bytes. All instruction examples pass structural validation; the maximum-list plan separately hits the 16 KiB result metadata cap and safely clarifies. No reliable tokenizer was found in installed dependencies/lockfiles. No tokenizer installed and no token count measured. The estimates are not upper bounds. Recommend reviewing a provisional 4096-token ceiling at the later integration gate using reliable measurements/authorised final-code trials. Even that is not a guarantee for every boundary input; truncation must stay an honest failure with zero retries. **Live output limit remains 700, model unchanged.**

## Gates and remaining integration

Build passed, smoke 2173/2173 (+184), provider checks 39/39, backend Node tests 208/208 (+34), git diff --check passed. All new schema examples pass the actual standalone decoding branches and normalisation round-trip; no mock provider responses are used to claim live interpretation. Source-integrity verification compares existing runtime files and evaluation recording/harness files against the starting commit. Current build still emits index-CaMQkuCM.js. No browser tests were run because no plan UI exists in this gate.

This accepts the deterministic core only. Next authorisation should cover server/client plan dispatch and guard wiring, complete provider schema/prompt routing, App atomic result publication, tagged plan context and evidence choices, derived/base stale traversal, minimal answer/evidence pagination, truthful offline/source labels, cancellation/date-change handling, and independent harness integration. Use zero-paid mocks for that integration gate and preserve all old single/comparison/scope regressions. Review output-budget and any capability-oracle changes explicitly before applying them. Final-code live acceptance needs a separate paid-call authorisation. No next-stage work or publication starts automatically.
