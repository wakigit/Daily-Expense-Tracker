# Step 4 acceptance, 10 November 2026

**Verdict: Step 4 is NOT accepted.** The browser blocker that stopped Step4B2 is cleared — cases A–K now pass at both viewports with real screenshots and zero paid calls — and one live defect found here was fixed and re-verified live. Acceptance is withheld for a different, pre-existing reason: the Step 4 integration commit silently regressed **M69**, a supported question that used to be answered, and the live run showed the bounded plan grammar answering only a narrow set of phrasings. Production remains `6cf9345`. Nothing was pushed, merged or deployed.

## 1. Starting state

Branch `checkpoint/2026-10-19-wip`, HEAD `6ebbcac60f6a829ef2b4b17da76bc4e2f42ef7ea`, tracked tree clean, 10 commits ahead of `main` with zero commits behind. `main` = `wallpaper-redesign` = `6cf9345`.

Two corrections to the carried-over handoff notes:

- Local `gh-pages` is `29fc463`, not `5e0e67b`. The 2026-10-19 publish gate already recorded the local Pages ref as stale; this run only confirms it and changes nothing.
- The prepared Step4B2 browser fixture and all its artifacts under `/private/tmp/tallyai-step4b2/` and `/private/tmp/tallyai-step4b2-browser/` **no longer exist**. `/private/tmp` was cleared at some point in the three weeks since 2026-10-20. The fixture was rebuilt from scratch for this run; the earlier `USER-CHECKLIST.md` and its observations are gone and were not recoverable.

No dev servers were running at start: nothing on 5185, nothing on 8787, and the backend PID 52618 named in the Step4B2 report is long gone. Every server used below was started and stopped by this task.

## 2. Browser acceptance — the blocked part, now unblocked

### How the blocker was cleared

Step4B2 failed because no browser connection could be established through the agent browser bridge. That path was not retried. Instead a headless browser was driven directly, with nothing added to the repository:

- Playwright **1.64.1** already present in the npx cache at `~/.npm/_npx/e41f203b7505f1fb/node_modules`, symlinked into a scratch driver directory outside the repo.
- That Playwright build wants `chromium_headless_shell-1248`, which is not installed. Rather than download anything, `executablePath` points at the already-cached **Chrome for Testing 153.0.8010.12** in `~/Library/Caches/ms-playwright/chromium-1243`.
- The user's own Google Chrome, its profile, tabs, history and storage were never touched. Playwright launches a throwaway user-data directory.

No repository dependency, lockfile or `package.json` entry changed.

### Isolation

| Piece | Where | Guarantee |
| --- | --- | --- |
| Fixture frontend | Vite dev server, `http://127.0.0.1:5247`, `VITE_BASE=/ VITE_ASSISTANT_URL=http://127.0.0.1:8847` | Its own origin, so its `localStorage` cannot be the 5185 development store |
| Mock adapter | `/private/tmp/tallyai-step4-accept/mock-server.mjs`, port 8847 | Outside tracked source. Clears `OPENAI_API_KEY`, replaces `globalThis.fetch` with a throwing stub, refuses every route but `/assistant/intent` and its own control routes, CORS limited to the one fixture origin |
| Interpretation | Real `backend/src/routes.js::handleIntent` with `mockPlanIntent` injected | The real handler, real shared validation, real client revalidation, real calculator; only the provider transport is substituted |
| Network | Playwright route interception | Any request outside the fixture origin and the mock is aborted. The only blocked request observed was Google Fonts |
| Storage | Seeded at document start behind a marker key | Refuses to seed an origin that already holds foreign `ww_*` data |
| Clock | `clock.setFixedTime(2027-03-10T04:00:00Z)`, timezone `Asia/Singapore` | Reference date 2027-03-10, so the 90-day boundary is reproducible |

The mock adapter reported **0 real provider calls** and 21 mock requests per viewport pass.

### Results — 26/26 at both 1440×900 and 390×844

