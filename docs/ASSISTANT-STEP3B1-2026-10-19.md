# Assistant roadmap Step3B1: bounded OR filters

Implemented locally. Explicit category unions and literal-description unions execute through the existing cents/evidence engine. Category comparisons, inferred concepts and reviewed scopes retain separate handling. No publication or next-stage implementation.

## 1. Git baseline and change boundary

Started clean on `checkpoint/2026-10-19-wip`, HEAD `a46cfc6b2ecabb65600400fe9c8654efe5b9ed9c`. Published `6cf9345` remains an ancestor; main and wallpaper-redesign are unchanged. This report accompanies the one logical `feat(ask): support bounded explicit OR filters` commit. No history rewrite, push, merge, deployment, dependency/model change or storage migration.

The design was written into `docs/ASSISTANT-UPGRADE-PLAN.md` before application edits. Category/sample/Home-chart/storage code and styles are unchanged. User-supplied repository instructions apply; no repository AGENTS.md was found. No HOLDOUT cases or expectations were inspected, executed or changed. MAIN question/oracle expectations are unchanged.

## 2. Representation and exact semantics

The general query gains optional `categories` and `descriptionTerms` arrays. Canonical output always includes both arrays, empty when absent. Old recorded replies and scalar `category`/`description` queries remain valid. The strict provider schema requires the arrays, while shared validation accepts old replies omitting them.

- OR within each list. AND between category, description, inclusive date, day and amount restrictions.
- Up to eight entries per list, checked before deduplication. Description terms are 1–80 characters. Invalid types, null lists, oversized lists, blank terms and unknown category IDs are rejected, never truncated.
- Category IDs match configured IDs exactly. Term case and whitespace normalise with trim, collapsed whitespace and en-SG lowercase. Canonical lists deduplicate and sort. A scalar and nonempty list of the same dimension are rejected rather than guessed or merged.
- Matching remains literal substring matching, not merchant identity. A term such as Grab can also match GrabFood. Regex characters have no executable meaning. Unknown query fields/SQL/expressions remain rejected.
- OR selections deduplicate by transaction ID. `filterMatching.js` supplies common literal/category predicates to explicit filters and reviewed scopes. Reviewed-scope inclusion rules still use their existing cross-dimension union, exclusions and approval requirement; the new lists intersect with that scope.
- The answer, interpretation and scope review disclose every active category and description rule. Category lists never also say “All categories”.

`category_terms` remains unmapped category-word metadata, not an executable ID list. Valid explicit lists do not silently rescue malformed metadata. Independently recognised missing coverage produces a typed clarification; invented metadata on an ordinary single-subject question remains an error. Missing or unrequested explicit list members cannot silently narrow a new question. Explicit description wording is protected from being mistaken for category vocabulary, and quoted conjunctions remain literal.

## 3. Supported operations and limitations

Supported with OR filters: total, count, all existing average denominators, transaction list, complete category/month breakdown, largest/latest, highest grouped winner and weekday/weekend partition. Winner evidence retains the full candidate basis for staleness, while displaying only winners.

OR-filter projection and compare operations clarify. Existing scalar budget projection and matching-elapsed month/week comparisons remain supported. Comparing named categories still clarifies, including compared/comparing and more/less paraphrases. An amount restriction such as “more than S$10” is not a category comparison. No generalised comparison, top-N, multipart plan, savings or new exclusion capability was added.

Broad related-spending concepts remain reviewable `propose_scope` intents. `analyze` carrying a spendingScope becomes a proposal, and direct execution without the matching locally approved rules refuses to calculate. OR lists do not grant approval.

Offline interpretation supports explicit known-category coordination, explicit descriptions mentioning literal OR terms, quoted OR lists and their compatible intersections. Unresolved coordination and unconsumed filters clarify. It is a bounded grammar, not arbitrary language understanding. Existing greeting/noise, provider errors and truthful offline labels remain covered.

## 4. Independent regression data and expected versus actual

`scripts/or-filter-fixture.js` uses Studio kits, Bicycle upkeep and Campus meals, with BlueCab/SwiftVan descriptions. It is separate from MAIN. The row containing both terms must count once. Expectations below are literal independent cents/IDs, not results copied from the application matcher.

