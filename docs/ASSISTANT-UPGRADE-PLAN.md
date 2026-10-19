# Assistant upgrade plan, Stage 1

Audit date: 19 October 2026, Singapore. Baseline reference date: **2026-10-19**.
Starting branch `wallpaper-redesign`, HEAD `6f912c81a6207c5157d20c6d0d0c5e5bff88c133`.
Initial working tree clean. No repository/ancestor AGENTS.md files found; the user-supplied instructions apply.
Only this planning document changes in Stage 1. No application, schema, dependency, configuration or ledger changes.

## Current architecture

| Boundary | Actual files/functions and behaviour |
| --- | --- |
| Conversation/UI | `src/App.jsx`: `chat` is session React state, survives tab switches but not reload; `askQuestion` sends only the new text, then calls `planFromIntent`. Messages retain interpretation/evidence, not a reusable canonical query. `src/views/AskView.jsx` owns draft input, renders answers, evidence, clarification and confirmation cards. |
| Request/context | `src/lib/assistantClient.js::requestIntent` sends `{message, context}`; `src/lib/intent.js::buildContext` includes today, category IDs/labels, expense count and hasData. No rows, merchant catalog, budgets, savings inputs or previous-query context. Provider forwards today, categories and expenseCount, omitting hasData. |
| Model/schema | `backend/src/provider.js::SYSTEM_PROMPT`, `buildSchema`, `requestIntent`; strict Responses Structured Outputs, query schema from `generalQuerySchema`. Default and effective local `OPENAI_MODEL`: **gpt-4.1-mini**, verified by importing with existing backend env; key presence checked without displaying its value. No model change. Request timeout 10 seconds, maxRetries 0, output-token cap 700. |
| Server/client validation | `backend/src/routes.js::handleIntent` validates via shared `validateIntent`; browser validates again. `src/lib/queryContract.js::validateQuery` checks operations, real category ID, dates, filters and compatible grouping. `intentDiagnostic` returns fixed codes/field names. `api/assistant/intent.js` adds size/rate/method guards around the same handler. |
| Planning/execution | `src/lib/assistant.js::planFromIntent`: new `analyze` reads use `queryEngine.js::executeQuery`; legacy `answer` reads remain compatibility-only. Add/delete proposals still require confirmation. Financial figures come from local ledger functions, not model text. |
| Matching | Ledger has description, category, decimal amount, date, notes and ID; no dedicated merchant identity/alias field. `queryContract.js::rowMatches` combines date + one category + one case-insensitive literal description substring + optional amount/day filter. It does not resolve merchant aliases, normalise merchant identity, match notes for assistant reads, or combine OR/exclusion scopes. |
| Dates/money/groups | `format.js::today` uses Asia/Singapore. `queryRange` supports current/previous week/month, today/yesterday/all/explicit inclusive range; future end is capped today. No last-N-days/year enum. `money.js::sumCents`, `toCents`, `totalsBy` and `stats.js::byCategory/byMonth` already supply exact aggregation primitives. `stats::addDays/weekStart` use host-local dates; this audit ran under TZ=Asia/Singapore, not a cross-timezone test. |
| Aggregation | `executeQuery` filters the complete ledger before aggregation; no search-preview truncation. `groupBy` is allowed only for `highest`, which reports winners. It computes all `analysisGroups` internally, but App does not forward them and its evidence is winner-only. This is not a full breakdown operation. |
| Evidence/staleness | `answerEvidence.js::captureEvidence` stores immutable rows, full candidate basis and scope. `evidenceIsOutdated` reruns the shared matcher, detecting relevant edits/deletes/additions and label changes. `markOutdatedAnswers` preserves old figures and sticky warnings; projection budgets are fingerprinted too. `AnswerEvidence.jsx` and `ComparisonEvidence.jsx` render read-only lists. New scope types must extend this same matcher, not only execution. |
| Clarification/offline | `assistantDialogue.js` handles built-in greetings/ambiguous highest questions. `completeQuestionChoices` renders only self-contained scoped questions; otherwise UI offers Edit original question. `queryOffline.js::interpretOffline/answerOfflineQuery` is conservative and shares the engine; `ask.js::answer` delegates to it. Explicit offline notices remain. |
| Existing checks | `scripts/query-checks.jsx::queryChecks`, `scripts/assistant-reliability-checks.jsx`, `scripts/assistant-fixture.js`, `backend/src/assistant.test.mjs`, provider/schema tests. Existing documents are historical verification reports, not a plan for these four capabilities, so this dedicated document is appropriate. |

## Capability gap map

| Capability | Classification and evidence |
| --- | --- |
| Merchant/description total across categories over explicit range | **Already supported and verified**: Amazon S$60.06, three rows. This is substring matching, not verified merchant identity. |
| One merchant filter plus one category filter | **Already supported and verified**: three separate category totals match the oracle. |
| Full merchant category/month breakdown | **Blocked by interpretation/schema and execution/UI**: total+groupBy rejected; highest is a different operation, exposes winner-only evidence. Grouping primitives are reusable. |
| Last 90 dates / this year | Explicit range **supported and verified**; named forms **blocked by interpretation/schema/offline support**. Model can express explicit dates but application lacks deterministic last-N/year resolution. |
| Multiple categories | **Blocked by schema/validation and matcher**: scalar category, category_terms length >1 rejected; original message also independently checked for multiple named categories. No silent narrowing is acceptable. |
| Car-related spending | **Blocked by reviewable scope and execution**: no concept catalog, OR filters, exclusions or scope-approval UI. Three explicit description queries can support a manually agreed scope, not an automatic concept answer. |
| Temporary savings scenario | **Blocked by missing user inputs and contract/calculator/UI**. Existing budget exhaustion projection is a different calculation. Savings, contribution commitments and an accepted spending baseline cannot be inferred from category budgets. |
| Break down / exclude / show those follow-ups | **Blocked by missing conversation context and typed amendments**. There is no previous canonical query in the outbound request or reusable App state. Offline “Show those transactions” wrongly becomes description substring “those”. |
| Existing evidence and stale warnings | **Already supported and verified** for current scalar scopes. Rich scopes/context/scenarios **unimplemented**, not covered by these passing checks. |
| New capabilities in actual browser | **Unverified/unimplemented**. Stage 1 is a function/schema audit, not browser acceptance of features that do not exist. |

## Deterministic fictional baseline

Temporary fixture/script: `/private/tmp/tallyai-stage1-baseline.mjs`; installed Vite SSR output: `/private/tmp/tallyai-stage1-build/`.
No fixtures were loaded into browser storage. Independently specified expected cents/IDs were asserted against existing functions.

Merchant fixture uses descriptions because there is no merchant field:

| Date | Description | Category | SGD | Expected |
| --- | --- | --- | ---: | --- |
| 2026-07-21 | Amazon | Shopping | 9.00 | Excluded by date |
| 2026-07-22 | Amazon | Shopping | 10.01 | Included m1 |
| 2026-09-01 | Amazon | Books | 20.02 | Included m2 |
| 2026-10-18 | Amazon | Household | 30.03 | Included m3 |
| 2026-10-19 | Another merchant | Shopping | 40.04 | Excluded by description |

The inclusive 2026-07-22 through 2026-10-19 window was independently checked as 90 dates.

