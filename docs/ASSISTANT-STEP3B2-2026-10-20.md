# Step3B2: two-sided comparisons, local checkpoint, live gate blocked

The calculation/validation/evidence implementation is present locally, but **Step3B2 is incomplete at the live acceptance gate**. Do not publish or start multipart work on the strength of passing deterministic tests. Only one final comparison-path live numeric case passed; category and OR-period interpretation remain unreliable.

## 1. Time and Git baseline

Started 2026-10-19 15:59:35 UTC (23:59:35 Singapore), clean branch `checkpoint/2026-10-19-wip`, HEAD `abf5209a24b9633bb1227db260dbb1794b5161d3`. The 30-minute checkpoint was read at 16:29:48 UTC. Implementation stopped before that checkpoint; remaining work was verification, reporting and the local checkpoint. Completion time/elapsed seconds are recorded in `scripts/eval/step3b2-provenance.json`. The 60/80-minute checkpoints were not reached; no implementation started after 80 minutes.

The user-supplied AGENTS instructions apply; no repository AGENTS.md was found. The plan design was written before application edits. Main and wallpaper-redesign remain `6cf9345f660c2160b726ec1132a174b56d37213d`, the published source and an ancestor of this branch. No unexpected starting changes, history rewrite, push, main merge or deployment. This report accompanies the local WIP comparison checkpoint, not an accepted release.

No dependencies, model configuration, storage/category/sample/Home-chart/style code, roast tuning, multipart plans, top-N or savings work. No HOLDOUT cases were inspected, run or changed. MAIN expectations and oracle are unchanged.

## 2. One comparison contract

Keep existing `operation: compare`. Add one nullable descriptor:

- Periods: `comparison: {kind: periods, periods: [first, second], categories: []}`. Root period is neutral `all`, root start/end/dayCount null. Existing scalar/OR category, literal description, day and amount restrictions apply identically to both sides.
- Categories: `comparison: {kind: categories, categories: [firstId, secondId], periods: []}`. Exactly two distinct configured IDs. Root category/categories are empty; root period and shared description/day/amount filters apply to both.
- A period descriptor reuses the existing relative/range periods plus `named_month` with YYYY-MM. Only the relevant date/dayCount/month fields may be non-null. No independent side operations, filters, figures, IDs or approval flags.
- Legacy compare requests omitting the descriptor retain current/previous matching-elapsed month/week behaviour. All forms use the same executor in `comparison.js`; the legacy answer adapter delegates to it.

Shared validation still rejects malformed/oversized/missing sides, invented category IDs, invalid dates, stray side fields, conflicting root/side scope, non-total aggregation and invalid grouping. Normalisation accepts its own output, preserves complete OR lists and retains old recorded replies.

A live diagnostic found duplicate category IDs represented in both the root list and nested sides. The provider schema now uses mutually exclusive decoding variants over the **same canonical fields**, constraining scalar/list duplication and nested/root scope conflicts before generation. Exactly-two-side array bounds are enforced in the provider schema and shared validator. No rejected payload was accepted by weakening validation.

## 3. Dates, figures and disclosures

Completed named months resolve to full calendar months in code. Missing named-month years use the Singapore reference year; ambiguous cross-year questions should provide years. Explicit ranges retain their requested unequal/overlapping intervals. Future dates are capped with an explicit partial-period notice, and wholly future sides clarify.

Ordinary implicit current/previous month/week comparisons retain matching elapsed dates, including shorter-month caps. Explicit full/entire relative periods use their requested full windows and disclose unequal durations. An explicit full-period interpretation cannot silently replace an ordinary implicit elapsed comparison.

Date-only UTC arithmetic represents Singapore calendar dates. The browser reference date was 2026-10-20; MAIN retains its fixed 2026-10-19 reference. Both actual ranges and durations appear in results. Named month/range preservation guards reject substituted/truncated periods and third sides.

Code computes side totals/counts, signed first-minus-second difference, larger side/tie, and independently frozen supporting rows in integer cents. Each side displays all active filters. Within-side ID deduplication uses the shared matcher and remains consistent with stale checks. Overlap can place a row in both independent sides; it is disclosed and never deduplicated across sides.

For disjoint periods, percentage change names the chronologically earlier side as baseline and the later side as target. A zero baseline makes percentage change undefined. Symmetric categories and overlapping periods get no arbitrary percentage baseline. Empty records are explicitly not proof of no real-world spending. Selected explicit non-SGD records refuse comparison rather than being combined or converted.

## 4. Follow-ups, offline and preservation

Comparisons have two evidence scopes. “Show those transactions” asks which labelled side and points to its separate evidence control. Group, period, amount and exclusion amendments to a comparison ask for a complete question instead of choosing an implied side. Ordinary follow-ups retain their existing behaviour.

Both evidence sets are immutable. Changes to either side's relevant rows or category labels/removal, including initially empty configured categories, mark the old answer stale. Duplicate-ID evidence does not become immediately stale. Snapshots and historical totals do not mutate. Currency changes are fingerprinted.