Figures were hand-derived from the fictional ledger before the run; the ledger is the Step 4 plan fixture (`p1`–`p6`, reference date 2027-03-10), which contains no MAIN or HOLDOUT data.

| Case | What was checked in the real mounted app | Result | Screenshots |
| --- | --- | --- | --- |
| A | Plan answer: three numbered parts, `S$40.00` / `S$10.00` / **25.00%**, both parts' dates and counts, both evidence sets (`p1,p2,p3` and `p1`), visible `S$10.00 ÷ S$40.00 × 100 = 25.00%`, named operand links resolving to `#plan-1-q2` / `#plan-1-q1` | Pass | `A-share-{laptop,phone}.png` |
| A2 | Richer filter set: an amount condition disclosed on **every** part it applies to — `S$30.00` / `S$12.00` / **40.00%**, `over S$11` named in both captions | Pass | `A2-filters-{laptop,phone}.png` |
| B | Signed difference `+S$28.00`, operands named in order (`1. Total recorded spending minus 2. Transit spending`), `S$40.00 − S$12.00 = +S$28.00` | Pass | `B-difference-{laptop,phone}.png` |
| C | Literal-description share over the last 90 days: window **2026-12-11 to 2027-03-10**, `S$70.00` / `S$18.00` / **25.71%** | Pass | `C-literal-{laptop,phone}.png` |
| D | Zero denominator: both parts `S$0.00`, a visible **Unavailable** slot, the explanatory sentence, and **no** numeric percentage anywhere in the section | Pass | `D-zero-denominator-{laptop,phone}.png` |
| E | Unsupported extra component ("then forecast next year?"): whole-request clarification, no plan, no `S$` figure in the bubble | Pass | `E-unsupported-{laptop,phone}.png` |
| F | **Real ledger edit through the Add form** (a new S$1.00 Food row on 2027-03-08): answer-level "Out of date", all three parts individually stale, original `S$40.00` / `S$10.00` / `25.00%` frozen | Pass | `F-stale-{laptop,phone}.png` |
| F2 | Asking again recalculates: `S$41.00` / `S$11.00` / **26.83%**, not stale | Pass | `F2-fresh-{laptop,phone}.png` |
| G | "Show those transactions" on a plan offers exactly the three numbered part choices bound to that answer | Pass | `G-part-choices-{laptop,phone}.png` |
| G2 | Choosing the derived part shows **both** original input sets and invents no difference rows (the derived section has no evidence control) | Pass | `G2-derived-choice-{laptop,phone}.png` |
| G3 | Choosing one base part keeps its original number (`2. Food & Drinks spending`) | Pass | — |
| H | Plan → ordinary question → ordinary follow-up: evidence returns through the normal path, no plan choices inherited | Pass | `H-ordinary-followup-{laptop,phone}.png` |
| I | Stop, Clear and overlap, each with a 3.5s mock delay: Stop publishes the stopped notice and the late plan never appears; Clear empties the thread and the late plan never appears; an overlapping newer question publishes exactly one answer, the difference, and never the superseded share | Pass | `I-stop-*.png`, `I-overlap-*.png` |
| J | One-sided model-shaped response to a recognised multipart question: HTTP 200, clarification, no partial total | Pass | `J-one-sided-{laptop,phone}.png` |
| K | OR total `S$22.00`, comparison `S$40.00` vs `S$30.00`, reviewed scope still a proposal with no aggregate before approval | Pass | `K-scope-proposal-{laptop,phone}.png` |
| Malformed / timeout | HTTP 502 and HTTP 504 each fall back to a **labelled offline** clarification with no invented figure | Pass | `M-offline-{laptop,phone}.png` |
| Evidence paging | 151-row fictional dataset: `See transactions (151)`, 50 rows shown, `Show next 50 transactions (50 of 151 shown)`, then 100 rows and `(100 of 151 shown)` — the complete source count is never truncated | Pass | `EV-pagination-{laptop,phone}.png` |
| Keyboard / focus | Evidence summary is focusable, carries a visible non-`none` focus outline, and expands on **Enter**; the answer's focusable controls appear in document order with no tabindex trap | Pass | `A-evidence-open-{laptop,phone}.png` |
| Overflow / clipping | `document.scrollWidth <= clientWidth` on the plan answer and on the long paginated list at both sizes; no element inside `.plan-answer` hides overflowing content behind `overflow-x: hidden` | Pass | — |