| Case | Independent expectation | Actual |
| --- | --- | --- |
| October category union | 7711 cents, u1/u2/u3/u6/u7/u9 | Exact match |
| October description union | 11109 cents, u1/u2/u3/u4/u7/u9 | Exact match |
| October category AND description unions | 7105 cents, u1/u2/u3/u7/u9 | Exact match |
| Last 30 inclusive dates, description union | 11816 cents, 8 rows; includes September 20 and October 19, excludes October 20 | Exact match |
| Intersection, at least 10.01 / over 10.01 | 6006 / 5005 cents, 3 / 2 rows | Exact match |
| Weekend intersection | 3003 cents, u3 only | Exact match |
| Empty amount intersection / literal regex-like term | 0 cents, no evidence rows | Exact match |
| Category union, year, month breakdown | 8418 cents; September 707 + October 7711; 8 rows | Exact match, all full/group evidence recombines |
| Both unions, year, live month breakdown | 7812 cents; September 707 + October 7105; 7 rows | Exact match |
| Old scalar Studio kits total | 4610 cents, u1/u3/u6 | Exact match |
| Reviewed scope AND both lists | Preview 5 candidates, no aggregate; execution blocked before approval; approved total 7105 cents | Exact match |

Additional checks cover averages, count/list, winners, largest/latest, day types, repeated/overlapping IDs, normalisation, 80-character boundary, invalid/oversized lists, unknown IDs, scalar/list conflicts, validation round-trip, missing members, unrequested inferred filters, comparison paraphrases, amount-comparison wording, ambiguous category/description wording, quoted conjunctions, overlapping category labels, short colon-delimited scope and independent questions after background prose.

## 5. Follow-ups, evidence and preservation

Canonical queries carry complete lists into existing local amendments: show supporting transactions, regroup by month/category, change period and compatible amount narrowing. Independent questions start fresh. No follow-up module rewrite was necessary.

Regression checks mark old answers stale for a row moving between included categories, leaving the category union, a description entering/leaving a match, additions/deletions, label changes and a category disappearing. Even deletion of an included category with no matching rows marks its old evidence stale. Invalid inherited category IDs block refreshed follow-ups; they cannot turn into an all-category query. Historical snapshots stay frozen and are still available with a stale warning. Irrelevant ledger edits do not mark the answer stale.

The final browser verified that an ambiguity clarification does not replace the accepted union context: the following category breakdown still returned 7711 cents, Bicycle upkeep 3101 + Studio kits 4610, referring to the accepted answer.

## 6. Evaluation and actual paid requests

| Run | Questions | Turns | Provenance |
| --- | --- | --- | --- |
| Before | 74/76 | 80/82 | Starting mixed-age MAIN replay |
| Code with old recordings | 74/76 | 80/82 | Existing captures retained; zero paid calls |
| Fresh intended MAIN subset | 2/2 | 2/2 | M66 and M68 attempted once each |
| Final MAIN replay | 74/76 | 80/82 | Two intended refreshes; other 72 keys retained; zero replay HTTP/paid calls |

Only **M68** differs in the stored JSON. M66 was freshly attempted but produced an identical envelope; the 73 other key values, including M66, match the starting file. The existing merge-safe recorder was used, with no expectation edits. M50 still replays its older reviewed proposal; it was not refreshed just to improve a score. M68's unchanged MAIN expectation accepts an answer but contains no numeric oracle, so its exact union total/evidence were independently checked as below.

Exactly **six actual provider calls**, below the eight-call cap, `maxRetries: 0`. Two intended MAIN calls plus four actual live browser requests. No failed request was retried, no prompt was edited to chase a result, and the remaining allowance was not spent. `scripts/eval/calls.log` contains the two-call MAIN entry and four one-call browser entries. The isolated backend independently counted six.

| Source / exact question | HTTP / validated intent | Outcome |
| --- | --- | --- |
| MAIN M66: Did I spend more on Food & Drinks or Bubble Tea this month? | 200 / clarify | `category_comparison_unsupported`; no query or financial figure |
| MAIN M68: How much did I spend on Food & Drinks, Bubble Tea and Public Transport this month? | 200 / analyze total | All three IDs retained; application 18200 cents and exact evidence independently verified using a plain loop over the fictional ledger |
| Browser: Total Studio kits and Bicycle upkeep spending this month. | 200 / analyze total | Application 7711 cents, six exact rows; both categories disclosed |
| Browser: Show purchases mentioning BlueCab or SwiftVan over the last30days. | 200 / analyze list | Application 11816 cents, eight exact rows, 2026-09-20 through 2026-10-19; both literal terms disclosed |
| Browser: Break down Studio kits and Bicycle upkeep purchases mentioning BlueCab or SwiftVan by month this year. | 200 / analyze breakdown | Application 7812 cents, seven exact rows; September 707 and October 7105; both dimensions retained |
| Browser: Total Studio kits and bubble tea spending this month. | 200 / clarify | Original live wording: “Do you want to include Campus meals as bubble tea spending?” No query or calculation; wording was not a clean quality pass |

All six live responses passed server/client validation and had no offline fallback. The model selected interpretations; all figures came from application code.