| Check | Expected | Actual |
| --- | --- | --- |
| Explicit Amazon total/list of source rows | 6006 cents; m1,m2,m3 | Pass: S$60.06 and exactly those three rows |
| Separate category-filtered totals | Shopping 1001, Books 2002, Household 3003 cents | Pass, but three separate queries, not the requested combined feature |
| One complete breakdown query | All three groups, total and all evidence | Unsupported: `query.groupBy` rejects total+category grouping |
| Highest-category substitute | Must not be accepted as full breakdown | Existing highest returns Household S$30.03 and only m3 evidence; internal analysisGroups contains all three amounts |
| Relevant row edit / new Amazon row / unrelated addition | Stale / stale / unchanged | Pass under existing scope matcher |
| Multiple categories / year enum | Honest rejection | Pass: category/category_terms and period validation failures respectively |

Related fixture: Fuel S$50 on Jan 5 (Transport), Car insurance S$100 on Feb 10 (Insurance), Car repair S$150 on Mar 15 (Repairs), MRT S$20 on Apr 10 (Transport), Health insurance S$30 on May 10 (Insurance), previous-year Fuel S$40 on 2025-12-31.

- Oracle: **30000 cents**, rows c1,c2,c3, range 2026-01-01 through 2026-10-19.
- Actual: three separate supported description queries (`fuel`, `car insurance`, `car repair`) over that explicit range produce those rows and S$300 together. A single combined/reviewed concept query is **unsupported**.
- Review rationale: explicit car insurance/repair descriptions support inclusion; fuel in Transport is a proposed inclusion requiring user acceptance because “fuel” alone does not prove car use. Do not include all Transport/Insurance. MRT, health insurance and previous-year fuel are excluded. Merchant alias/concept normalisation remains unimplemented.

Savings oracle, **not a passing application calculation**:

- (500000 target − 200000 already saved) = **300000 cents** remaining.
- 300000 ÷ 6 contributions = **50000 cents/month** required.
- 50000 − 30000 already planned outside the cut = **20000 cents/month** additional reduction.
- Accepted 25000-cent entertainment baseline − 20000 reduction = **5000 cents/month** remaining.
- If accepted baseline were 15000 cents, entertainment alone is **5000 cents/month insufficient**. Never present negative entertainment spending as a solution.
- Current contract rejects operation `savings`; offline full question clarifies generically. Missing saved amount, contributions remaining, existing planned contribution and actual/assumed baseline need specific questions. Configured budget S$250 in the fixture is deliberately not evidence of actual spending or savings.

Follow-ups offline today:

| Input | Actual |
| --- | --- |
| Break that down by month. | Generic unsupported clarification, no inherited query |
| Exclude repairs. | Generic unsupported clarification, no inherited query |
| Show those transactions. | Incorrect standalone answer: zero rows for descriptions mentioning “those”, current month |

**115 existing focused `queryChecks` passed** via the temporary harness. No broad smoke/build/backend suite was run for this documentation-only stage. These checks do not prove the new capabilities work.

## Live interpretation, exactly two requests

Existing local backend env was used without alteration; no listener on 8787, no server started. Temporary `/private/tmp/tallyai-stage1-live.mjs` called production `handleIntent` and revalidated successful output with the same shared validator used by the browser. These are real provider calls through server logic, **not actual browser/HTTP endpoint tests**. No ledger rows or raw provider output printed. SDK retries remain disabled.

1. Merchant breakdown question: handler **502**, `invalid_intent`, safe diagnostic `intent_bad_field`, field **query.groupBy**; 2603 ms. Rejected model output was not exposed. No full answer/calculation succeeded. This establishes a validation boundary mismatch for an unsupported grouping request, not evidence that the model is too small.
2. Savings question with only S$5000 and six months: handler **200**, second validation passed, type `clarify`; 1570 ms. Accepted question: “What is your current entertainment spending or budget?” This is incomplete clarification: a budget is not actual spending, and current savings/planned contributions also matter.

No further paid requests in Stage 1. Live success at clarification is not successful scenario calculation or UI verification. Production model/configuration was not inspected or changed.

## Recommended smallest design

**A. Extend the existing structured query pipeline, recommended.** Add a bounded breakdown operation, deterministic relative periods, a small reviewable inclusion scope, and narrowly typed follow-up amendments. Add a separate temporary savings-scenario payload/calculator within the same validated intent boundary; do not misuse category-budget projection. Keep all result figures local.

**B. Small read-only tool loop, not recommended for this session.** It could sequence a filter and grouping, but adds tool schemas, loop limits, execution routing, error handling and more latency/requests while the missing matcher, calculations, evidence and user inputs still need implementation. No capability here requires autonomous multi-step model execution.

Implementation constraints:

- Add `breakdown` with category/month grouping and a grand total over **all matching rows**. Never obtain the total by summing a preview or repurpose highest semantics. Reuse cents/group primitives; evidence must partition consistently and recombine to the total.
- Resolve bounded last-N calendar dates and year-to-date in code from Singapore today; last90 means today−89 through today. Preserve explicit ranges and current matching-elapsed comparison rules.
- Keep literal description matching explicit. No claim of merchant identity/aliases. If a name could include distinct purchases, offer a complete, reviewable “all descriptions mentioning …” rule.
- For related spending, propose a bounded OR-list of inclusion clauses (real category IDs and/or literal description terms), with explicit exclusions. Show the complete scope and require approval before presenting a concept total. Plain fuel requires confirmation. Use the same predicate in execution, evidence and stale detection; deduplicate overlapping matches by ledger row identity.
- Store one last accepted **read query** locally, not the whole transcript. Retain its date scope, filters, approved concept scope and evidence fingerprint. A follow-up applies an allowlisted amendment or asks clarification; never reinterpret “those” as a description. Send only a validated bounded query context if needed, no rows/IDs/totals. Independent new questions replace context. New scope approval and stale context must be explicit.
- Historical answer figures stay frozen. Relevant ledger edits/additions/deletions invalidate the answer and its follow-up context; require refresh/resubmission before treating it as current. Query completion must use a current ledger snapshot or be marked stale if data changed while awaiting interpretation.
- Savings inputs: target, already saved, positive integer contribution count remaining, planned monthly contribution **outside** the proposed reduction, chosen real category and accepted monthly spending baseline/method. Ask missing values instead of assuming zero; use cents, ceil fractional required contributions to a cent and explain rounding. Additional cut is nonnegative; report insufficient category spending. Distinguish manually assumed baseline from a ledger-derived baseline, with evidence only for the latter. Temporary session state only, no ledger/budget writes or persistent goal.
- Offline path uses the same calculations/context or states its limitation. Keep offline labels. Unsupported combinations clarify; do not silently drop exclusions, categories, periods or scenario inputs. Existing confirmed actions remain isolated and unchanged.

## Remaining session: ordered stages and gates

Allow up to 25 minutes for this audit, then **210 minutes implementation/verification + 5 minutes buffer** within the four-hour session. Estimates are budgets, not promises. Each editing stage needs explicit approval; this document starts none.

