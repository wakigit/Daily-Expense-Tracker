# Step 4 repair, 10 November 2026

The three things the [Step 4 acceptance review](ASSISTANT-STEP4-ACCEPTANCE-2026-11-10.md) left open as blocking or unproven, closed or measured. Branch `checkpoint/2026-10-19-wip`. Nothing pushed, merged or deployed. **3 paid calls**, cap 6.

## What was done

| Step | Result |
| --- | --- |
| M69 fix | `24e6475`, committed before this task; re-verified under every gate |
| Standing MAIN gate | `99fadbb` — per-question, fails on any pass → fail, zero paid calls |
| M67 numeric oracle | `a85f157` — oracle, harness reading, and a deterministic proof of both |
| Review follow-ups | `adfa730` — dead imports, over-wide exports, baseline provenance |
| Mock browser matrix | **26/26 at 1440×900 and 390×844**, 0 real provider calls |
| Live re-check | 3 paid calls. One numeric pass, one correct refusal, **one case that regressed against the acceptance report and is not a code defect** |

## 1. MAIN replay: 69/76 → 70/76

| | Questions | Turns | Failing |
| --- | --- | --- | --- |
| Step 4 acceptance (reported score) | 69/76 | 75/82 | M46, M48.2, M65, M66, M67, M69, M76 |
| **Now** | **70/76** | **76/82** | M46, M48.2, M65, M66, M67, M76 |

**Exactly one per-question change: `M69 FAIL → pass`.** No regressions, no questions whose verdict held while their behaviour moved, no change to any outcome, semantic reason or source label. That one point is `24e6475`.

The gate is now standing (`npm run eval:main:mock`) and compares question by question against a committed baseline, because a total cannot see a swap — one question breaking while another starts passing leaves the score unchanged. The baseline is adopted at the current code, deliberately: a baseline still recording M69 as failing would make the gate blind to the next break of the one question it exists to protect.

## 2. A replay score is not proof of figures

M67 got the numeric oracle the acceptance report deferred, and the harness learned to read the `first`/`second` side keys an explicit comparison uses. But **neither is exercised by the replay**, and that is not a detail:

> M66, M67 and M76 hold stale HTTP 502 recordings. The replay falls back to the offline path, and `scoreTurn` returns at its offline branch **before any figure is compared**.

So `npm run eval:harness-checks` was added — **33 checks, zero paid calls, no recording needed**. It drives the real application path locally, reads the answer through `scripts/eval/actual-figures.mjs`, and compares every figure against the independent oracle. M67 now verifies end to end:

| | September side | July side | Difference |
| --- | --- | --- | --- |
| Window | 2026-09-01 to 2026-09-30 | 2026-07-01 to 2026-07-31 | — |
| Total | S$148.40 | S$1052.39 | **−S$903.99** (first minus second) |
| Evidence | 13 rows | 7 rows | both sets compared row by row |

Side order and sign were checked against `src/lib/comparison.js`, not assumed: an explicit two-sided descriptor labels sides `first`/`second` in asked order and computes `sides[0] − sides[1]`. Each side's total is also checked against the sum of the rows it names, because two sides can agree on cents while one selected a different window.

The reader was hardened at the same time. An unrecognised side vocabulary is now **named** rather than folded into the day-type branch — the original bug was exactly that silent fold, which reported `undefined` for every figure and failed with a shape complaint that named the wrong cause.

**M67 still fails in MAIN, as `contract`.** Its recording is stale. Refreshing it costs a paid call and is a separate decision.

## 3. Mock browser matrix: 26/26 at both viewports

Re-run on current code, so it covers the M69 fix. The `/private/tmp/tallyai-step4-accept/` fixture from the acceptance run survived and was reused unchanged; nothing was added to the repository.

Mock adapter on 8847 (credentials cleared, real transport a throwing stub, CORS limited to the one fixture origin), Vite fixture on 5247, Playwright route interception failing closed, clock fixed to 2027-03-10, throwaway browser profile. **21 mock requests and 0 real provider calls per viewport pass.** Four console errors per pass, all expected: two blocked Google Fonts requests and the two deliberate 502/504 modes.

