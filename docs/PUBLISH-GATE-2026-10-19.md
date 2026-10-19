# Local publication gate, 19 October 2026

Recommendation: ready for a later explicit “go” for the documented supported scope. No publication has occurred. Seven MAIN questions still fail; this is not completion of all future assistant work. Production verification is reserved for the later publication task.

Started 04:00 UTC, within the 75-minute limit. Initial branch `checkpoint/2026-10-19-wip`, clean HEAD `bc07d50`. Local and remote `main` and `wallpaper-redesign` verified at `6f912c81a6207c5157d20c6d0d0c5e5bff88c133`. Remote Pages is `d9ff6c078f652646ffb59a36740ddec9e4ee9c4a`; local Pages is stale at `29fc463`. No branch was pushed, merged, reset, rebased or squashed. HOLDOUT cases were neither inspected nor run, and their expectations are unchanged.

## 1. Existing-user compatibility, Part C

Read storage, default categories, sample generator/lifecycle and roast preference formats directly from `6f912c8`. Recreated exact old JSON shapes using that commit's sample generator, not the current generator. Fictional snapshots are in `scripts/eval/publish-gate-legacy-snapshots.json`; browser observations are in `scripts/eval/publish-gate-compatibility.json`.

Isolated origins: `http://127.0.0.1:5211` for the current development frontend and `http://127.0.0.1:5212/Daily-Expense-Tracker/` for the configured static Pages build. Only these fictional origins were seeded. The public Pages origin and existing user tabs/storage were untouched. A seed safety marker refuses to overwrite an occupied foreign origin.

| Snapshot | Expected and observed | Frontend + reload | Pages build + reload |
| --- | --- | --- | --- |
| Personal | Nine rows, all-time S$238.23, October seven rows S$217.13; budgets S$490 | Pass | Pass |
| Personal plus old sample | All 78 rows remain, all-time S$1119.93, October 36 rows S$595.23; old sample budgets S$320 | Pass | Pass |

Every one of the eight seeded JSON values was exactly unchanged after app load and reload: `ww_exp`, `ww_cats`, `ww_bud`, `ww_theme`, `ww_roast_preferences`, `ww_name`, `ww_motion`, `ww_sample`. Equality covers every row field, amount, ID, category association, custom category, budget and legacy marker. Original category IDs `food`, `hire`, `pub`, `shop`, `needs`, `misc` and labels remain; custom `books` / “My Books” remains. Forest stays selected. Explicit roast preferences `{enabled:false,name:'Fictional W',singapore:false,smu:true}` remain exact. No sample loads automatically, no row is deleted, no category is reclassified. In the old-sample snapshot the missing custom-category budget is already absent in the old-format input, and remains absent.

User-visible changes from the public release:

- Saved category labels/order/colours stay exact. Fresh defaults are Food & Drinks, Entertainment, Daily Needs, Shopping, Public Transport, Private Hire, Others, in that order. Existing lists do not receive Entertainment automatically.
- The budget warning threshold is now 80%, previously 75%; the hero tick follows it. Existing users between those thresholds can now see “On track” and the calm wallpaper. Money/status boundaries use cents. Saved Forest selection is independent of these status effects.
- Home uses the same seven-day bars on desktop and phone, replacing the desktop running-total chart. It names the full date window, total and daily average; each day opens a keyboard-accessible transaction dialog. Recent, category budgets and donut remain. Phone ordering puts the donut before the bars/category budgets/Recent.
- Fresh empty Home shows S$0.00, “No budget set”, seven zero days, category rows with no budgets, “Nothing logged for October yet”, “Add your first expense” and “Try it with sample data”. No automatic demo is inserted. The existing empty-state actions remain available.
- Explicit new sample loads use seven categories and demo budgets targeting about 76% usage at load time, independent of personal spending. New sample descriptions distinguish Grab rides and GrabFood. Notebook and pens moves to Daily Needs; Concert ticket to Entertainment; Birthday gift becomes Unlabelled cash purchase in Others. Existing sample rows stay exactly as saved until explicit removal/reload.
- Sample loading reuses compatible categories, adds missing ones safely and temporarily replaces matching sample-category budgets while retaining unrelated budgets. Existing records/budgets require review in Settings. Removal restores unchanged budgets and retains later edits and intentionally used categories. Already-loaded samples require explicit removal before replacement. Settings explains these rules.
- Fixed during this gate: the loaded-sample notice now says “Your saved budgets determine the current status, including any personal spending.” Its previous 76% statement was misleading for preserved legacy samples. Settings still explains the 76% target for new loads. Saved old data is untouched.
- Ask now exposes complete breakdowns, answer references, bounded local follow-ups, original-source snapshots, approved rules, scope review/revision/approval, Clear chat and Stop request. Filters and exact date ranges are disclosed; stale answers retain warnings. Unsupported requests clarify, and validation failures carry an offline notice. Help, credential refusal and empty-input handling use built-in text. These are session features, not a storage migration.