| Stage | Minutes | Concrete acceptance gate |
| --- | ---: | --- |
| 2. Merchant totals and full category/month breakdowns | 50 | Extend shared schema, server/client validators, planner, engine, offline interpretation and compact answer UI together. Exact 90-date boundary; 6006 cents; three category groups; three evidence rows; category and month grouping; alternate merchant/custom categories; empty result; overlapping names honestly labelled; totals not truncated. |
| 3. Focused follow-ups | 40 | Canonical last-read context; breakdown by month and show sources retain exact original scope. Missing/stale context clarifies. Exclusions unsupported until Stage 4 must clarify. Offline “those” regression fixed. No single-word choices that lose context. |
| 4. Approved related-spending scopes | 45 | Reviewable inclusion/exclusion clauses and multi-category support; car fixture totals 30000 cents only after approval; exclude repairs gives 15000; three evidence rows before exclusion, two after; MRT/health insurance/prior year excluded; overlapping clauses do not double-count; edits invalidate context. |
| 5. Temporary savings scenarios | 45 | Ask required inputs; oracle 3000/500/200/50 dollars; insufficient S$150 baseline reports S$50 shortfall; budget never substituted for spending/savings; zero/negative remainder, fractional cents and missing values handled; assumptions visible; no persistent writes. |
| 6. Integration and handoff | 30 | Focused fixtures plus build, smoke, backend and diff checks; actual laptop/390px browser answers, all-source evidence, stale context, offline failures and action confirmations. Any live calls require a new explicit bounded allowance. Report gaps rather than claim completion. |

Kill switch: if scope matching/evidence cannot use one shared predicate, or a stage cannot pass its acceptance gate in its budget, stop that stage and report. Do not paper over it with prompt tuning or begin a tool-loop rewrite. Reserve the final 30 minutes for verification; unfinished scenarios are reported as unfinished rather than rushed into release.

## Exact next prompt scope and recovery

Stage 2 only: implement general description-filtered totals with **complete category/month breakdowns**, deterministic last-N-days/year-to-date periods, compatible evidence and honest offline behaviour. Retain current scalar category filters initially. Do not implement related-concept matching, conversational amendments or savings in that prompt. Use the fixture/oracle above plus alternate descriptions, custom categories, date boundaries, empty results and >5 matching rows. Inspect actual browser at laptop/390px. Stop for review, no commit/push/deploy unless separately authorised.

At each future stage, record current HEAD, status and a scoped diff before editing. Preserve this audit and all pre-existing work. Do not reset/stash/checkout over unrelated edits. Keep disposable scripts outside tracked application code. If aborting an uncommitted stage, reverse only its verified hunks after checking the current diff; if changes cannot be separated safely, leave them and report. No existing storage-key/schema migration is required by this proposal.

Unresolved design choices for later approval: which proposed concept clauses the user accepts; whether savings baseline is explicit or a confirmed calculation over specified complete months; the user-provided contribution count (do not guess first payment timing from “six months”); limits on clause counts and last-N ranges. These need no invented defaults to complete Stage 2.

Explicitly deferred: original receipt-versus-edited-total history, merchant identity/alias persistence, automatic semantic classification, embeddings/vector database, persistent savings goals, autonomous agents/tools, investment or guaranteed forecasting advice, accounts/authentication/Supabase, roasts, wallpapers, production configuration and publication.

## Stage 2 implementation and verification, 19 October 2026

Stage 2 started from `wallpaper-redesign`, HEAD `6f912c81a6207c5157d20c6d0d0c5e5bff88c133`, with 22 modified tracked files and three untracked files. Those category/sample, shared Home WeekBars and planning changes were intentional and preserved. Stage 1 above remains the historical audit, not a description of the newly extended contract. No Stage 3 work, commits, pushes, deployment, dependency, model, storage-key, roast or wallpaper changes in this stage.

### Implemented scope

- `queryContract.js`: `breakdown` operation, with exactly one `groupBy` of `category` or `month`; existing scalar category, literal description, amount and day filters still combine through `rowMatches`. The strict provider schema and shared server/client validator include the same fields. Normalized queries validate again without losing `dayCount`, filters or grouping; supplied derived cents are recomputed rather than trusted.
- New periods: `last_days` with integer `dayCount` **1 to 3660**, and `year` for January 1 through supplied Singapore today. Other periods require a null/absent day count. Invalid relative combinations clarify instead of defaulting to all time. Explicit inclusive ranges remain supported, future ends capped today. `queryDates.js` performs UTC date-only arithmetic, independent of host timezone/DST; it does not change the chart helpers or comparison semantics.
- `queryEngine.js`: filter the entire ledger first; calculate integer-cent grand total and count; partition every matched row exactly once. Category groups sort alphabetically by label, then ID; month groups sort chronologically using year-inclusive keys/labels. Missing category references get explicit unknown/uncategorised groups and remain in the total. No top-N truncation. Ledger scope remains **SGD-only**, with no merchant-identity or alias system.
- `BreakdownEvidence.jsx`, AskView and App: show every subtotal/count, existing collapsed full-result evidence and collapsed group evidence. Display the literal description rule, resolved dates and recorded-spending limitation. Snapshots remain read-only and frozen; full candidate scopes mark relevant additions, edits, deletions, category changes and regrouping stale.
- Offline: straightforward category/month breakdowns and relative dates use the same engine. Quoted description terms are protected from grouping/date grammar. Unsupported grouping, grouped comparisons/averages or malformed periods clarify. Referential requests such as “Show those transactions this month” clarify without a model call, and Edit original question restores the complete original text. There is no conversation memory.

### Independently specified expected versus actual results

Fixed Singapore reference date: `2026-10-19`. Amazon fixture is the Stage 1 five-row fixture above.

| Case | Independent expected result | Actual |
| --- | --- | --- |
| Amazon last 90 dates | July 22 through October 19 inclusive; 6006 cents, 3 rows | Exact match |
| Complete category breakdown | Books 2002, Household 3003, Shopping 1001 cents; count 1 each | Exact match, all three group evidence lists partition a,b,c |
| Complete monthly breakdown | 2026-07: 1001, 2026-09: 2002, 2026-10: 3003 cents | Exact match, chronological, year shown |
| Optional Books filter with Amazon description | 2002 cents, only b | Exact match |
| Alternate Acme filter with custom Household category | 1234 cents in isolated regression fixture | Exact match; other Hardware description excluded |
| Same month in different years | October 2025: 100 cents; October 2026: 200 cents | Separate groups, exact match |
| Missing/deleted category IDs and null category | Add 101 and 2 cents to original 6006 = 6109 cents | Exact match; no spending disappears |
| More than ten groups | 15 groups, 15 rows, 1500 cents | Complete, no truncation |
| Leap/non-leap last 3 dates ending March 1 | 2024-02-28..2024-03-01; 2025-02-27..2025-03-01 | Exact match |
| Empty description match | 0 cents, 0 rows/groups, no misleading evidence control | Exact match, automated and browser |
| Stale evidence | Relevant add/delete/amount/description/date/category edits invalidate; unrelated merchant does not | Pass; historical figures stay frozen |
| Existing total and comparison | October total 7007 cents; Amazon October/September matching elapsed totals 3003/2002 | Exact match |

### Live interpretation: exactly three paid requests, no retries

All three originated in the actual App on isolated `http://127.0.0.1:5200`, with fictional local storage and a fixed date. An isolated HTTP test wrapper on 8789 called the real shared `handleIntent` and provider, with a hard three-call cap. The browser performed its normal second validation and local execution. Existing frontend 5185 and backend 8787 were left running untouched. Existing local model remained `gpt-4.1-mini`; env files and credentials were not changed or displayed. No ledger rows were sent to the model.