Every case from the acceptance matrix passed again: numbered parts and the visible share calculation, per-part filter disclosure, keyboard focus and document order, signed difference with named operands, the literal-description 90-day share, the zero-denominator Unavailable slot, whole-request clarification on an unsupported component, part-choice evidence binding, Stop / Clear / overlap barriers, the one-sided-response guard, labelled offline fallback on 502 and 504, staleness after a real ledger edit and recalculation after it, 151-row evidence pagination, and no horizontal overflow or clipping.

As at the acceptance review, these screenshots say "Model interpretation, calculated locally" because the browser cannot know its backend substituted the provider transport. **They are not live evidence.**

## 4. Live re-check: one case regressed, and it is not a code defect

Real `backend/src/provider.js`, real key, **gpt-4.1-mini**, `maxRetries: 0`. The counting adapter's cap was set to **3** so it could not exceed what this step needed. Same fictional student ledger as the acceptance run (`L1`–`L6`), reference date 2026-11-10, so the hand-calculated expectations still hold and were re-derived independently before the calls.

| # | Question | Acceptance review | **This run** |
| --- | --- | --- | --- |
| RECHECK-3 | `what share of my last 90 days spending was at "Popular bookstore"?` | Live numeric pass, S$58.00 / S$20.50 / 35.34% | **Clarified. No figure** |
| RECHECK-5 | `What did I spend this month, and what percentage was Canteen Meals?` | Live numeric pass | **Live numeric pass.** S$40.00 / S$5.50 / **13.75%**, both evidence sets, visible `S$5.50 ÷ S$40.00 × 100 = 13.75%` |
| RECHECK-6 | `Show my total spending and my Bus & MRT spending, then the difference.` | Clarified, correctly (names no period) | Clarified. Unchanged and still correct |

In all three the model returned a correctly **shaped** plan: 2 steps, with `percent_of`, `percent_of` and `difference` respectively. RECHECK-3 was refused by the app with the single typed reason `plan_complete_request_required`.

### Diagnosed at zero cost

Replaying the **exact plan the model returned during the acceptance run** against current code:

```
audit        = {"ok":true,"family":"restricted_share"}
validateIntent -> plan
totals       = [5800, 2050]                      expected [5800, 2050]
counts       = [5, 2]                            expected [5, 2]
rows         = [[L1,L2,L3,L4,L5],[L3,L4]]        expected the same
range        = 2026-08-13..2026-11-10            expected the same
share        = 35.34%                            expected 35.34%
```

**The code is not regressed.** `79ed805`'s fix still holds and `24e6475` did not disturb it. What changed is the model's output: the app's audit requires the model's plan to be **field-identical** to the plan the local grammar recognises, and `gpt-4.1-mini` does not return the same fields every time for the same sentence.

> **Correction and strengthening, 11 November 2026.** The conclusion above is right; the evidence offered for it was not sufficient, and the replay quoted here is the reason. **That replay ran the client chain only** — `auditPlanRequest`, `validateIntent`, `executePlan` — so "`24e6475` did not disturb it" was a statement about code the refusal never reached. The refusal came out of `backend/src/routes.js::handleIntent`, and nothing in this repository exercised that leg with a captured plan.
>
> It has now been measured, at zero cost, by a server-leg replay that stubs the provider and runs the real route ([`scripts/eval/server-leg-checks.mjs`](../scripts/eval/server-leg-checks.mjs), under `npm run eval:harness-checks`). Bisected: the captured CAP-2 plan is refused at **`6ebbcac`** by `auditPlanRequest` with `plan_request_coverage`, and **accepted — 200, `intent: "plan"` — at `79ed805`, `24e6475` and HEAD.** The server leg was never regressed after `79ed805`. Two live paid calls on the same sentence with the live context shape returned the captured encoding both times and were accepted 200/plan.
>
> Two cautions this episode earns, both of which also apply to §4's own reasoning:
>
> - **`clarify` / `plan_complete_request_required` does not identify its cause.** `src/lib/intent.js` collapses six outcomes onto it and discards `auditPlanRequest`'s specific reason. The live adapter's `rawShape` log is what establishes that the model returned `type: "plan"` at 12:21:22Z rather than clarifying itself.
> - **The diagnostic captures used a different prompt.** `raw-capture.mjs` builds its context with `expenses: []`, so the provider saw `expenseCount: 0`; the live run sent `expenseCount: 6`, and `buildIntentRequest` puts that field in the user content. The later claim of a 0/3 flip rate therefore measured a different request from the one that failed.
>
> So the model-variance attribution stands, with its limits stated plainly: the 12:21Z raw plan was never captured, only its shape, and it differed from the capture in at least one field the audit compares. Which field is now unknowable. The bounded candidate set — a model-resolved explicit date range, reversed step order, a truncated term, an off-by-one `dayCount`, a merchant mapped onto a category — is tabulated in [§9.1 of the Step 4C design](ASSISTANT-STEP4C-PLAN-CONFIRMATION-DESIGN.md).