## 2. Evaluation correction, Part A

Commit `a9fcbff`: only M64's expected outcome changed, with a rationale comment. Noise contains no financial question; brief help is acceptable. The harness represents a help plan as outcome `answer`, so M64 now accepts `clarify`, `unsupported`, or `answer`. No other expectation, HOLDOUT expectation, recording or application logic changed in that commit. Before/after replay reports and detailed results are committed beside the existing scorecards.

| MAIN replay | Questions | Turns |
| --- | --- | --- |
| Before | 68/76, 89.5% | 74/82, 90.2% |
| After | 69/76, 90.8% | 75/82, 91.5% |

Both runs used `--mock`, zero HTTP/provider requests, five explicitly labelled offline fallbacks. This one-point improvement is expectation-only. It is not fresh live accuracy or evidence that every capability name in the scorecard is implemented: several cases pass by honest clarification.

Still failing: M46 (scope contract), M48.2 (exclusion follow-up interpretation), M50 (multiple-category contract), M54 (help instead of clarification), M65 (multipart share contract), M66 (two-category contract), M68 (multiple-category contract). Five are labelled validation/offline failures, two are interpretation mismatches. M54 states no financial figure.

Recording provenance from the saved Step 2 live subset: 27 refreshed keys, M17, M18, M19, M20, M21, M23, M33, M34, M35, M36, M37, M38, M39, M40, M45, M46, M48.1, M50, M54, M63, M64, M65, M66, M68, M72, M73, M76. The other 47 stored recording keys are older Step 1 responses: M01–M16, M22, M24–M32, M41.1–M44.1, M51–M53, M55–M62, M67, M69–M71, M74–M75. Some stored responses are now bypassed by built-in handling. Identical response bodies can still be freshly recorded; provenance comes from the live-subset audit, not a JSON diff. No MAIN recording was refreshed in this task. The six new browser calls below are separate evidence and do not replace MAIN recordings.

## 3. Browser verification, Part B

Actual App with fictional data. Live path: browser → isolated local HTTP adapter → current `handleIntent` → unchanged provider with `maxRetries:0` → shared validation → browser validation → cents/evidence engine. The adapter logs at the actual provider-call boundary and enforces an eight-call cap. It provides no roast/receipt provider path. No raw provider responses were printed or saved. This is local browser verification, not deployed Vercel verification.

| Item | Result | Source |
| --- | --- | --- |
| 1 Home sample | S$378.10 / S$497.50, On track 76%; seven-day total S$150.60; Recent 29 current-month rows; seven category budgets; donut S$378.10. Day selection opens Concert ticket S$48.00 | Local engine/UI, zero paid calls |
| 2 Filter disclosure | Food + over S$5.00 + Mondays to Fridays only (weekends excluded), S$10.01 and the one correct row | One live interpretation; local calculation |
| 3 September total | S$12.34, full 2026-09-01 through 09-30, one row | One live interpretation; local calculation |
| 3 August Food total | S$8.76, Food, full 2026-08-01 through 08-31, one row | One live interpretation; local calculation |
| 3 Current-month total | S$217.13, seven rows, 2026-10-01 through 10-19 | One live interpretation; local calculation |
| 4 September vs August Food | Explicit clarification: August was outside the proposed October/September comparison. No financial figure or substituted-period answer | One live interpretation; local guard |
| 5 Complete breakdown | All seven categories, alphabetical, recombine to S$217.13, seven evidence rows | Built-in follow-up from live month total |
| 6 Three follow-ups | Category breakdown → month breakdown → original transactions. Scope and S$217.13 retained, original-source wording shown | Three built-in turns, zero extra calls |
| 7 Student scope | Eight explicit literal terms, year-to-date dates, one candidate, no aggregate before approval. Keyboard review/revision/discard/approval. Approved S$7.07 with Course textbook evidence | One live proposal; built-in review/approval/calculation |
| 8 Secret extraction | Fixed credential/configuration/instructions refusal, no request | Built-in |
| 9 Empty submit | Whitespace + Enter leaves chat unchanged and Send disabled | Built-in UI |
| 10 Keyboard/phone | Enter opens evidence/day dialog and activates scope controls; Tab gives a visible gold 3px focus outline; phone amounts readable | Actual browser |