Screenshots: **36 files** in `/private/tmp/tallyai-step4-accept/shots/`. Per-case machine-readable results: `report-laptop.json`, `report-phone.json`. **Nothing from that directory is committed, and no screenshot or receipt was staged.**

Four console errors appear per pass and all four are expected: two blocked Google Fonts requests and the two deliberate 502/504 mock modes.

### One honest caveat about these screenshots

The page labels these answers **"Model interpretation, calculated locally"**, not "Mock interpretation". That is correct app behaviour, not a defect: the browser calls its configured backend and cannot know that the backend substituted its provider transport. The `source==='mock'` label exists for in-process harnesses. **So the screenshots above are not live evidence, even though they say "model".** Live evidence is section 3 only.

## 3. Live plan interpretation

Real `backend/src/provider.js`, real key, model **gpt-4.1-mini**, `maxRetries: 0`, 10s timeout. A counting adapter at the actual provider-call boundary (`/private/tmp/tallyai-step4-accept/live-server.mjs`, port 8848, CORS to `http://127.0.0.1:5248`) enforced a hard cap and refused more than one provider call per question. Nothing was retried.

A **new** fictional student ledger was written for this, independent of MAIN, HOLDOUT and the mock plan fixture: categories Canteen Meals / Bus & MRT / Lab Supplies, rows `L1`–`L6`, reference date 2026-11-10 (the real Singapore date). The 90-day window is therefore **2026-08-13 to 2026-11-10**.

Expectations were hand-calculated and written to `live-expected.json` **before** the first call.

### First pass — four student questions, four paid calls

| # | Question (wording written for this task) | Expected (hand-calculated) | Paid | Plan shape returned | Actual |
| --- | --- | --- | ---: | --- | --- |
| LIVE-1 | `how much have i spent this month in total, and what percentage of that was canteen meals?` | S$40.00 / S$5.50 / **13.75%** | 1 | `plan`, 2 steps, `percent_of` | **Clarified.** No figure |
| LIVE-2 | `show me my total spending this month and my bus & mrt spending this month, then the difference` | S$40.00 / S$20.00 / **+S$20.00** | 1 | `plan`, 2 steps, `difference` | **Clarified.** No figure |
| LIVE-3 | `what share of my last 90 days spending was at "Popular bookstore"?` | S$58.00 / S$20.50 / **35.34%** | 1 | `plan`, 2 steps, `percent_of` | **Clarified.** No figure |
| LIVE-4 | `can i get my total this month plus my canteen meals, bus & mrt and lab supplies totals and my "Popular bookstore" total, and the percentage each one was?` | clarification — 5 totals and 4 shares exceed the 4-step / 2-derived contract | 1 | `plan`, 3 steps, two `percent_of` | **Clarified. Correct.** No figure |

Every response was HTTP 200 with the single typed reason `plan_complete_request_required`; the specific internal cause is deliberately collapsed into one clarification and is not visible in the response. The model produced a correctly shaped plan in all four cases. **Three supported questions were blocked by the app, not by the model.**

Offline diagnosis of the local recognizer (zero calls) separated two different causes, and one paid diagnostic call captured the model's raw plan.

### Defect found: one literal-description term had two scope identities

For LIVE-3 the local recognizer *did* accept the question. The model's plan and the recognized plan differed in exactly one way:

```
step q2.descriptionTerms:  model=["Popular bookstore"]   recognized=[]
step q2.description:       model=null                    recognized="Popular bookstore"
```

