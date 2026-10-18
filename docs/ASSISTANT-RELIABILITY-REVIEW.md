# Assistant reliability review, 18 October 2026

## Existing features retained

The shared local filter/calculation pipeline already supported totals, counts, averages, lists, grouped highest spending, weekday/weekend analysis, matched-elapsed comparisons and category budget pace estimates. Evidence snapshots, relevant-ledger/budget stale detection, integer cents, Singapore date ranges, missing-data/zero-baseline explanations and confirmation/undo behavior were retained. The roaster was not tuned in this stage.

## Changes

- Built-in greeting/help handling, with no ledger calculation or paid request for greeting-only messages. Greeting prefixes do not consume a financial question.
- Ambiguous highest expenditure asks single transaction, category total or daily total. Three self-contained questions explicitly default to this month. Known alternative supported scopes are retained. Unparsed extra filters retain Edit original question instead of broad choices that discard them.
- Added `largest` to the shared strict query schema, validator, local executor, offline matcher and model instructions. It uses the same filters as other reads, compares integer cents, retains all ties, shows descriptions/dates/categories/amounts, and captures winning evidence with every candidate as the stale-detection basis.
- Clarification buttons submit complete scoped questions. One-word model options are not rendered as context-free replies.
- Safe invalid-intent diagnostics now contain fixed error codes and field names, not model values. Genuine validation failures still trigger the labelled offline path.
- Following observed failures, clarified category_terms schema/instructions and separated context vocabulary from the user message as input JSON. No additional live calls were made to verify this final adjustment.

## Diagnosis limits

The initial live reproduction of “what is my highest expenditure” returned HTTP 200 with type analyze, so the user's earlier validation failure was NOT reproduced exactly. The old contract lacked an individual-transaction operation and deterministic ambiguous-highest clarification. A synthetic highest query with groupBy null reproduces a safe `intent_bad_field`, `query.groupBy` rejection. This does not establish the exact contents of the user's old discarded response.

The browser comparison request failed with `intent_bad_field`, field `query.structure` before field diagnostics were expanded. Its exact rejected condition cannot be recovered. The weekday request subsequently failed at `query.category_terms`. That identifies a category-term validation problem, but does not prove whether it copied the context catalog or invented an unmapped term. The final context/schema guidance targets this potential confusion while retaining validation; it is mock-tested but unverified live.

## Independent fictional fixture

Today 2026-10-18. Food, Private hire and a real user-created category Creative hobbies (browser-generated ID, not hardcoded).

| ID | Date | Description | Amount | Category |
| --- | --- | --- | --- | --- |
| a | 2026-10-01 | KFC | S$23.00 | Food |
| b | 2026-10-02 | Kopi | S$2.50 | Food |
| c | 2026-10-03 | Sketchbook | S$40.00 | Creative hobbies |
| d | 2026-10-05 | Grab ride | S$40.00 | Private hire |
| e | 2026-10-12 | KFC | S$10.00 | Food |
| f | 2026-10-17 | Chicken rice | S$20.00 | Food |
| g | 2026-09-01 | KFC | S$15.00 | Food |
| h | 2026-09-10 | KFC | S$5.00 | Food |
| i | 2026-10-07 | Art pen | S$5.00 | Creative hobbies |
| j | 2026-10-14 | Art paper | S$5.00 | Creative hobbies |

Budget: Creative hobbies S$100. Automated fixture is in scripts/assistant-fixture.js. Browser data was entered and corrected through the UI. Native date-input fill initially changed only the DOM value without updating React state; native ArrowUp/ArrowDown committed the desired dates, and the fixture was verified before any financial queries. This was test-input automation, not a source change to the date form.

## Expected versus actual