Inspected 1440×900 and 390×844. Home and scope/evidence were visually inspected at both sizes. Named-month sequence and three-turn chain were exercised on desktop; their answer/evidence layout was inspected on phone using the live filter/scope answers. This is not a claim that every prompt was independently re-run at both dimensions. Settled Home and Ask layouts measured 390px wide with no persistent horizontal overflow. No physical phone or screen-reader audit.

Screenshots are local, ignored and uncommitted under `scripts/eval/screens/publish-gate/`:

- `legacy-personal-laptop.jpg`, `legacy-sample-laptop.jpg`, `pages-legacy-personal-laptop.jpg`, `pages-legacy-sample-laptop.jpg`
- `fresh-empty-laptop.jpg`, `home-new-sample-laptop.jpg`, `home-new-sample-phone.jpg`, `home-day-phone.jpg`
- `september-laptop.jpg`, `months-breakdown-laptop.jpg`, `followup-evidence-laptop.jpg`, `comparison-laptop.jpg`
- `filters-laptop.jpg`, `filters-evidence-phone.jpg`
- `student-proposal-phone.jpg`, `student-keyboard-focus-phone.jpg`, `student-approved-evidence-phone.jpg`, `student-approved-evidence-laptop.jpg`, `refusal-laptop.jpg`
- `legacy-sample-notice-before-phone.jpg`, `legacy-sample-notice-fixed-pages-phone.jpg`

## 4. Defect, repair and limits

The only application repair was the misleading loaded-sample notice, commit `04007d6`, with new legacy-budget rendering regression data. Required gates passed before both logical commits. The temporary test server initially failed to serve the Pages directory index; that was corrected outside the repository, and all four compatibility combinations were subsequently verified again against the repaired source/build.

Recognized but unsupported or unreliable combinations remain documented: arbitrary named-month comparisons, multiple-category interpretation outside an approved scope, multipart percentage requests, free-form exclusion amendments such as M48.2, arbitrary conversational references, merchant identity/aliases, top-N and temporary savings scenarios. Validation rejection must remain labelled offline/clarification; it must not narrow filters or substitute periods. Scope rules are literal approved inclusions/exclusions, not proof of semantic completeness. Do not infer successful capabilities from scorecard labels alone. No architectural expansion, model/dependency change, roast tuning, database work or UI redesign was undertaken.

## 5. Production readiness and history, Part D

- Vercel's intent Function imports the same backend handler, and both server and browser import the shared validation contract. Financial results and evidence remain local. Provider inputs do not include ledger rows; descriptions remain untrusted data.
- Configured Vercel build uses `/api`, root assets `/assets/`, and has no runtime `localhost`/`127.0.0.1` references.
- Configured Pages build uses `VITE_BASE=/Daily-Expense-Tracker/ VITE_ASSISTANT_URL=https://ailodge-expensetracker.vercel.app/api`, the correct prefixed assets, and no runtime localhost references. It needs no running laptop. An unqualified local `npm run build` does embed the development backend URL in this environment; it must not be the published artifact. The explicit command is mandatory.
- Pages default CORS origin remains `https://wakigit.github.io`. Local Function-guard check: allowed preflight 204 with exact origin, unknown origin 405 without permission, zero handler/provider calls. Existing three CORS backend tests pass. No public production endpoint was called here.
- Read-only history scan covered 15 post-release commits and 192 unique blobs, excluding the question-bank file to avoid inspecting HOLDOUT. No matches against locally configured secret values or credential patterns. The allowed MAIN-only expectation diff was reviewed separately. No env files, screenshots, dependency trees, build output or private ledger are tracked in the proposed additions. This is a scoped audit, not a proof that arbitrary historical text can never contain private information.
- `main` and `wallpaper-redesign` are ancestors of the candidate, so normal fast-forward publication is possible. The mixed checkpoint commit is preserved. Remote Pages must be refreshed before later publication, because the local ref is stale.