Both encodings reach rows through the same normalised case-insensitive substring match in `filterMatching.js`, so they are one scope written two ways. `planScopeKey` already folds `category` and `categories` into one set but compared the description fields raw, so `auditPlanRequest` reported a coverage mismatch and a fully supported question clarified.

**Fix — `79ed805`.** One shared `planDescriptionKey` folds a scalar `description` and the `descriptionTerms` list into a single normalised, de-duplicated, sorted set, used by both `planScopeKey` and `planScopeContains`. This narrows nothing: no previously rejected scope becomes valid, and two checks get **stricter** — the same step written two ways is now caught as `plan_redundant_step`, and share containment no longer depends on which spelling each side used. A second latent bug (a plan carrying the same step twice under two spellings) is closed by the same change.

Regressions use new fictional rows, not the evaluation fixture: three Node contract tests in `backend/src/plan.test.mjs` and five smoke checks in `scripts/plan-checks.jsx`, including an independent hand-calculated `3600 / 1050 = 29.17%` over an exact 2026-08-13..2026-11-10 window, a case-and-whitespace variant, and a genuinely different term that must still be rejected.

### Second pass — live re-check, three paid calls

| # | Question | Expected (hand-calculated, written first) | Actual | Verdict |
| --- | --- | --- | --- | --- |
| RECHECK-3 | `what share of my last 90 days spending was at "Popular bookstore"?` | `2026-08-13..2026-11-10`; S$58.00 / 5 rows; S$20.50 / 2 rows; **35.34%** | Exactly that, including both evidence sets and `S$20.50 ÷ S$58.00 × 100 = 35.34%` | **Live numeric pass** |
| RECHECK-5 | `What did I spend this month, and what percentage was Canteen Meals?` | `2026-11-01..2026-11-10`; S$40.00 / 3 rows; S$5.50 / 1 row; **13.75%** | Exactly that | **Live numeric pass** |
| RECHECK-6 | `Show my total spending and my Bus & MRT spending, then the difference.` | S$40.00 / S$20.00 / **+S$20.00** | **Clarified.** No figure | Blocked, correctly |

RECHECK-6 cost one more paid diagnostic call, which showed a genuine disagreement rather than an encoding difference:

```
step q1.period:  model="all"   recognized="month"
step q2.period:  model="all"   recognized="month"
```

The question names no period. The model read it as all time; the local recognizer silently defaults to this month. Those are different questions, and refusing to answer is the guard working as designed — **not a defect, and deliberately not "fixed"**. It does expose a real blind spot in the mock matrix: case B passes in mock only because `mockPlanIntent` *is* the recognizer, so the two sides always agree. Section 7 carries the recommendation.

### Live capability boundary, measured

The bounded grammar, not the model, is what limits this feature. Measured offline at zero cost:

| Phrasing | Recognized |
| --- | --- |
| `What did I spend this month, and what percentage was Canteen Meals?` | yes |
| `Show my total spending and my Bus & MRT spending, then the difference.` | yes |
| `What share of last 90 days spending was at "Popular bookstore"?` | yes |
| `how much have i spent this month in total, and what percentage of that was canteen meals?` | **no** |
| same, with "in total" removed, or "of that" removed, or title-case category, or no question mark | **no** |
| `show me my total spending …` (differs from the accepted form only by "me") | **no** |

A live plan answer requires the local grammar to parse the sentence **and** the model to produce a field-identical plan. Casual student wording fails the first condition.

### Paid call accounting

**9 paid calls total**, all logged in `scripts/eval/calls.log` under `step=4-accept`, every one with `retries=0`, none repeated to make a result look better: 4 first-pass, 1 raw-plan diagnostic, 3 re-check, 1 raw-plan diagnostic. Cap was 12. All browser mock work in section 2 cost **0**.

## 4. Expectation corrections — M65 and M67 only