1. “How much did I pay Amazon over the last90days, and what categories did those purchases fall into?”: **HTTP 502**, `invalid_intent`, safe diagnostic `intent_bad_field`, field `query.groupBy`, 3129 ms. Rejected provider output was neither printed nor retained. The exact inconsistent operation/group combination is unknown. Browser fallback was honestly labelled “Answered offline. AI interpretation failed validation.” Its locally calculated 6006 cents/three rows/all category groups were correct. Schema field descriptions and instructions were then strengthened to distinguish a complete breakdown from a total/winner and require category/month grouping.
2. “Break down all descriptions mentioning Acme Hardware by month this year.”: **HTTP 200**, 1698 ms, live `analyze`, `breakdown/month/year`, description retained. Client validation and browser execution passed: **S$6.66**, three rows, January S$1.11, September S$2.22, October S$3.33; prior-year S$5 excluded. Full and September-group evidence inspected.
3. “Give me a complete category breakdown of descriptions mentioning Amazon over the last 90 days.”: **HTTP 200**, 1889 ms, live `analyze`, `breakdown/category/last_days`, dayCount 90, description retained. Client validation and browser execution passed: **S$60.06**, three rows and all expected category subtotals. Full and Books-group evidence inspected.

Allowance exhausted, no further paid calls. The original compound wording was **not retested live** after the instruction adjustment; the explicit paraphrase passed. Final small unsupported-combination/clarification guard refinements were tested deterministically, without another paid call. These samples demonstrate successful paths, not guaranteed interpretation accuracy for arbitrary wording.

### Checks and browser results

- `npm run build`: passed.
- `npm run smoke`: **1404/1404** passed, including **102 new focused breakdown checks**. The preceding category-stage baseline was 1302; it was not weakened to retain a count.
- `cd backend && npm test`: **28/28 provider checks + 107/107 node tests** passed (three added Stage 2 handler/schema tests).
- Focused breakdown suite under `TZ=UTC`, `TZ=America/New_York`, `TZ=Pacific/Auckland`: **102/102 each**. No extra paid calls.
- `git diff --check`: passed.
- Actual browser: **1440 × 900** and **390 × 844**, complete live category/month answers, full and group evidence, keyboard Enter expansion with visible focus, no horizontal page overflow, empty fallback and referential clarification/Edit original question.
- Browser stale check: edit fictional October Amazon S$30.03 to S$31.03. Both previous Amazon answers become out of date but stay **S$60.06**; unrelated live Acme **S$6.66** answer remains current. No user transactions or preferences involved.
- Intentional connection fallback was tested only after stopping the isolated backend: empty result displays S$0.00 and the connection-failure offline notice. This is not a live-model success.

Screenshots, fictional data only:

- `/private/tmp/tallyai-stage2-category-laptop.png`
- `/private/tmp/tallyai-stage2-category-evidence-laptop.png`
- `/private/tmp/tallyai-stage2-category-evidence-phone.png`
- `/private/tmp/tallyai-stage2-category-group-phone.png`
- `/private/tmp/tallyai-stage2-month-laptop.png`
- `/private/tmp/tallyai-stage2-month-phone.png`
- `/private/tmp/tallyai-stage2-empty-laptop.png`
- `/private/tmp/tallyai-stage2-empty-phone.png`
- `/private/tmp/tallyai-stage2-stale-phone.png`

### Remaining limits, recovery and next gate

No verified merchant identities/aliases, multi-category selection, simultaneous category-plus-month nesting, grouped averages/comparisons, semantic related-spending scope, exclusions, savings scenarios or follow-up memory. Unsupported forms clarify; offline grammar deliberately covers fewer paraphrases than the model. Large answers show all groups and use the existing page/thread scrolling; no new pagination or chart was added. No physical-device check or production/API deployment in this stage. The existing 8787 backend process predates this contract change and must reload/restart before it can interpret new intents for manual testing; it was not stopped because this task permits stopping only servers started here.

Recovery snapshots: `/private/tmp/tallyai-stage2-start.patch` and `/private/tmp/tallyai-stage2-start-files/`. Task-only recovery diff: `/private/tmp/tallyai-stage2-only.patch`. Review current hunks and run `git apply --reverse --check` before considering a reversal; do not reset/stash or overwrite the category/sample, Home chart or pre-existing plan changes. If later changes overlap, leave them intact and resolve the specific hunks manually.

Recommended next prompt: Stage 3 only, narrowly typed read-query follow-ups with explicit last-query scope, missing/stale-context clarification, “break that down by month” and “show those transactions” retaining the complete original scope. Do not begin concept OR/exclusion scopes or savings scenarios until their separate acceptance gate. No Stage 3 implementation started here.

Stage 2 cleanup confirmed: only the marked fictional storage on origin 5200 was removed; the test tab closed and viewport override reset. Own servers 5200/8789 stopped. Original process IDs on 5185/8787 remain unchanged. Final branch/HEAD unchanged, 27 modified tracked files and six untracked files. No unexpected changes outside the 16 Stage 2 paths; earlier Home/chart and category/sample files remain intact.

## Stage 2 exact-question verification closure, 19 October 2026

The remaining live verification gap was closed in a separate bounded retest. Port 8787 was confirmed as repository backend PID 22223 (`backend/src/server.js`, repository cwd, existing `backend/.env`). It was restarted as PID 29691, preserving exactly `http://127.0.0.1:5185,http://localhost:5185` as allowed origins. Existing frontend PID 25179 on 5185 and its storage were untouched. Health returned HTTP 200. Model remained `gpt-4.1-mini`; credentials and configuration files were not changed or exposed. Backend 8787 is left running for manual testing.

Exact submitted question, not a paraphrase:

> What is the total amount I've paid to Amazon over the last90days, and what categories did those purchases fall into?

Actual browser App, isolated fictional five-row Stage 2 fixture, fixed Singapore reference date `2026-10-19`. Temporary frontend 5200 used a Vite proxy to the normal restarted backend 8787, preserving its CORS configuration. **One paid interpretation request**, SDK `maxRetries: 0`; a test-only browser cap prevented a second request. No mocks and no offline fallback.

- HTTP **200**, no error diagnostic.
- Shared backend validation and normal browser second validation passed.
- Accepted intent: `analyze`, operation `breakdown`, groupBy `category`, period `last_days`, dayCount **90**, description **Amazon**, category null.
- Local date resolution: **2026-07-22 through 2026-10-19 inclusive**.
- Local total **S$60.06**, **three** transactions.
- Groups: Books **S$20.02**, Household **S$30.03**, Shopping **S$10.01**, one row each.
- Expanded full-result and all three group evidence controls using Enter. Exact sources: July 22 Shopping S$10.01, September 1 Books S$20.02, October 18 Household S$30.03, each description Amazon. July 21 and the other merchant were excluded.
- Browser source `model`, HTTP status 200, endpoint `/api/assistant/intent` proxied to 8787. No “Answered offline” notice.
- Screenshot: `/private/tmp/tallyai-stage2-exact-retest-laptop.png`.

No application repair was necessary, so no new application regression tests or broad suites were run for this verification-only step. `git diff --check` passed. Only this progress note changes in the repository; all application code, prior dirty work, expenses and preferences are preserved. Disposable test storage on 5200 was removed and its temporary frontend stopped. The replacement normal backend and original frontend remain available. No second paid request, commit, push, deployment or Stage 3 work.

This closes the specific live-question gap, not a guarantee of deterministic interpretation across all wording/generations. The earlier discarded rejection's exact inconsistent values remain unknown; no stronger causal claim is made about it.

## Stage 3: focused session follow-ups, 19 October 2026