| Feature | Existing commits, preserved |
| --- | --- |
| Categories/sample | `b79abad`; this gate's notice repair `04007d6` |
| Home chart | `b79abad` |
| Assistant stages 2/3/4 | `b79abad`; scope example documentation `54bba94` |
| Evaluation harness | `d07e4dd`, `d774741`, `f3ac8f4`, `bc07d50`; M64 correction `a9fcbff` |
| Honesty/contracts | `d3217c3`, `a4dd9c5`, `6d95e27`, `ff719d6`, `8aec165`, `4ad3e9e`; regression checks `95549ae` |
| Documentation | `b79abad`, `54bba94`, this gate report and evidence audit commit |

`b79abad` contains several features and was named “partial Stage 4 (unreviewed)”. This map describes actual history rather than pretending those features arrived as separate reviewed commits. This gate verifies only the documented paths above.

## 6. Required checks

Before M64 commit: build passed; smoke 1689/1689; provider schema checks 28/28; backend node tests 111/111; diff check passed.

Before repair commit and final gate: build passed; smoke 1690/1690; provider checks 28/28; backend node tests 111/111; diff check passed. Configured Pages and Vercel production builds also passed. Screenshots are ignored. Only explained gate artifacts enter the final documentation/audit commit.

## 7. Paid calls

Exactly six actual provider calls, each logged individually in `scripts/eval/calls.log`, retries zero: September total, August Food total, current month total, September/August comparison, category+weekday+amount filter, student scope proposal. No other paid request, production request or HOLDOUT run. Built-in follow-ups, refusal, approval, evidence, sample/storage checks and MAIN replays cost zero. Two unused calls are not authority to make future production checks.

## 8. Concrete later publication plan and recovery, Part E

The exact source SHA is the containing gate-audit commit, recorded in the final handoff. Its application code is `04007d6`; subsequent gate-audit files do not alter runtime behaviour. Execute only after a later explicit user “go”.

1. Verify clean source checkout, exact approved SHA and refreshed remote tips. Record prior Vercel Production deployment ID and alias assignment read-only, plus the current remote Pages tip. Stop if an unexpected upstream commit prevents a fast-forward or if a new blocker appears.
2. Fast-forward `wallpaper-redesign` and `main` to that exact source using `git merge --ff-only <approved-sha>`, then normal `git push origin wallpaper-redesign` and `git push origin main`. Preserve every checkpoint commit; no force-push.
3. Wait for Vercel Production tied to that source SHA. Stop if its source association or deployment status is wrong.
4. Confirm `https://ailodge-expensetracker.vercel.app` resolves to that production deployment and `/api/health` returns healthy. Health is free and is not an interpretation check.
5. Allow at most four paid production checks in total, retries disabled, logging actual calls: weekday-average question without an accidental Mon–Fri restriction; named-month total; complete breakdown; secret refusal. Exercise fictional data in an isolated origin/profile. Use built-in handling where that is the actual path, especially refusal, and report it as zero paid calls. Verify exact cents, ranges, filters and complete evidence. Stop publication on incorrect figures, silent narrowing or blocked supported named-month totals.
6. Rebuild Pages from the same approved source, with exactly `VITE_BASE=/Daily-Expense-Tracker/ VITE_ASSISTANT_URL=https://ailodge-expensetracker.vercel.app/api npm run build`. Verify the asset prefix, endpoint and absence of runtime localhost references before copying artifacts.
7. Fetch the current remote `gh-pages`; create a temporary worktree based on that tip. Replace only the intended built assets/index, review the diff, make a normal Pages commit identifying the source SHA, and push normally. Do not rebuild/reset/force-push an assumed old Pages tip.
8. Verify live HTML/assets match that build, key UI loads, and allowed-origin CORS still works. No real user's browser storage is read or overwritten.
9. Recovery: normal revert commit(s) on source branches if necessary, followed by normal pushes, or restore the documented prior Vercel deployment through the platform. Revert the new Pages publication with a normal commit based on the current remote tip. Never force-push. Any failed gate is a stop condition, not permission to improvise a history rewrite.

## 9. Recommendation

Ready for a later “go”, within the explicitly supported scope and the production gates above. No current compatibility or supported named-month-total blocker remains. The seven MAIN failures and deferred combinations remain visible. Do not describe this as complete assistant capability or wholly fresh live accuracy. After the assistant upgrade is accepted and evaluated, roast accuracy and personalisation is a separate authorised track; it has not started here.
