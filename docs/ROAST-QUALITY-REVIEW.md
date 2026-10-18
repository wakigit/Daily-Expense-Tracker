# Roast quality review, 18 October 2026

## Changes

Purchase wording outranks the saved category for joke subject matter. Category calculations and saved categories are unchanged. Category counts cannot establish merchant habits or counts of a purchase type. Optional Singapore/SMU context no longer occupies scheduled angle slots. Existing angle values remain valid for cached inputs. Natural English defaults; local context is optional. The backend includes a small SMU guide verified against its official BOSS bidding and class participation articles (source links beside the prompt). No runtime research, schema change, retries or paid judging.

## Bounded live results, five calls total

All inputs fictional, model gpt-4.1-mini. No budget configured, name blank. Only accepted, validated model text is recorded below. Raw provider output was not printed or stored. The three script cases were evaluated against the first prompt refinement; the browser admission case also tested subsequent punctuation guidance. The final category-mismatch prohibition was added after inspecting the final accepted sample, and has NOT been verified live. No further calls were made to chase better examples.

1. Chicken rice, Food, S$5.80, Singapore ON / SMU ON. One recorded category row, no repeat fact. Accepted, 78 characters: “Dropped $5.80 on chicken rice, one meal this month—hope the rice was worth it!” Assessment: bland; the category count is not proof of all meals. Added explicit recorded-row/category-count guidance afterward.
2. Bubble tea, Food, S$6.50, Singapore ON / SMU ON. Four exact recorded purchases on Oct 12/14/16/18 total S$26, plus unrelated chicken rice S$8; Food total S$34. Rejected: roast_server_output_invalid, completion completed, validation sentences. No accepted model roast, no retry. Existing fallback uses the verified 4 matching purchases and S$26, not 5 Food rows.
3. Replacement charging cable, Shopping, S$12, Singapore OFF / SMU OFF. One recorded category row, no repeat fact. Accepted, 85 characters: “Dropped $12 on a replacement charging cable—because you only replaced one this month.” Assessment: purchase-related but weak; unsupported inference from category count, no Singapore or student references. Final prompt forbids using category count this way.
4. Browser save: Zouk entry fee, Food, S$35, Singapore ON / SMU ON. Rejected: roast_server_output_invalid, completion completed, validation sentences. Exactly one expense remained saved and Offline fallback appeared.
5. After deleting only the fictional first admission row, a fresh browser save with a new ID and the same fictional purchase, amount and switches. Accepted: “Paying $35 just to get into Zouk counts as dinner on your budget, huh?” Assessment: recognises admission but still uses the Food mismatch as a meal punchline. This does NOT meet the requested quality standard. Added explicit mismatch-punchline prohibition afterward, unverified live.

## Browser and safeguards

The accepted popup was inspected at 1440x900 and 390x844. Text, close control and amount readable, phone navigation clear. Screenshots show the actual accepted sample, not an improved substitute:

- /private/tmp/tallyai-roast-quality-laptop.jpg
- /private/tmp/tallyai-roast-quality-phone.jpg

Used an isolated origin on port 5186. The user-owned localhost:5185 tab was not claimed or modified. Both fictional admission rows were deleted, isolated ledger returned to S$0, isolated context switches restored OFF. No caches or preferences were cleared globally. Fresh IDs plus safe HTTP diagnostics distinguished new calls from cache. Existing timer/cache/race/save behavior is unchanged and covered by smoke checks.

## Limits

This refinement improves instructions and preserves safety, but the live samples do not establish good humour or reliable category-conflict handling. Two of five generations failed the existing sentence validator, and accepted samples remained weak. Final prompt refinements need a later explicitly bounded live review. Shape validation cannot establish factual grounding or humour quality. No deployment occurred.


# Final bounded pass, 18 October 2026

This section supersedes the earlier prompt/input implementation notes while retaining the earlier samples honestly.

## Source changes

New `buildRoastInput` requests no longer include `category_month` aggregates at all, removing both category count and category total from the model's input. Exact-description AND category repeat facts remain, with inclusive dates, counts and cents. Category spending is still calculated locally for actual configured budget usage. Category labels and saved ledger records are unchanged. The shared validator still recognises legacy category facts to preserve old cached entries; the current builder does not emit them and cached results never regenerate on reload.

Replaced the accumulated prompt with a short priority hierarchy and four fictional style examples across admission, a sandwich, repeat tea purchases and a charging cable. Optional contexts and angles remain subordinate to purchase relevance. Budget boundaries, timeouts, token limits, schema, output validator, save flow, cache, popup timer and race protection were not changed.

## Sentence investigation

Added synthetic checks using the actual shared output validator. `S$6.50 for tea, those pearls had better pull their weight.`, its one-sentence question variant and an exclamation variant pass. Genuine two sentences, a question followed by a separate answer and missing terminal punctuation fail with `sentences`. Decimal amounts do not cause the reproduced failure. Historical discarded provider text was neither reconstructed nor accessed. Its exact sentence failure cause remains unknown.

## Fixed live run, exactly four controlled requests