Started on `wallpaper-redesign`, HEAD `6f912c81a6207c5157d20c6d0d0c5e5bff88c133`, with **27 modified tracked files and six untracked files**. The category/sample, 80% threshold, Home chart, Stage 2 implementation and this existing plan were preserved. Stage 2 was not rebuilt. No schema, provider prompt, model, dependency, account, storage-key, roast or wallpaper changes in this stage.

### Smallest implementation and architecture

`src/lib/assistantFollowup.js` adds a closed deterministic amendment parser, query-context capture, follow-up resolver and request-generation session controller. The requested follow-ups require no additional model interpretation: application code already knows the previous validated query. Independent questions keep the existing OpenAI intent path and both existing validators. The backend contract remains unchanged. No ledger, prior query or conversation history is added to provider inputs.

The session retains **one** canonical validated query, resolved date range, Singapore reference date, answer number and immutable answer/evidence reference. It exists in App memory, survives tab changes and is discarded on reload/unmount or Clear chat. Greetings/help, pending or unsupported clarifications and failed requests do not replace the valid financial context. An independent successful financial question replaces the entire canonical query, not a merge with old filters.

`src/App.jsx` resolves follow-ups before the network path and executes amended queries through the existing `validateQuery`/`executeQuery` pipeline. Current ledger refs avoid answering from a stale render after interpretation completes. `assistantClient.js` accepts an AbortSignal. A monotonically increasing request generation invalidates older responses even if a transport ignores cancellation. New submissions supersede pending interpretations; Stop request stops waiting; Clear chat aborts pending work and removes chat/context without changing financial data. Confirmation, undo and actual mutation handlers remain intact. A stop cannot guarantee cancellation of an OpenAI call already running on the server.

### Inheritance and supported boundaries

- **Show those transactions:** read-only historical evidence from the referenced calculation, including only winning rows for largest/highest/latest. This evidence view does not replace the calculation context. It never attaches a new current evidence set to an old displayed figure. It clearly labels original snapshots and warns after relevant changes. Comparison/day-type answers with multiple possible evidence sets clarify instead of merging them.
- **Break that down by month/category:** change only operation/grouping on totals, counts, lists or complete breakdowns. Keep description, real category ID, amount and day filters. Winner, average, comparison and projection regrouping clarifies instead of silently changing the statistic.
- **What/how about last month:** change only the supported period, using the current Singapore date for the new period. Previous month means its entire calendar month, not an implicit comparison or matching-elapsed month-to-date. The requested analysis remains unchanged where its validator permits it. Other supported period phrases include previous/current week, current month/year, today and yesterday.
- **Only purchases over/under/at least/at most an amount:** apply a validated cent-exact threshold while retaining other fields. A same-direction tighter bound is compatible; a broader condition or a condition needing both lower and upper bounds clarifies. Over remains strict; at least includes the exact boundary. Amount amendments to winner answers clarify whether the person means winners or candidates.
- Except for an explicit period change, the **reference date stays frozen** across the chain. The original canonical period is retained rather than converted indiscriminately to a fixed range, preserving all-time history/average semantics when earlier records are added. Actual resolved dates are always shown.
- New calculations use current recorded rows. Old messages and snapshot views retain their historical figures. Relevant additions/edits/deletions and budget/category changes disclose staleness; a changed-then-undone ledger does not silently erase the warning.
- Unknown referential wording, missing context, arbitrary earlier-answer numbers, exclusions, multi-category/semantic scopes, nested grouping and conflicting/incompatible amendments clarify. The original follow-up is available through Edit original question. No unrestricted memory, database or runtime semantic search was added.

### Honest offline handling

Built-in follow-ups are labelled `builtin` and described as calculated locally; they do not show a failed-model notice because no request was attempted. Actual failures still use the existing safe offline reason and matcher. With no previous financial context, a successfully validated/executed initial offline query can establish context. If a later failed provider request displays a competing offline financial answer, the old valid context is preserved but subsequent reference-only follow-ups clarify because the referent is ambiguous. A complete successful interpretation or Clear chat resolves that state. This conservative restriction avoids choosing between the fallback and the previously saved context silently.

### Fictional checks: expected versus actual

Fixed reference date `2026-10-19`, original Stage 2 Amazon boundary fixture plus independent custom-category/tie rows in automated checks. Expected cents/IDs were specified independently.

| Case | Expected | Actual |
| --- | --- | --- |
| Amazon total/category breakdown → monthly breakdown | 6006 cents, a/b/c, July 1001 / September 2002 / October 3003; original 90-date range | Exact match; automated and actual browser |
| Category/month breakdown → supporting transactions | Same three original source snapshots, no other merchant or July 21 row | Exact match; keyboard expansion inspected |
| New independent October category question | 7007 cents, two October rows, no Amazon description filter or inherited July range | Exact match through live model/browser |
| Amount over S$20 → previous month | Full September 1–30; 2002 cents, Books row only; no inferred comparison | Exact match; automated and browser |
| Strict/inclusive S$40.04 threshold | Over: no rows; at least: both tied S$40.04 rows | Exact match |
| Tighten lower/upper threshold | Compatible subset retained, cent-exact inclusive boundary; looser/opposite bounds clarify | Pass |
| Greeting between answer and regrouping | Merchant and range remain unchanged; no paid greeting/follow-up calls | Pass in actual browser |
| No context / chat clear / reload | Clarification, no full-ledger total or misleading zero | Pass in actual browser and automated checks |
| Largest/highest evidence | Only winning rows, including ties; incompatible regrouping clarifies | Pass in automated checks |
| Edit September 20.02 to 21.02 | Historical source view still 20.02 with stale warning; refreshed breakdown 21.02 and change disclosure | Exact match in actual browser |
| Midnight between amendments | Original relative reference date/range remains fixed unless explicitly changed | Pass |
| All-time newly recorded earlier Amazon row | Original 6906 + 100 = 7006 cents, including newly recorded earlier history | Exact match |
| Failed request / overlapping and cancelled responses | Valid context retained; ambiguous competing fallback clarifies; older/cleared responses cannot update context | Automated and mock-transport browser checks passed |
| Independent add/delete/undo wording | Remains on its existing confirmation/action path, not inherited as a read query | Pass, including a description containing “without” |

### Live API and browser evidence

**Exactly two paid interpretation requests**, automatic provider retries remain disabled (`maxRetries: 0`), model unchanged (`gpt-4.1-mini`). Both were actual App → local Vite proxy → normal backend 8787 → OpenAI, followed by browser validation and local calculation. No rejected or raw provider output was printed or retained.

1. Exact Stage 2 compound question: “What is the total amount I've paid to Amazon over the last90days, and what categories did those purchases fall into?” **HTTP 200**, `analyze / breakdown / category / last_days`, dayCount 90, description Amazon, category null. Browser calculated **S$60.06**, three transactions and all three categories. No offline notice.
2. Independent question: “Show my spending by category this month.” **HTTP 200**, `analyze / breakdown / category / month`, description null, category null, dayCount null. Browser calculated **S$70.07**, two transactions, Household S$30.03 and Shopping S$40.04. No inherited Amazon filter or offline notice.

Between/after these requests, the monthly breakdown, source list, greeting, category regrouping, amount condition, last-month change, stale snapshot/refreshed calculation, Clear chat and no-context cases were **built-in local behaviours**, not additional model requests. No third paid request was used and no live failures occurred.