### Why this matters more than the single case

The acceptance report recorded RECHECK-3 as a "live numeric pass" and treated the measured recognized/not-recognized table as the supported surface. This run shows that table is **optimistic**: a sentence the grammar accepts is a *necessary* condition for a live answer, not a sufficient one, and the sufficient condition is not stable across calls. A single live pass is therefore not reproducible evidence of a supported phrasing.

Not fixed here, deliberately. It is a change to the audit's identity requirement — the barrier whose over-strictness produced the one real defect found at the acceptance review — and it is the central question for Step 4C rather than something to patch at the end of a repair task.

**Still available, not spent:** one paid call on a raw-plan capture would name the exact field that differed. 3 of the 6 authorised calls remain. *Three were later spent on raw-plan captures for the Step 4C design, and two more on 11 November 2026 re-measuring this sentence through the real server leg; none reproduced the refusal.*

## 5. Gates

Run before each of the three code commits and again at the end.

| Gate | Result |
| --- | --- |
| `npm run build` | pass (the existing >500 kB chunk warning is unchanged) |
| `npm run smoke` | **2278/2278** (+11 over the 2267 at the acceptance review) |
| `backend` provider checks | **39/39** |
| `backend` Node tests | **237/237** (+4 over 233) |
| `npm run eval:self-check` | pass |
| `npm run eval:fixture-checks` | pass |
| `npm run eval:harness-checks` | **33/33** (new) |
| `npm run eval:main:mock` | **70/76**, no per-question change after the baseline was adopted |
| `git diff --check` | pass |

An independent 25-agent review of the two eval commits ran before they landed. It confirmed the figures, the side ordering and the faithfulness of the extraction, and found four things that were fixed in `adfa730`: two dead imports, three unnecessary exports, a baseline carrying no provenance, and the absence of a reference-date guard on the diff.

Servers: the mock adapter (8847), the live adapter (8848) and two Vite fixtures (5247, 5248) were all started by this task and all stopped. No server belonging to the user was touched.

## 6. Still open

1. **The model/recognizer identity requirement is the real capability limit, and it is unstable.** Section 4. This is Step 4C's subject. *Confirmed as the real limit on 11 November 2026, and narrowed: the literal-description encoding difference is already tolerated and answers; what still refuses is the wider field-disagreement set tabulated in Step 4C §9.1.*
1. **The server leg had no gate of its own.** Closed on 11 November 2026 — captured plans are now replayed through `handleIntent` by `npm run eval:harness-checks`, and the cases are proven to fail at `6ebbcac` and at `79ed805` (M69) rather than merely assumed to.
2. **M66, M67 and M76 hold stale HTTP 502 recordings**, so the replay cannot score their figures. `eval:harness-checks` covers M67 and M76's comparison figures locally. Refreshing the recordings costs paid calls.
3. **Period-less multipart requests.** Unchanged from the acceptance review §7.2: the recognizer defaults a missing period to this month, the model reads it as all time, and refusing is correct. Still a product decision.
4. **The mock matrix cannot see model/recognizer disagreement**, because `mockPlanIntent` *is* the recognizer. Section 4 is now direct evidence that this blind spot hides something real.
5. M46, M48.2 and M65 still fail; the 4096-token plan ceiling is still configured rather than measured; HOLDOUT remains untouched.

## 7. Recommendation

**Publication is still not advisable, but the reason has moved.** The M69 regression that blocked acceptance is fixed, verified, and now protected by a standing gate. What stands in the way is narrower and better understood: the bounded plan feature answers a supported question only when the model happens to emit a field-identical plan, and this run shows it does not do so reliably. A user asking the same supported question twice can get an answer once and a clarification the next time.

That is not a regression against production — production has no bounded plans at all — so it does not block publishing the rest of Steps 3–4. It does mean the plan feature should be described as what it is. Step 4C should decide whether to widen the audit's identity requirement, widen the grammar, or both, before this capability is presented as working.