Offline interpretation reuses the ordinary shared-filter parser for bounded named-month, ISO-range and configured-category forms. Unconsumed/ambiguous scopes clarify. Scalar implicit comparison alignment remains unchanged; OR-description implicit comparisons also retain elapsed alignment. Unsupported reviewed/inferred concept comparisons clarify without bypassing existing approval.

A one-sided `total` interpretation for a two-period question exposed an unsafe narrowing. General comparative-arity guards now block it in the normal intent/engine path and the legacy scalar-answer path. This is a refusal to calculate a different question, not implementation of a missing model interpretation. The observed saved intent now becomes a validated clarification in final handler/client/browser verification. No new paid retry was made.

## 5. Independent regression results

New fixture: `scripts/comparison-v2-fixture.js`, Art lab, Cycle club, Pantry, MetroFox and CloudCab. Values are independent of MAIN and earlier OR fixtures. Expectations are specified directly in cents and row IDs, not derived using application functions.

| Case | Independent expected | Actual |
| --- | --- | --- |
| Art lab September versus July | 4000 (v3/v4) versus 2000 (v1/v2), difference 2000; 30 versus 31 dates | Exact match, complete months |
| January 1–15 versus February 1–15 | 1000 versus 1000, two rows each, tie | Exact match |
| October Art lab versus Cycle club | 1444 (v6/v8) versus 2222 (v7), difference -778; no percentage baseline | Exact match |
| Explicit full September versus October, description OR | 4725 versus 3666, three rows each | Exact match |
| Implicit current/previous description OR | October 1–20: 3666; September 1–20: 3666 | Exact match, excludes September 30 |
| Category OR AND description OR AND weekdays AND amount >=10 | 4000 versus 3333, two rows each | Exact match |
| June zero baseline versus July | 0 versus 2000; undefined percentage, not no-real-world-spending claim | Exact match; also fresh live pass |
| Overlap July 1–15 versus July 10–31 | 2000 versus 683, v2 appears in both; no percentage baseline | Exact match |
| December 2025 versus January 2026 | 909 versus 10000; exact full ranges | Exact match |
| Leap/short-month/year-week boundaries | February 2024 ends 29; 2026 ends 28; January previous period in December | Exact match |

Additional checks cover totals/counts/full evidence, OR normalisation/round-trip, invalid dates and malformed sides, unknown IDs, extra/third sides, union versus comparison, different side-category/period combinations, future/unequal intervals, same-ID deduplication, both-side edits/additions/deletions, empty-side category removal, currency errors, provider error labels and one-sided-model-output refusal.

One obsolete Step3B1 unit assertion that every OR compare is unsupported was replaced by positive aligned-OR coverage. This is an application regression update, not a MAIN expectation edit.

## 6. Ten actual paid requests and final-code coverage

Exactly **10** provider interpretation requests, no automatic retries. The normal SDK timeout/model/output limits remain unchanged. Calls are logged under `step=3B2`: one three-call MAIN entry and seven one-call live-browser entries. An independent backend counter also recorded ten. No question was retried against the provider. Cached views, handler revalidation, follow-ups and MAIN replay used zero paid calls.

| # | Exact question / source | HTTP / intent | Actual result |
| --- | --- | --- | --- |
| 1 | M66: Did I spend more on Food & Drinks or Bubble Tea this month? | 502 / none | `intent_bad_field`, `query.comparison`; labelled offline fallback, not a live pass |
| 2 | M67: Compare my September spending with my July spending. | 502 / none | Same safe contract diagnostic; not a live pass |
| 3 | M76: How much did I spend on Food & Drinks this month compared with last month? | 502 / none | Same safe contract diagnostic; not a live pass |
| 4 | Browser: Compare my Art lab spending in September with July. | 502 / none | `intent_bad_field`, `query.categories`; offline 4000/2000 correct, not a live pass |
| 5 | Browser: Did I spend more on Art lab or Cycle club this month? | 502 / none | `query.comparison`; safe shape showed root and nested categories both populated. Offline 1444/2222 correct, not a live pass |
| 6 | Browser: Compare purchases mentioning MetroFox or CloudCab last month with this month. | 200 / clarify | Model selected unrequested category sides; `explicit_filter_coverage_incomplete` prevented calculation. Supported request not answered |
| 7 | Browser: Was my Art lab total higher between January1–15 or February1–15? | 200 / analyze total | Before the new guard, incorrectly displayed only January's 1000 cents. It did not answer the tie comparison. Final saved-intent revalidation now clarifies, no figure |
| 8 | Browser: Compare Art lab spending in June with July. | 200 / analyze compare | **Live numeric pass:** full June/July, 0/2000 cents, counts 0/2, exact evidence, undefined percentage baseline |
| 9 | Browser: Compare Art lab versus Cycle club versus Pantry this month. | 200 / clarify | Guarded clarification asks for exactly two categories and retains original three; no figure |
| 10 | Browser: Compare Cycle club versus Art lab spending this month. | 200 / analyze compare | Correct side IDs, wrong root period all. Application detected mismatch with “this month” and clarified; no live numeric category pass |