At **1440×900** and **390×844**, inspected the live-started category → month → source chain, figures, explicit date ranges, answer references, collapsed/read-only evidence and keyboard expansion/focus. No horizontal page overflow was observed. Long output uses the existing page/conversation scrolling. An initial no-context clarification and the independent question were also inspected.

A separate clearly labelled **mock transport mode**, making no OpenAI requests, exercised actual App wiring for: connection failure/offline labels; initial offline context followed by a local amendment; ambiguous competing fallback; a slow old response arriving after a newer query; Stop request; Clear chat while pending; and reload. The newer scope remained the October total S$70.07, not the older Amazon S$30.03 query. Cleared late responses did not repopulate chat. Mock results are not live-model successes or real provider-outage verification.

Screenshots, fictional data only:

- `/private/tmp/tallyai-stage3-no-context-laptop.png`
- `/private/tmp/tallyai-stage3-month-laptop.png`
- `/private/tmp/tallyai-stage3-evidence-laptop.png`
- `/private/tmp/tallyai-stage3-month-phone.png`
- `/private/tmp/tallyai-stage3-evidence-phone.png`
- `/private/tmp/tallyai-stage3-independent-phone.png`
- `/private/tmp/tallyai-stage3-period-amount-phone.png`
- `/private/tmp/tallyai-stage3-stale-snapshot-phone.png`
- `/private/tmp/tallyai-stage3-refreshed-phone.png`
- `/private/tmp/tallyai-stage3-cleared-phone.png`

### Final checks, preservation and recovery

- Frontend `npm run build`: passed.
- Full `npm run smoke`: **1506/1506**, including **102 new Stage 3 checks** over the prior 1404-check baseline. Existing Stage 2/category/sample checks remain passing.
- Backend `npm test`: **28/28 provider checks + 107/107 node tests**, passed. No backend schema/model changes were needed, so no additional Stage 3 server handler path was introduced.
- `git diff --check`: passed.
- No physical-phone, microphone, receipt, production or deployment verification in this stage.

Files specifically changed: `src/lib/assistantFollowup.js` (new), `src/lib/assistantClient.js`, `src/App.jsx`, `src/views/AskView.jsx`, `src/styles/app.css` (Ask controls only), `scripts/followup-checks.jsx` (new), `scripts/smoke.jsx`, and this planning document.

Port 8787 had no listener when browser testing began. The repository backend was started with the existing env file, original allowed origins `http://127.0.0.1:5185,http://localhost:5185`, unchanged model and current source. No stale backend was used. To keep manual testing available independently of the temporary tool session, that same normal backend was then left in a detached process, **PID 36233**. Health returned HTTP 200 and both original-origin preflights returned 204 with exact allowed origins. Frontend **PID 25179 on 5185** was never stopped/restarted and its storage was not inspected or cleared. Environment files and secrets were untouched. The temporary frontend on 5200 was stopped, its tab closed/viewport reset, and only marked fictional Stage 3 storage was removed.

Starting recovery: `/private/tmp/tallyai-stage3-start.patch`, `/private/tmp/tallyai-stage3-start-files/`. Task-only recovery: `/private/tmp/tallyai-stage3-only.patch`. Before any reversal, compare current changes and run `git apply --reverse --check` against that task-only patch; do not reset/stash or reverse the entire pre-existing diff. If later edits overlap, resolve only the specific Stage 3 hunks manually. No recovery action was applied.

Final branch/HEAD unchanged. No commit, push, deployment, dependency, savings, related-concept scope or other next-stage work. Recommended next prompt, after review: Stage 4 only, explicit reviewable related-spending inclusion scopes with separate approval/exclusion semantics and matching evidence. Keep savings and merchant-identity normalisation deferred until their own gates. Stage 3 still supports only the documented bounded grammar and latest calculation, not arbitrary conversational references.

## Stage 4 design, before implementation

Extend the existing query with nullable `spendingScope`: a review label and four bounded lists (`includeCategories`, `includeTerms`, `excludeCategories`, `excludeTerms`). Include rules combine with OR. Existing date, amount, day, scalar category and description filters intersect with that union. Any exclusion wins. Category IDs must exist. Terms use case-insensitive literal substring matching after trimming/collapsing whitespace on both terms and descriptions, without stemming, aliases or semantic completeness. Up to eight items per list, terms 1–80 characters, label 1–80 characters; at least one inclusion required. Deduplicate matching transactions by ID. A model scope always becomes `propose_scope`, never an approved read.

The local review shows resolved dates, every rule, complete candidate count and a bounded row preview, not a final aggregate. Editing, cancelling and confirming are built-in interactions. A matching-set/category-label fingerprint is checked again on confirmation; changed candidates require a refreshed review. Only a local confirmation permits scoped calculation. Approved rules and evidence are cloned into the answer and latest session context. Compatible Stage 3 amendments retain approved rules; an exclusion amendment requires another review. No ledger descriptions or history are sent to the model. Unknown broad concepts without useful explicit terms should clarify rather than invent a semantic catalog.

## Roadmap Step3A, recognised unsupported handling (19 October 2026)

This is roadmap Step3A, not the earlier completed Stage 3 follow-up implementation. Started on the published `6cf9345` checkpoint with a clean tree. Implementation commit: `4eb37e5`. No publication, dependencies, model change, new financial operation, storage migration or roast work.

The shared query validator now emits explicit semantic limitation reasons only after structural/type/date/filter validation. The intent validator converts an allowlisted limitation into a validated `clarify` intent, without an executable query. Reasons cover multiple category filters, category comparisons, missing scope rules, incomplete category coverage in scope rules, unsupported scoped operations, arbitrary comparison periods and multipart category-percentage requests. The clarification explains the limitation, asks for a supported next scope, and retains the original question, including its dates and filters. It uses the existing Edit original question control. Unknown fields, invalid real category IDs, malformed amounts/dates/rules and unknown reason codes remain invalid; provider/auth/network errors retain their original error/fallback paths.

`category_terms` is metadata for unmapped category words, not an executable category-ID list. Bounded string metadata on an explicitly recognised multi-category/related/multipart USER request can produce a clarification, even if the model puts IDs or unmapped words there. It never executes or repairs those filters. Invented extra category words on an ordinary single-scope request remain errors. A category comparison cannot be replaced by an approved union total. Supported existing totals, complete breakdowns, reviewed scopes and month/week comparisons still execute through the same cents/evidence engine.

Broad financial assessments now clarify locally: recorded spending against a category budget, change from a previous period, or a specific category. No overall financial-health judgement is inferred from an expense ledger. Greetings, security refusal, pure-noise help and the justified M64 expectation remain unchanged. Clarifications do not replace the canonical follow-up context.

### Checks and honest provenance