| Family | Independently expected | Actual/mode |
| --- | --- | --- |
| Greeting/help | No ledger figure, useful suggestions | Built-in in browser at both widths; automated variants, zero paid calls |
| Ambiguous highest | Clarify individual/category/day, complete scoped choices | Built-in in browser at both widths; largest choice submitted as a full question |
| Largest single | c and d tied at S$40, distinct dates and categories | Live browser HTTP 200, both exact evidence rows; alternate phrasings/custom labels/description/amount/day/empty/future cases automated |
| Totals/count/average | October 23+2.50+40+40+10+20+5+5 = S$145.50; 8 rows; per-transaction average S$18.19 | Automated offline/local execution, plus matching Home browser total |
| Weekdays/weekends | S$85.50 / 12 weekdays = S$7.13; S$60 / 6 weekend days = S$10; lower total weekends, lower daily average weekdays | Automated offline/local pipeline, discrepancy explanation verified |
| Filtered list | Food at least S$20: a and f, S$43, boundary included | Live browser HTTP 200, greeting prefix preserved, exact rows; strict/inclusive/under/custom-category variants automated |
| Highest usual weekday | Monday S$50 / 2 calendar occurrences = S$25; rows d/e, zero-spend days included | Live attempt rejected; labelled offline browser answer correct; variants and method automated |
| Description comparison | KFC Oct 1–18 S$33 vs Sept 1–18 S$20; S$13 more, 65%; rows a/e versus g/h | Live attempt rejected; labelled offline browser answer/evidence correct at both widths; arbitrary other description and zero-baseline variants automated |
| Category pace | Creative hobbies S$50 / 18 = S$2.78/day; S$50 remaining; current pace lasts beyond month-end | Live browser HTTP 200, real custom ID, method/range/conditional wording shown |

Automated existing checks also retain month/week boundaries, shorter months, cent-exact sums, no-match evidence, missing budgets, limited-history suppression, zero spending, zero baselines and stale budget evidence. Largest-candidate edits, additions and deletions invalidate old answers. Browser delete/Undo of fictional Kopi made the old largest answer out of date without rewriting its S$40 figures.

## Live allowance, exactly six controlled requests

1. Baseline highest expenditure before changes: HTTP 200 analyze, not the required clarification; earlier 502 not reproduced.
2. Largest single expense via clarification button: HTTP 200, source model, correct ties and evidence.
3. Explicit KFC description comparison: HTTP 502 invalid_intent; labelled offline calculation correct. Safe diagnostic query.structure.
4. “Hello, show Food transactions at least S$20 this month”: HTTP 200, source model, correct inclusive list/evidence.
5. Usual highest-spending weekday this month: HTTP 502 invalid_intent; labelled offline calculation correct. Safe diagnostic query.category_terms.
6. Creative hobbies budget pace: HTTP 200, source model, correct conditional estimate and evidence.

All live requests used the running local backend on 8787 with gpt-4.1-mini. Browser successes expose source=model, actual endpoint and HTTP 200 as DOM verification metadata. No retries, extra generation, secret output, raw provider response output or ledger transmission. Greeting/ambiguity are intentionally built-in, not described as live AI. No more live allowance remains.

## Checks and screenshots

- Frontend build PASS.
- Smoke 1137/1137 PASS.
- Backend 28 provider/schema checks + 92 Node tests PASS.
- git diff --check PASS.
- Actual browser configured at 1440x900 and 390x844. No material clipping/overlap in inspected answer/evidence controls; long phone conversations/evidence use scrolling, desktop page scrolls.

Screenshots, fictional data only, outside Git:

- /private/tmp/tallyai-assistant-greeting-laptop.jpg
- /private/tmp/tallyai-assistant-greeting-phone.jpg
- /private/tmp/tallyai-assistant-clarification-laptop.jpg
- /private/tmp/tallyai-assistant-clarification-phone.jpg
- /private/tmp/tallyai-assistant-largest-laptop.jpg
- /private/tmp/tallyai-assistant-largest-phone.jpg
- /private/tmp/tallyai-assistant-comparison-laptop.jpg
- /private/tmp/tallyai-assistant-comparison-phone.jpg
- /private/tmp/tallyai-assistant-filtered-laptop.jpg
- /private/tmp/tallyai-assistant-filtered-phone.jpg

## Remaining limits and cleanup

The live comparison and weekday attempts did not pass AI validation. Correct offline answers do not establish live AI reliability. Final category-term/context guidance requires a later bounded live check. Unsupported multi-category combinations, arbitrary comparison periods and ambiguous merchant identity still require clarification. Built-in conversational recognition is deliberately finite, not unrestricted conversation.

Removed all ten disposable rows, the custom category and its budget through the UI. Restored isolated roasting preference ON and current header month October; Singapore/SMU remained OFF. The user's localhost:5185 tab, expenses and preferences were not claimed or modified. Frontend test server 127.0.0.1:5186 and final backend 8787 remain available. No commit, push or deployment.

User-operated microphone and real receipt checks remain pending, including the exact Lazada One transcript case, unclear input and denied permission. Physical phone testing awaits suitable HTTPS. Browser emulation and synthetic transcripts do not verify hardware; see docs/HARDWARE-CHECKLIST.md.