### Final guard provenance

After these calls, final safety checks prevented unrequested category/term lists from being treated as explicit filters, retained the old malformed-metadata safeguard, strengthened comparison wording and applied the existing ambiguity reason consistently to help/clarify as well as analyze. The last change addresses the ungrounded Campus meals suggestion without another paid call.

Only the task backend was restarted after shared/backend changes, preserving its six-call counter. Each saved live intent was passed through the **current actual handler and client** using capped saved-response transport. Five final envelopes are unchanged. The ambiguity remains HTTP200/clarify, now reason `explicit_filter_coverage_incomplete` with fixed code-authored wording asking for configured categories and literal description terms, retaining the entire original question. It calculates nothing and does not suggest Campus meals. This was verified in the actual browser at both sizes.

This is final-code handler/client and recorded-live rendering coverage, **not a fresh post-guard provider request**. Original live and final source hashes, both ambiguity texts, exact queries, independent totals/IDs and the counter are retained in `scripts/eval/step3b1-provenance.json`. Negative guard cases are deterministic tests. The original ungrounded wording is preserved in provenance, not presented as the final UI result.

## 7. Browser coverage

Isolated origin `http://127.0.0.1:5243`, fictional storage only. No real Pages/Vercel storage was accessed or cleared. Fresh task backend port 8843 imported current handler/provider/shared modules; the normal user servers were not stopped or restarted.

At 1440×900 and 390×844 inspected full category/literal rule disclosure, inclusive dates, readable amounts, complete full evidence and month-specific evidence, local OR follow-ups, ambiguity/edit control and no misleading offline notice. Document widths were 1440 at laptop and at most 390 at phone, with no horizontal overflow. Long conversations and evidence use existing vertical scrolling; all seven full and two September-group rows were available.

Actual live-started category chain: total 77.11 → monthly breakdown 77.11 → previous month 7.07 → over 3.00 narrowing 5.05 → original supporting record 5.05. Follow-ups are built-in calculations/snapshots, zero paid calls. A saved-live breakdown was also used for final-code follow-ups retaining both category and description lists, including period and amount restrictions. Final ambiguity rendering and context-preservation checks used saved live intents, not mocks or another live interpretation.

Screenshots and DOM observations are outside commits under `/private/tmp/tallyai-step3b1/`:

- `category-union-laptop.jpg`, `category-union-phone.jpg`
- `description-union-phone.jpg`, `description-evidence-dom.txt`
- `filtered-breakdown-laptop.jpg`, `filtered-breakdown-phone.jpg`, `filtered-groups-phone.jpg`, `filtered-group-evidence-phone.jpg`
- `followup-chain-phone.jpg`, `both-lists-followup-laptop.jpg`, `both-lists-followup-phone.jpg`
- `ambiguity-laptop.jpg`, `ambiguity-phone.jpg` (original live wording)
- `final-ambiguity-laptop.jpg`, `final-ambiguity-phone.jpg` (final guard, saved-live transport)
- `final-context-after-ambiguity-laptop.jpg`, `final-context-after-ambiguity-phone.jpg`

The browser viewport was restored and the task tab closed. A browser action timed out in automatic review, then succeeded after state recovery. No paid request was involved. A development reload cleared in-memory chat during final changes; storage and the earlier retained observations remained, and final context checks were repeated through saved transport.

## 8. Required gates

- `npm run build`: pass.
- `npm run smoke`: **1883/1883**, including 138 new OR checks above the 1745 baseline.
- Backend `npm test`: **28/28 provider checks and 154/154 node tests**, including 22 new node tests above 132.
- `git diff --check`: pass.

Only task-created temporary servers are cleaned up. No user server, browser record or saved preference is removed. Generated screenshots stay outside commits.

## 9. Remaining failures and limits

MAIN failures remain M46 (useful explicit-rules clarification, but unchanged expectation requires proposal/answer) and M48.2 (deferred free-form exclusion). The replay is mixed-age, not wholly fresh live accuracy. Existing accepted clarifications do not establish all financial capabilities, and broad inferred scopes still require approval.

No fresh provider call was made after the final safety/ambiguity guards; final replayed-intent handler/client/browser coverage is labelled above. Unbounded language, generalised comparisons, new exclusions, top-N, multipart plans, savings, physical-device, voice/receipt, production and HOLDOUT verification remain outside this task. No next assistant stage or roast work started.

## 10. Next task recommendation

Step3B1's bounded OR implementation and deterministic/browser gates pass, with the live provenance limit explicit. Propose a separately authorised task for generalised period/category comparisons, defining period alignment, category-side scopes, empty denominators and evidence before implementation. Do not start it automatically. No push or deployment.