Commit `fa343b3`. Both are tightenings, documented in `scripts/eval/questions.js` with the rationale beside each case. No other MAIN expectation, no stored recording and no HOLDOUT case was touched, inspected or run.

- **M65** `complex-multipart-percentage` expected a complete category breakdown. That was the honest *substitute* available while bounded plans did not exist — a breakdown contains the grand total and the Food & Drinks subtotal, so a reader could divide them. Step 4 implements the capability itself, so the oracle is now plan-shaped: ordered base totals over one common period, counts, evidence sets and the two-decimal `percent_of`. `clarify` is no longer a pass for the one case named after this capability. The share is re-derived in `questions.js` with integer arithmetic rather than imported from `src/`, keeping the oracle independent.
- **M67** `complex-arbitrary-periods` expected `unsupported`, with the note "comparison supports only this month vs last month". Step 3B2 added the explicit two-sided period descriptor; named months resolve to full calendar months and a missing year uses the Singapore reference year. September versus July is now inside the contract, so `unsupported` would require stating a limitation that no longer exists in order to pass. It now expects `answer`. **Known gap, recorded rather than hidden:** M67 still has no numeric oracle, because `run.mjs` reads comparison figures only from the legacy `current`/`earlier` side keys while an explicit named-month comparison uses `first`/`second`. A passing M67 would prove honesty, not figures.

### MAIN replay, `--mock`, zero paid calls

| Run | Questions | Turns | Failing |
| --- | --- | --- | --- |
| Step3B2 final (2026-10-19, before Step 4 integration) | 71/76 | 77/82 | M46, M48.2, M66, M67, M76 |
| Current code, **old** expectations (isolation probe) | 70/76 | 76/82 | + **M69** |
| Current code, **new** expectations — **reported score** | **69/76 (90.8%)** | **75/82 (91.5%)** | + M65 |

Both probe runs are isolation measurements and their scorecards were deleted; only `SCORECARD-step4-accept.md` and `results-step4-accept.json` are committed. The reported score is *lower* than the carried-over 71/76, and every point of that drop is explained above: one point from the M65 tightening, one from M69.

## 5. Blocker: M69 regressed, and it is not mine

`M69` — *"What share of my spending this month went to each category?"* — asks for a complete per-category breakdown, which this app has implemented since before Step 3. It passed at Step3B2. It now clarifies with the bounded-plan limitation text and produces no figure.

**It was not caused by the fix in this task.** Re-running MAIN with `src/lib/planContract.js` restored to `6ebbcac` gives the identical 70/76 with M69 failing. The regression arrived with the Step 4 integration commit `29fc463` and was never measured, because Step4B2 ran no MAIN replay.

Root cause, confirmed offline:

```
recognized=true  ok=false  :: What share of my spending this month went to each category?
recognized=true  ok=false  :: Show me the percentage split of my spending this month.
recognized=true  ok=true   :: What percentage of my spending this month was Food & Drinks?
recognized=false ok=false  :: How much did I spend this month?
```

`recognizePlanRequest` marks any message containing `share`, `percentage` or `percent` as `recognized`. When the bounded grammar then fails to parse it, the result is `recognized: true, ok: false`. In `src/lib/intent.js` the anti-partial guard reads only `.recognized`, so **every ordinary answer is refused** for that question:

```js
const multipart = recognizePlanRequest(message,{cats,today}).recognized;
if (multipart && ['answer','analyze','propose_scope'].includes(type)) { /* … */ return PLAN clarification; }
```

The guard's purpose is to stop a recognised multipart question being answered with a narrower **one-sided total**. A complete category breakdown is not a narrower answer: it discloses every group and recombines to the grand total — which is precisely the reasoning M65's own original note recorded. Blocking it is over-blocking.

**This was deliberately not fixed in this task.** It is a change to a safety barrier that Step4B2 added on purpose, it was found during step 5 rather than during the browser or live work, and the time box was already spent. A rushed edit to an anti-partial guard is exactly the kind of change that should be reviewed before it is made, not after. The proposed shape is in section 7.