Calls 1–5 precede the mutually-exclusive provider-schema repair. Rejected raw responses were not retained, so their exact underlying fields cannot all be reconstructed. Call 5's bounded shape diagnostic establishes one conflict; it does not prove all earlier failures were identical. They are invalid-output/contract failures, not provider outages.

Calls 6–7 used the constrained schema but precede the one-sided-answer guard. Calls 8–10 exercised the guarded comparison path. A final equivalent guard for legacy scalar answers was added afterwards, verified deterministically and by final saved-intent handler/client checks. There is no fresh provider claim for that final legacy path. Every successful API envelope passes final client validation; the final executor can still clarify a semantically wrong period, as in call 10.

Only call 8 is counted as a fresh numeric comparison pass. Call 9 is a safe handling success. Call 6 and call 10 are blocked supported requests, not successful capability implementations. Call 7 remains recorded as an observed safety defect, with its repair and non-paid verification distinguished. No raw provider response, secret or real ledger was printed or retained.

Safe per-case originals, final outcomes, source hashes and diagnostics: `scripts/eval/step3b2-provenance.json`.

## 7. MAIN replay versus live

Before and implementation-with-old-captures replay: **74/76 questions, 80/82 turns**. Final replay after the three intended recording updates: **71/76 questions, 77/82 turns**, three offline fallbacks. Only M66, M67 and M76 changed; the other 71 recording keys are preserved.

Failures: M46, M48.2, M66, M67 and M76. M46's rules clarification remains an oracle failure; free-form exclusion M48.2 stays deferred. The three refreshed cases preserve their actual pre-schema HTTP502 envelopes. Replay cannot exercise a newer server handler or prove that a failed model interpretation now succeeds.

M67's unchanged expectation also says unsupported. A future correct fresh two-month answer would conflict with that old expectation; no expectation was changed in this task. The current score decrease is caused by the retained HTTP failures, not an expectation correction. Neither score is wholly fresh live accuracy. Offline arithmetic matches the independent MAIN totals (M66 11790/3950, M67 14840/105239, M76 11790/3190 cents) but does not count as a live pass.

## 8. Browser coverage and cleanup

Isolated fictional origin `http://127.0.0.1:5244`, fresh task backend 8844 importing current handler/provider/shared validation. Restarted only that backend after relevant changes, preserving paid count and failed captures. The user's ordinary servers and all real Pages/Vercel storage were untouched.

At 1440×900 and 390×844 inspected labelled ranges, totals/counts/difference, side filters, complete source rows, zero/empty-baseline explanation, which-side follow-up, keyboard Enter expansion and visible focus. Two populated evidence sets were inspected using **labelled offline fallback** from the saved original HTTP502. That is UI/offline-calculation coverage, not a live-model pass. Live zero-baseline UI and later saved-live rendering are distinguished. No fabricated successful mock response was used. Phone document width was 375 within the 390 viewport; laptop width stayed within 1440. Long details and evidence use existing vertical scrolling.

Screenshots/DOM files outside commits, `/private/tmp/tallyai-step3b2/`:

- `pre-guard-narrowed-range-laptop.jpg` (observed unsafe one-side result)
- `final-range-guard-laptop.jpg`, `final-range-guard-phone.jpg` (repaired, saved-live revalidation)
- `live-zero-baseline-laptop.jpg`, `live-zero-baseline-phone.jpg`, `final-zero-baseline-laptop.jpg`, `final-zero-explanation-phone.jpg`
- `live-comparison-followup-phone.jpg`, `live-three-sides-phone.jpg`, `live-category-period-mismatch-laptop.jpg`
- `offline-months-evidence-laptop.jpg`, `offline-months-evidence-phone.jpg`, `offline-months-evidence-dom.txt`

Viewport restored, task tab closed, and only the two task servers stopped. Screenshots/build logs remain outside tracked source. No real browser data was cleared.

## 9. Required gates

Final required checks: build pass; smoke **1964/1964** (82 new B2 checks and one obsolete OR assertion removed, net +81 over 1883); provider checks **28/28**; backend node tests **174/174** (+20); `git diff --check` pass. The deterministic suite verifies calculation and safety logic, not live interpretation reliability.

## 10. Decision and next task

**Blocked, incomplete live acceptance.** Preserve this local checkpoint for review. Do not merge, publish, or begin multipart planning. The next bounded task should repair comparison intent selection (period versus category, requested period preservation, OR-description scope) and close final-code fresh-live coverage for M66/M67/M76, category and OR-period families under a newly authorised call budget. Keep the current strict rejection and anti-narrowing guards. No model change, new capability, roast work or publication is started here.
