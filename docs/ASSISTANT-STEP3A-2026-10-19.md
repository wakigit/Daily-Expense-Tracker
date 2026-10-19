# Assistant roadmap Step3A, local handling result

Implemented locally. The final-code live-verification gap for M66/M68 is now closed by the separate verification below. Both produce useful clarifications, not the requested financial calculations. Production is unchanged.

## 0. Final-code live closure, 2026-10-19

Tested exact source `8d71dcf6312b1b05dfdd382bb18b181c4bb14e31` on `checkpoint/2026-10-19-wip`. Starting tree was clean, the published checkpoint remains an ancestor, and the final category-word metadata guard was present. A fresh isolated backend on port 8842 imported the current handler, provider and shared validators. Startup source hashes were checked again after verification and are unchanged. The user's normal frontend/backend and existing browser data were preserved.

Exactly two paid provider requests ran, one per existing MAIN question, with SDK retries disabled and an independent backend hard cap of two. No retry, prompt edit, application repair, expectation change, HOLDOUT access, push or deployment occurred. The existing merge-safe recorder changed **only M66 and M68**; all **72 other recording keys** were preserved. Actual calls are logged in `scripts/eval/calls.log` under `step=3A-close`. These two calls are separate from the prior task's seven calls (nine across the two authorised tasks).

| Case and exact question | HTTP | Validated intent | Safe semantic reason | Source and result |
| --- | --- | --- | --- | --- |
| M66: Did I spend more on Food & Drinks or Bubble Tea this month? | 200 | clarify | category_comparison_unsupported | Fresh live model interpretation, code-authored clarification; handling pass |
| M68: How much did I spend on Food & Drinks, Bubble Tea and Public Transport this month? | 200 | clarify | multiple_categories | Fresh live model interpretation, code-authored clarification; handling pass |

M66 clarification shown:

> I cannot directly compare several categories in one calculation. Would you like separate totals for each category, keeping the requested periods and filters? Please name the first category. Your original request: “Did I spend more on Food & Drinks or Bubble Tea this month?”

M68 clarification shown:

> I cannot directly combine or compare several category filters. Which single category should I use, or would you like to review explicit inclusion rules for a combined scope? Your original request: “How much did I spend on Food & Drinks, Bubble Tea and Public Transport this month?”

Both server and client validation passed, including an explicit shared-validator round-trip. Every named subject/category and “this month” remains in each clarification. Neither response contains an executable query, financial answer or silently narrowed calculation. Neither is built-in or offline. No scope proposal was returned, so this task did not re-exercise scope approval; the existing requirement for approval before calculation remains unchanged.

Fresh subset: **2/2 questions, 2/2 turns**, two paid calls, zero offline fallbacks. Subsequent MAIN replay: **74/76 questions, 80/82 turns**, zero HTTP/paid calls and zero offline fallbacks. This improves the prior mixed replay's 72/76 and 78/82 by refreshing the two pre-guard HTTP502 envelopes. Remaining failures are **M46** (useful clarification, but unchanged expectation requires scope proposal/answer) and **M48.2** (free-form scope exclusion, deferred). The full score is mixed-age replay, not wholly fresh live accuracy and not proof of support for the missing calculations.

Browser coverage: used the current actual App at isolated fictional origin `http://127.0.0.1:5242`, seeded with the fictional MAIN ledger. At **390×844**, submitted each exact question through the real client. The isolated transport returned the **exact saved HTTP envelopes from the two fresh calls**, without another provider request or a fabricated/mock intent. This verifies recorded-live rendering, not a second live browser interpretation. Both clarifications were fully readable, retained all categories and month, showed Edit original question, and had no misleading offline notice or financial answer. No material text clipping was observed. Scope controls were not exercised because neither response proposed a scope. The temporary viewport was reset and the verification tab closed. Only task-created servers were stopped.

Screenshots, outside tracked source:

- `/private/tmp/tallyai-step3a-live-close/M66-phone.jpg`
- `/private/tmp/tallyai-step3a-live-close/M68-phone.jpg`

Durable safe evidence: `scripts/eval/step3a-final-live-provenance.json`, `results-step3a-final-live-close.json`, `SCORECARD-step3a-final-live-close.md`, `results-step3a-live-closed.json`, and `SCORECARD-step3a-live-closed.md`. No raw provider output or credentials were retained in these artifacts. `git diff --check` passed. No broad suite was rerun for this documentation/recording-only task.

Recommendation: the Step3A final-code live handling gap passes. The next separate capability task is bounded OR filters and generalised comparisons, with explicit category/period semantics and complete evidence. This task does not implement or publish that work. Existing unsupported combinations, M46's expectation gap and M48.2 remain documented.

The following sections retain the earlier implementation task's observations and call provenance. Its pre-guard M66/M68 failures are historical, superseded only by the fresh verification above.

## 1. Git state and logical commits