- Final build passed; smoke **1745/1745** (55 more than the published checkpoint); provider checks **28/28**; backend node tests **132/132** (21 more); diff check passed.
- New fictional regression data uses Lunches, Craft supplies and Rail fares, separate from MAIN. Exact total 3566 cents, complete three-group breakdown, supported comparison 3566 versus 111 cents, approved literal scope 3110 cents. Malformed-output and provider failure tests remain failures, not successful clarifications. Round-trip, quoted-description false positives and context preservation are checked.
- MAIN replay before: **69/76 questions, 75/82 turns**, five offline fallbacks. After code but before refreshing recordings: **70/76, 76/82**, with five old HTTP502 responses still failing; the one-point improvement is built-in broad-assessment handling.
- Exactly **seven paid calls**, retries disabled: five intended MAIN network cases once, plus two diagnostic browser paraphrases. M54 is built-in, zero paid calls. Calls are in `scripts/eval/calls.log`.
- Fresh MAIN subset: M46 HTTP200 clarification (`scope_rules_required`), M50 HTTP200 valid scope proposal, M65 HTTP200 clarification (`multipart_percentage_unsupported`), M66/M68 HTTP502 `query.category_terms`. M54 uses built-in financial-assessment clarification. These requests preceded the final category-word metadata guard; no failed case was repeated.
- A diagnostic total returned HTTP200/analyze; the browser was subsequently reloaded during test-fixture changes before a retained live-result screenshot. The supported browser calculation was therefore verified with explicitly labelled mock interpretation, not claimed as fresh live financial evidence. A new category-comparison paraphrase returned HTTP502/category_terms before the final metadata guard. The final guard is verified by deterministic server/client tests and mocked browser checks, not by another model attempt.
- Final MAIN replay: **72/76 questions (94.7%), 78/82 turns (95.1%)**, two recorded offline fallbacks. Only the five intended MAIN recordings were refreshed; all other 69 stored keys remain equal to the starting file. M54's old recording remains stored but is bypassed by built-in handling. No expectation changed, including M64. HOLDOUT was neither inspected nor run.
- Remaining MAIN failures: **M46** (useful clarification passes the handling goal but its unchanged oracle requires proposal/answer), **M48.2** (deferred free-form exclusion), **M66/M68** (saved HTTP502 responses from before the final guard). Do not describe the replay as wholly fresh live accuracy, final-code live proof for M66/M68, or implementation of the requested combinations.
- Browser: isolated fictional origin `127.0.0.1:5241`, laptop 1440×900 and phone 390×844. Checked unsupported clarification with full category/month/weekend/amount wording; built-in broad assessment; mock interpreted total S$35.66 with source rows; a local breakdown follow-up after both clarifications; and mocked provider timeout with explicit offline label and local fallback S$35.66. Screenshots and safe observations: `/private/tmp/tallyai-step3a/`. Source labels are documented in `docs/ASSISTANT-STEP3A-2026-10-19.md`.
- Only the task backend on 8841 was restarted after validation changes, with its paid counter retained. The user's frontend/backend were not stopped. Temporary test servers and tab were closed afterward.

Step3A automated and final-code mocked-browser handling gates pass. Final-code fresh live verification of the two original category failures remains unverified because retries were intentionally not spent. Review that limitation before accepting the gate or publishing. If accepted, the next implementation task is bounded OR filters and generalised comparisons, with explicit semantics/evidence and separate authorisation. M48.2, savings, arbitrary references and other deferred combinations remain documented. No next task started here.

## Roadmap Step3B1 design, before implementation (19 October 2026)

Baseline: clean `checkpoint/2026-10-19-wip` at `a46cfc6`; published checkpoint `6cf9345` is preserved. MAIN starting replay 74/76 questions, 80/82 turns. Step3A's separate final-code verification closed M66/M68's handling gap (see its report); old observations above remain historical.

Add optional `categories: string[]` and `descriptionTerms: string[]` to the existing query, canonical empty arrays when absent. Preserve legacy scalar category/description queries and stored replies. Each list is bounded to eight entries before deduplication, description terms 1–80 characters. Category IDs must exactly match configured IDs. Terms trim/collapse whitespace and lower-case with en-SG; duplicate normalised items collapse and canonical lists sort. No SQL, expressions, regex or inferred merchant identity. Reject malformed/oversized/unknown lists, never truncate. Reject a scalar and nonempty list of the same dimension, to avoid contradictory representations. Validation accepts its own canonical output without losing filters.

OR within categories, OR within description terms, AND between those dimensions and scalar/date/day/amount restrictions. Explicit categories plus explicit literal description terms therefore intersect. Share literal/category predicates with approved spending scopes, whose inclusion lists intentionally retain their separate cross-dimension union/exclusion semantics. Deduplicate selected rows by transaction ID whenever OR lists or reviewed scopes are active. All execution, evidence and stale detection use the same matcher.

Explicit unions support totals, counts, existing average denominators, transaction lists and complete category/month breakdowns. Existing winner/latest/day-type operations may retain list filters because they rank or partition the already-filtered candidate set; verify full basis/winner evidence. Comparisons with OR lists clarify in this bounded stage, as do comparisons between different named categories. Existing scalar matching-elapsed comparisons remain supported. Projection with OR lists clarifies because a union has no single category budget. Generalised comparisons, top-N, multipart plans, savings and new exclusions remain out of scope.

The model schema/instructions distinguish explicit union filters from a broad related-spending proposal. Mentioned categories and literal OR terms must remain represented; incomplete coverage or unresolved category/description coordination clarifies without calculating. A comparison must never become a union. Ambiguous bare coordination is not an automatic OR; exact configured category vocabulary or explicit literal-description wording establishes the dimension. Offline interpretation supports a bounded closed grammar and clarifies unconsumed coordination. A model-generated spendingScope still requires review and local approval before calculation, even alongside explicit lists.

Expose every list member and literal-substring meaning in answer/filter disclosure. Preserve canonical lists in local follow-ups, evidence and snapshots. Category-label/removal changes invalidate historical evidence even for an empty included category; invalid inherited categories must block refreshed follow-ups. Snapshot transaction follow-ups retain original rows and stale notices. Independent questions start fresh scope.

### Step3B1 local result

Implemented explicit categories/descriptionTerms unions through shared schema/validation, matching, disclosure, offline grammar, reviewed-scope intersections and evidence. Legacy scalar replies remain compatible. All requested list members must be represented; malformed or oversized lists remain errors. Named-category comparisons and OR projection/compare operations clarify. Broad related concepts still require reviewed approval. No new exclusion or comparison operation.

Independent regression totals: category union 7711 cents; description union 11109; intersection 7105; inclusive last30 description union 11816; full filtered year breakdown 7812 (707 + 7105). Follow-ups preserve lists and evidence; category/description changes invalidate frozen answers, and removed categories block refreshed inherited queries.

Gates: build pass, smoke 1883/1883, provider checks 28/28, backend node tests 154/154, diff check pass. Six paid calls, retries disabled: M66 comparison and M68 combined categories once, plus four independent fictional browser cases. M68 calculates 18200 cents with all three categories. No additional request was used to improve the ambiguity model's weak original wording; a focused shared guard now produces a fixed complete-scope clarification, verified through final handler/client and saved-live browser rendering. Final guards were not followed by another fresh model call. Both original and final provenance remain explicit.

MAIN before and after: 74/76 questions, 80/82 turns, mixed-age replay. Only intended M66/M68 were attempted; only M68's envelope changed, other 73 values preserved. No expectation edits. Remaining M46 and M48.2 stay documented. Laptop/phone browser checks used isolated fictional storage; no publication or real-user storage actions. Full results and source distinctions: `docs/ASSISTANT-STEP3B1-2026-10-19.md`; safe evidence: `scripts/eval/step3b1-provenance.json`.

Recommended next separate task: generalised period/category comparisons, with explicit semantics, side-specific evidence and bounded regression cases. No next task or roast work begins here.

## Step3B2 comparison design, before implementation

Start clean at `abf5209`, checkpoint branch; MAIN replay 74/76 questions and 80/82 turns. Hard task start 2026-10-19 15:59:35 UTC, checkpoints 16:29:35 / 16:59:35 / 17:19:35, stop by 17:29:35. No new implementation after the 80-minute checkpoint.