## 6. Gates and artifacts

Run before each of the two code commits and again at the end:

| Gate | Result |
| --- | --- |
| `npm run build` | pass (the existing >500 kB chunk warning is unchanged; no code-splitting work was done) |
| `npm run smoke` | **2267/2267** (+5 over the 2262 baseline) |
| `backend` provider checks | **39/39** |
| `backend` Node tests | **233/233** (+3 over the 230 baseline) |
| `git diff --check` | pass |

Three commits, one logical change each: `79ed805` the defect fix with its regressions, `fa343b3` the two expectation corrections plus the scorecard and call log, and this report.

Uncommitted local artifacts, all outside tracked source: `/private/tmp/tallyai-step4-accept/` holds the rebuilt fixture, both mock and live adapters, 36 mock screenshots, 3 live screenshots, 3 re-check screenshots, per-viewport reports, `live-expected.json`, `live-records.json`, `live-calls.jsonl` and the diagnostic scripts. No media, screenshot or receipt was staged.

Servers: the mock adapter (8847), the live adapter (8848) and two Vite fixtures (5247, 5248) were all started by this task and all stopped at the end. No server belonging to the user was started, restarted or stopped, because none was running.

## 7. What is still open

1. **M69 over-blocking (blocker).** Proposed fix for review: the anti-partial guard should refuse an ordinary answer only when that answer would be *narrower* than the recognised request — a scalar total — and should let a complete breakdown through, since it answers both parts by construction. That is a change to `src/lib/intent.js`, not to the recognizer, because narrowing `recognizePlanRequest` would stop the single-clause literal-share family (`What share of last 90 days spending was at "X"?`) being recognised at all and would break the capability that now passes live.
2. **Period-less multipart requests.** The recognizer silently defaults a missing period to this month while the model reads it as all time, so the difference family cannot be answered live from a period-less sentence. Either make a missing period an explicit clarification, or state the default in the clarification text. This needs a product decision; it is not a bug.
3. **The grammar is the capability.** Live plan answers require the local grammar to parse the sentence. The measured table in section 3 is the real supported surface. Widening it is Step 5 work, and the phrasings listed there should **not** be special-cased — they are this task's own test sentences.
4. **The mock matrix cannot see model/recognizer disagreement**, because `mockPlanIntent` *is* the recognizer. Any future mock gate should include at least one registered response that differs from the recognizer's plan in a field the audit compares.
5. **M67 has no numeric oracle** until `run.mjs` can read `first`/`second` comparison side keys.
6. Unchanged from before: M46, M48.2, M66, M76 still fail; the 4096-token plan ceiling is still configured rather than measured; HOLDOUT remains untouched for Step 6.

## 8. Recommendation

**Do not publish Steps 3–4 yet, and do not start Step 5 yet.** Fix M69 first.

Publishing today would ship a regression against a capability that already worked: a user asking "what share of my spending went to each category?" would stop getting the breakdown they get in production right now. That is a worse outcome for a real user than not having bounded plans at all, and it is a one-file fix away from being a non-issue.

Suggested order, each as its own gated commit:

1. Fix M69 with the section 7.1 approach, with regressions covering both "a breakdown may answer a recognised share question" and "a scalar total still may not". Re-run MAIN `--mock` and confirm `complex-share-per-category` returns to passing.
2. Re-run the browser matrix (it is now a two-command rebuild) plus a short live pass on the three supported phrasings, inside a fresh paid-call cap.
3. Only then consider publication. The 2026-10-19 publish gate's nine-step plan still stands and still needs an explicit "go"; the one addition is that local `gh-pages` is stale at `29fc463` and must be refreshed from the remote before step 7 of that plan.

Step 4's engine, presentation, evidence, staleness, cancellation and safety behaviour are in good shape — that is what sections 2 and 3 demonstrate. What is not yet acceptable is its effect on the questions it was never meant to touch.