Started on `checkpoint/2026-10-19-wip`, clean HEAD `6cf9345f660c2160b726ec1132a174b56d37213d`, the published checkpoint. It remains an ancestor. No unexpected work conflicted. No push, main merge, deployment or history rewrite.

Implementation: `4eb37e5`, `fix(ask): clarify recognised limitations without masking malformed intents`. The following evaluation/documentation commit contains this report, harness provenance fields, replay results, the five refreshed recordings and the actual-call ledger. Source branch remains the checkpoint branch; main/wallpaper-redesign remain at the published SHA.

## 2. Diagnosed failure categories

A. Structurally valid requests can express a recognised semantic limitation: multiple categories, a missing concept scope, incomplete named-category coverage in a scope, an unsupported operation on a reviewed scope, an arbitrary comparison period, or a multipart category-percentage question. These now produce successful validated clarifications through the normal intent path. They produce no executable query or financial result.

B. Unknown real category IDs, unknown operations/fields, bad date/amount/day/group types, invalid scope rules, invalid category-word list shapes and unsupported reason codes remain invalid. A malformed field cannot be rescued by mentioning several categories in the question. Unmapped category-word metadata is not the same thing as a real category-ID filter; a bounded string list is treated as a semantic limitation only when the user's original request independently establishes that limitation. Extra invented category words on a normal single-scope question still fail.

C. Provider timeout, authentication/key rejection and connection errors remain errors with honest offline/fallback notices. There is no catch-all exception-to-clarification conversion, exception-string matching or provider-outage camouflage.

Starting MAIN errors: M46 `query.spendingScope`; M50/M66/M68 `multiple_categories`; M65 `query.category_terms`. Their API recordings contain only safe HTTP502 diagnostics, not the rejected raw provider payload, so they do not prove which underlying category-term condition failed. The live diagnostic narrowed the later failure to a two-term list, without retaining raw model words. The final metadata guard addresses this class without weakening executable category-ID validation.

## 3. Changes and safeguards

`src/lib/intentLimitations.js` owns a fixed reason allowlist and fixed clarification text. The original user question is appended as plain text, retaining subject, periods and amount/day filters. No model-authored answer figure or rejected model value is used. Existing Edit original question controls preserve the draft.

`validateQuery` checks structural constraints before producing a semantic limitation. `validateIntent` turns only allowlisted reasons into `clarify`; it does not change a failed query into a smaller executable query. Valid reviewed scopes still require approval. Comparing named categories cannot silently become a union total. No multiple-category operation, multipart calculation or generalised comparison was implemented.

Broad assessment wording now asks what to assess: recorded spending against a category budget, period change or a particular category, with a clear limit on judging overall financial health. This is built-in handling. Greetings and model-chosen noise help remain appropriate. M64's expectation is untouched.

The provider instructions gained one general multipart limitation sentence. Model IDs, dependencies and all retry settings are unchanged. No UI or storage code changed.

The evaluation harness gained an optional isolated endpoint, request cap and safe HTTP/intent/reason fields. Existing recording merges still preserve unrelated keys. These fields do not alter scoring expectations.

## 4. Regression and gates

New fictional vocabulary/data, not the MAIN fixture: Lunches, Craft supplies and Rail fares. Independent expected cents cover total 3566, a complete three-group breakdown, current/previous comparison 3566/111 and approved scope total 3110. Tests cover supported execution, malformed output, incomplete scope coverage, unsupported category comparisons, category-word metadata, provider failures, broad assessments, greeting/noise, server/client round-trip and preserved follow-up context.

Final `npm run build`: pass. `npm run smoke`: **1745/1745**. Backend provider checks: **28/28**. Backend node tests: **132/132**. `git diff --check`: pass. No evaluation expectation changed. HOLDOUT cases were not inspected, run or altered.

## 5. Earlier task: replay versus fresh live

| Run | Questions | Turns | Meaning |
| --- | --- | --- | --- |
| Before | 69/76 | 75/82 | Starting mixed-age MAIN replay |
| Code, old responses | 70/76 | 76/82 | Only broad assessment bypasses its old response; five old HTTP502s remain |
| Fresh six-case subset | 3/6 | 3/6 | Five paid calls, one built-in case; useful M46 clarification is still an oracle failure |
| Final mixed replay | 72/76 | 78/82 | Five intended recordings refreshed once; old responses for all other cases |

Fresh subset details, each attempted once:

| Case | HTTP | Validated type | Safe reason/diagnostic | Clarification or handling | Source |
| --- | --- | --- | --- | --- | --- |
| M46 | 200 | clarify | scope_rules_required | Explicit related-purchase rules needed; asks which terms/categories count; retains year and bubble-tea subject | Live model interpretation, code-authored clarification |
| M50 | 200 | propose_scope | No error | Existing reviewable scope proposal for the two categories; harness verifies approval/evidence | Live model, existing scope path |
| M54 | No client HTTP request | clarify | financial_assessment_needs_scope | Asks budget/period/category assessment; no financial-health verdict | Built-in; server unit path also returns 200 |
| M65 | 200 | clarify | multipart_percentage_unsupported | Offers recorded total or full breakdown; retains original month and subject | Live model interpretation, code-authored clarification |
| M66 | 502 | None | intent_bad_field / query.category_terms | Labelled validation/offline clarification | Offline fallback after model rejection |
| M68 | 502 | None | intent_bad_field / query.category_terms | Labelled validation/offline clarification | Offline fallback after model rejection |

The M66/M68 captures preceded the final category-word guard. They were not retried. The final deterministic guard is tested with category-word IDs, several actual categories, incomplete scope coverage and malformed-output counterexamples; this is not fresh live proof for the original cases.

Diagnostic paraphrases: “What's my recorded spending total for the current month?” returned HTTP200/analyze. A test-fixture reload later removed the retained UI observation, so no fresh live financial-answer claim is made from that call alone. “Did I spend more on Lunches or Craft supplies this month?” returned HTTP502/category_terms before the final metadata guard; no repeat was made. Safe shape diagnostics only recorded a two-term list, not raw provider words.

Final replay failures remain M46, M48.2, M66 and M68. M46 is useful handling but its unchanged oracle requires a scope proposal/answer. M48.2 remains deferred. M66/M68 replay their saved HTTP502 envelopes, which cannot run the newer server validator. The remaining uncertainty is visible rather than scored away.

Exactly five MAIN recording keys changed: M46, M50, M65, M66, M68. The other 69 stored keys are byte-equivalent as parsed JSON. M54's old help recording remains but is bypassed locally. Complete safe per-case details are in `scripts/eval/step3a-handling-provenance.json`.

## 6. Earlier task paid-call count

**Seven actual provider calls**, maximum eight. Five MAIN families once plus two diagnostic paraphrases. Automatic retries disabled; no repeated failed case or score-chasing call. Broad assessment, deterministic tests, mock calculations/failure checks and replay cost zero. Ledger: `scripts/eval/calls.log` (one five-call MAIN entry and two one-call browser entries). An independent task provider counter also recorded seven.

## 7. Browser verification and screenshots

Used fictional storage only at `http://127.0.0.1:5241`, with unrelated category IDs and purchases. Expected October total S$35.66 across three rows (12.34, 18.76, 4.56); prior-month record S$1.11. Existing real user storage was neither read nor cleared.

The isolated backend on 8841 imports the current real handler/provider/shared validator. It was restarted after backend/shared changes, retaining the paid counter. The user's existing frontend/backend were not stopped or restarted. Temporary test-only transport controls explicitly select live, mock supported, mock unsupported, or mock provider failure; they are outside application source.

At 1440×900 and 390×844:

- Mock unsupported interpretation returns HTTP200/clarify/multiple_categories, preserving Lunches, Craft supplies, this month, weekends and over S$9, without an offline notice.
- Broad assessment is built-in, asks what to assess, and makes no network request. It does not claim financial health.
- Mock supported interpretation returns a real application-calculated S$35.66 with three evidence rows. This is not a live-model success.
- After unsupported and broad clarifications, “Break that down by category” uses the prior accepted total, S$35.66 and all three categories. The clarification did not corrupt follow-up context.
- Mock provider timeout returns HTTP504/provider_timeout. The real fallback calculates S$35.66 and visibly says “Answered offline. The assistant request timed out.” It is explicitly not a live pass.

Amounts and clarification text were readable on phone. Long conversations use the existing scrolling. Test transport controls appear in screenshots and are not a product UI change.

Local screenshots and observations, kept outside commits under `/private/tmp/tallyai-step3a/`: `unsupported-laptop.jpg`, `unsupported-phone.jpg`, `assessment-laptop.jpg`, `assessment-phone.jpg`, `supported-laptop.jpg`, `supported-phone.jpg`, `context-after-clarifications-phone.jpg`, `provider-failure-laptop.jpg`, `provider-failure-phone.jpg`, `browser-safe-results.json`.

## 8. Earlier task remaining limitations

No missing financial capability was implemented. Arbitrary periods, category OR/comparison semantics and multipart results still need separate design/implementation. M48.2 is deferred. At the end of the earlier task, no final-code fresh live success could be claimed for M66/M68. Section 0 closes that gap. Original rejected raw payloads were intentionally not retained. No physical phone, screen-reader, receipt, voice, production, roast or HOLDOUT verification was added.

## 9. Next task recommendation

The automated, final-code mock-browser and separate final-code live clarification gates pass, with provenance distinguished in section 0. The next task is bounded OR filters and generalised comparisons with explicit period/category semantics and complete evidence. Do not start it here. No next task, push or deployment occurred.