Model gpt-4.1-mini via running local backend, production route and client validator, no retries or paid evaluator. Fictional ledger exists in the test script only; no browser ledger writes or user preferences changed. Name blank, no budget configured.

| Case | Input and context | Outcome |
| --- | --- | --- |
| Admission | Zouk entry fee, saved Food, S$35, Singapore ON / SMU ON, no repeat facts | Accepted, 76 characters: “Drop 35 bucks just to enter Zouk—hope the party's worth the admission shock.” |
| Ordinary meal | Chicken rice, Food, S$5.80, both ON, no repeat facts | Rejected: roast_server_output_invalid, HTTP 200, completion completed, validation sentences, elapsed 1214 ms. |
| Repeat purchase | Bubble tea, Food, S$6.50, both ON; four exact matches Oct 12/14/16/18 total S$26, unrelated Chicken rice S$8 excluded from repeats | Rejected: roast_server_output_invalid, HTTP 200, completion completed, validation sentences, elapsed 1501 ms. |
| Context disabled | Replacement charging cable, Shopping, S$12, both OFF, no repeat facts | Accepted, 97 characters: “Twelve dollars for a replacement charging cable—hope this one survives longer than your patience.” |

Grounding: admission sample recognises admission, makes no Food/class-meal joke or repeat/alcohol/academic claim. Cable sample uses the supplied replacement purchase and amount without asserting earlier purchases, and adds no Singapore/SMU material. Its patience jab is subjective teasing, not a supported personal attribute. Rejected samples have no accepted text for groundedness review. Their exact repeat facts were verified locally; no claim that the rejected model text used them correctly is made.

Humour: both accepted samples are understandable and purchase-related but still mild and formulaic, particularly the repeated “hope” construction. Two of four outputs failed syntax validation, a material reliability weakness. No further calls were made and invalid output was not relaxed, truncated or exposed. No claim that humour is proven by test counts.

## Verification and stop

Frontend build PASS; smoke 1042/1042 PASS; backend provider/schema suite and 84 Node tests PASS; git diff --check PASS. Popup behaviour did not change, so no new browser popup test or screenshots in this pass. Existing automated timer, hover/focus pause, caching, reload, failed-save independence and late-response checks passed. Previous-stage screenshots remain historical evidence only. Backend left running on 8787 with the final prompt. No commit, push or deployment.

## Next-task handover, not implemented

1. Greetings: add an explicit small-talk response that does not invent a spending query or misleading offline result; test live and offline.
2. Largest individual expenses: distinguish selecting individual rows from aggregating days/categories; use local cent-exact ranking, ties, scope and evidence.
3. Ambiguous “highest expenditure”: clarify individual transaction versus grouped total instead of guessing; preserve the original question and filters when asking clarification.

Keep existing add/delete confirmation and undo intact; use fixed fictional fixtures to distinguish these cases before further paid calls.


# KFC factual regression follow-up

## Diagnosis

The reported “Twenty-four KFC meals” generation cannot be attributed to a specific input field from the available evidence. The original request and raw output are unavailable, and were not reconstructed. The current money conversion maps S$23 to 2300 cents. Repeat counts come from matching-row array lengths, not amount conversion. Current new requests omit category counts/totals entirely. Earlier implementations did transmit category counts, but this alone does not establish the source of this particular 24. Unsupported model inference remains possible, not established.

## Focused protection

The prompt explicitly distinguishes cents from counts and recorded exact-match purchases from meals eaten or wider merchant loyalty. Added conservative English history-claim checks to the existing shared output validator, used by the backend, client and session. Recognised history claims without repeat evidence are rejected; counted meals/visits and unsupported recognised transaction counts are rejected even with repeat records. Rejected text is not returned by the backend. Fixed diagnostic reason: unsupported_history. Existing Offline fallback handles the rejection, without retrying, deleting or duplicating the saved expense. Repeat fallback now explicitly says recorded matching purchases. Legacy category facts remain accepted as cached input shapes but do not qualify as repeat evidence.

This is NOT comprehensive semantic validation. Unrecognised wording, implicit claims, period mislabelling or other languages can still evade these conservative patterns; benign wording can also fall back. No guarantee of universal groundedness or humour is claimed.

## Independent fictional regression results

- One KFC entry S$23: amountCents 2300, facts [], no transaction count field.
- One KFC among 24 Food entries: same amount and empty facts, no category count exposed.
- Genuine KFC records S$7.10 + S$4.35 + S$23: count 3, totalCents 3445, current amountCents still 2300. Distinct IDs count separately; duplicate same ID, future rows, similar descriptions and another category do not inflate counts.
- Shared validator rejects the reported sentence for unsupported_history; client rejects injected successful-HTTP text; backend returns only safe error metadata; session uses Offline fallback with one saved S$23 expense.
- A purchase-only S$23 joke and correctly counted recorded-purchase wording pass the focused checks. These are synthetic fixtures, NOT live model results.

No live request was made: the four-call allowance for the current bounded roast task was already exhausted. New KFC generation quality therefore remains unverified. User ledger and preferences were not accessed or modified. UI layout, popup timing, cache/race protections and save flow remain unchanged.