Extend existing operation compare with one nullable `comparison` descriptor: `{kind: periods|categories, periods: [...], categories: [...]}`. Period comparisons have exactly two period descriptors and no category-side IDs; shared existing scalar/OR/description/day/amount filters apply identically to both. Root period is all (neutral), dates/dayCount null. Category comparisons have exactly two distinct configured category IDs and no period-side descriptors; root period and shared description/day/amount filters apply to both, root category/categories empty. Period descriptors reuse current period names plus named_month with YYYY-MM; range uses explicit inclusive dates. Strict shape/type/list/date checks precede semantic clarification. Old compare requests with no descriptor retain their existing current/previous matching-elapsed month/week behaviour through the same executor.

Completed named months resolve to full calendar months in code. Unspecified named-month years use the current Singapore reference year; ambiguous cross-year wording must clarify or give explicit years. Explicit ranges stay unequal/overlapping as requested, capped at today only with explicit disclosure; entirely future sides clarify. Date-only UTC arithmetic represents Singapore calendar dates. Every side discloses resolved dates, duration, all active filters, SGD total/count and immutable evidence. Within-side ID deduplication is retained; shared rows across overlapping sides count independently and overlap is disclosed. No mixed currencies are inferred or converted.

Difference is first minus second in integer cents, with explicit larger/tie labelling. For disjoint period comparisons only, percentage change uses the chronologically earlier side as a named baseline and the later side as target; zero baseline is undefined. Overlapping/symmetric periods and category comparisons have no arbitrary percentage baseline. Empty results mean no matching recorded rows, not no real-world spending. Existing implicit comparisons preserve their earlier-period baseline and shorter-month notice.

Exactly two categories over one period, or one shared spending scope over exactly two periods, are supported. Different categories AND different periods, three sides, independent per-side operations/filters, reviewed/inferred concept comparisons, multipart and generalised comparison follow-up amendments clarify. Broad scopes still require approval for their existing supported operations. Comparison follow-ups ask which labelled side for transactions and reject ambiguous regrouping/period/amount amendments. Offline grammar supports only complete, reliably consumed named-month/ISO-range/category forms, otherwise clarifies. No financial figure comes from the model.

### Step3B2 local checkpoint: live acceptance BLOCKED

One compare descriptor now supports two periods with shared scalar/OR filters, or two configured categories over one period, through one code-calculated totals/evidence executor. Old implicit scalar comparisons preserve elapsed alignment. Full named months, explicit ranges, unequal/overlapping durations, zero baselines, category-label staleness and two-sided follow-up refusal are covered deterministically. Provider schema variants enforce mutually exclusive root/side and scalar/list representations without relaxing shared validation.

A live range paraphrase exposed a one-period total replacing a two-period answer. General comparative-arity guards now refuse that narrowing, including the legacy scalar path. Original defect and final non-paid repair verification are preserved. This does not make the failed interpretation a successful comparison.

Ten paid calls, retries disabled. First five contract failures retained; later OR case clarified unrequested category scope; one range case narrowed before repair; one June/July zero-baseline numeric comparison passed live; a three-side request safely clarified; final category paraphrase selected all-time and was blocked by the period-preservation guard. No retries or further allowance. Only one numeric comparison live pass, no final live numeric category or OR-period pass. Do not call the stage complete.

MAIN mixed replay 74/76 questions and 80/82 turns before, 71/76 and 77/82 after three intentionally refreshed HTTP502 recordings (M66/M67/M76), other 71 keys unchanged. No evaluation expectation changes; M67's old unsupported expectation remains. Gates: build pass, smoke 1964/1964, provider checks 28/28, backend 174/174, diff check pass. Passing deterministic tests do not override blocked live acceptance.

Full evidence and limits: `docs/ASSISTANT-STEP3B2-2026-10-20.md`, `scripts/eval/step3b2-provenance.json`. Follow-up task should fix bounded comparison interpretation and verify the final code live, not start multipart plans or publication. Main/public source remains 6cf9345. No roast work.

## Step3B2 interpretation repair design, before editing (20 October 2026)

Baseline clean d00aa91, published source remains 6cf9345. Retain the existing canonical compare descriptor and all strict validators/execution guards. The provider prompt currently repeats comparison instructions in the operation list, a separate section and generic defaults. In particular, “explicit two-period requests” conflicts with the legacy current/previous elapsed instruction. Category comparisons also inherit an unexplained root period field, while description OR terms can be mistaken for category sides. Prior safe diagnostics establish wrong kind/binding, duplicate root/nested categories and wrong all-time period in individual cases; discarded outputs do not establish the cause of all HTTP502s.

Repair only interpretation guidance: one decision table for period versus category versus legacy elapsed comparison, a clearly stated inactive-field convention, four concise fictional input-to-intent examples, and branch-specific schema descriptions. Emit operation then comparison discriminator before dependent period/filter fields. Keep the same closed schema variants and shared contract; no new request, normalisation or calculation capability. Root all is neutral only for explicit period sides, never a substitute for a requested category-comparison period. Description OR remains a shared literal filter, not category-side IDs. Tests will cover schema shape/order, canonical examples, round-trips, conflicts, date/filter preservation and one-sided refusal before any paid requests.

### One focused live repair cycle

The first independent batch passed populated named-month and category comparisons, but description OR current/previous month returned a well-formed explicit named-month descriptor. The unchanged executor correctly clarified because full September would replace the requested elapsed baseline. This is wrong requested-period interpretation (D), not malformed output or provider outage.

For this narrow established convention, constrain the decoding schema before generation using the existing date-hint recognizer: exactly current+previous month or week, comparative wording, no explicit full/entire/whole request, no additional named/ISO period and no configured category vocabulary containing calendar-period words. Only legacy comparison-null variants with operation compare and the identified month/week remain executable query choices. The model still chooses every category/description/day/amount filter or clarification. No returned fields are rewritten, no requested filter is inferred, no ledger is consulted, and all shared validation and date/anti-narrowing guards remain unchanged. Other questions retain the original schema. Tests include reversed periods, week, full-month, explicit-month/range, three-period and calendar-word category counterexamples. Recheck all three acceptance requests once against the restarted final backend because the provider schema-construction path changed. No third repair cycle.

### Interpretation repair gate result

The bounded repair passed three populated final-code live families: full September/July Music bench 7000/4000 cents, current Music bench/Trail gear 2600/4321, and literal OR matching-elapsed current/prior 6921/7765. Six paid calls, zero retries: first batch two numeric passes and one safe wrong-period clarification, one focused pre-generation schema repair, then all three rechecked live on final source. No validator/engine/evidence changes, post-generation normalisation, scope bypass or MAIN expectation/recording edits.

Build pass; smoke 1989/1989; provider 39/39; backend 174/174; diff check pass. Mixed-age MAIN replay remains 71/76 questions, 77/82 turns; old M66/M67/M76 HTTP502 recordings persist and M67's old unsupported oracle conflicts with new support. Three independent numeric acceptance families, not this replay score, establish this bounded gate. Existing literal OR wording with trailing named-month periods can still safely clarify, alongside documented unsupported mixed scopes/grouped/multipart/third-side/reviewed-concept comparisons. Keep the checkpoint unpublished and do not start next-stage work automatically. See the repair addendum in `docs/ASSISTANT-STEP3B2-2026-10-20.md` and `scripts/eval/step3b2-repair-provenance.json`.
