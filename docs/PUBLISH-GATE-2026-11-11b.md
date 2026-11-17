# Publish prep for the P2 coverage fix, 11 November 2026 (b)

**Nothing has been pushed.** Production is `main` = `wallpaper-redesign` = **`eaab1a5`**, Pages `gh-pages` = **`31754c8`**, both published earlier today by [gate 11a](PUBLISH-GATE-2026-11-11.md) §11. This document covers the **next** candidate: the P2 coverage fix plus the two local-only records that were never pushed.

Claims are **ran** (executed, output read), **inferred** (follows from something ran) or **unverified** (not measured).

## 1. The candidate, and what is new since production

**Candidate = the tip of `checkpoint/2026-10-19-wip`**, which is this document's own commit. Ten commits ship, all currently local-only on `checkpoint/2026-10-19-wip`:

| | | |
| --- | --- | --- |
| `addbb68` | docs | the §7 A–F execution record, shipped candidate and rollback target |
| `a28765a` | eval | Step G live check list — 4 paid calls, 3 exact, 1 refusal |
| `f707203` | eval | the three Step G2 diagnostic calls |
| **`81dc61a`** | **fix** | **every configured category is the absence of a filter, not a narrowing** |
| `17aff02` | eval | the two Step G2 live recheck calls |
| `7f50845` | docs | the first draft of this plan |
| **`f7b280a`** | **fix** | **every encoding of "all categories" unified; the literal "null" stopped** |
| `39c8c94` | docs | the scalar-category guard, measured and rejected |
| `de47624` | eval | the seven Step G3 live calls |
| `4d9ca5e` | docs | this plan, retargeted |

**Two commits change runtime behaviour: `81dc61a` and `f7b280a`.** **(ran)** `git diff --stat eaab1a5..HEAD -- src/ backend/` touches `src/lib/categoryCoverage.js` (new), `src/lib/intent.js`, `src/lib/intentLimitations.js`, `src/lib/planContract.js`, `src/lib/planRequest.js` and two test files. `api/`, `vercel.json`, `package.json`, `package-lock.json` and `src/lib/storage.js` are **not** in the diff, so §§3–5 of gate 11a carry forward unchanged: same CORS, same rate limits, same dependencies, same storage keys, **no migration**. **(inferred from the diff, which is ran.)**

## 2. What the fix does

Step 3 taught the model the explicit OR list, and it began writing `categories: [every configured id]` to mean "across all categories". The coverage guard compared that against the categories the **user** named, found none, and refused. One named normalisation — `src/lib/categoryCoverage.js` — removes the identity filter **before** ordinary-query validation and **before** bounded-plan step validation, on server and client alike. **The guard's five branch predicates are unchanged.**

It can only broaden, it is more faithful about orphan rows than the literal all-ids filter, it never fires when the user named a category, and it never fires when a `category_terms` entry does not map to a configured category. `descriptionTerms` is deliberately untouched — there is no "every description" identity.

The single FILTER_COVERAGE string that served five branches is split into `CATEGORY_COVERAGE` and `DESCRIPTION_COVERAGE`, with the OR-coverage text kept for the case it was written for.

## 3. Gates — all green at the candidate **(ran)**

| Gate | Result | vs the 11a baseline |
| --- | --- | --- |
| `npm run build` | pass | — |
| `npm run smoke` | **2408/2408** | +30 (was 2378/2378) |
| `eval:self-check` | pass | — |
| `eval:fixture-checks` | pass | — |
| backend `npm test` | **239/239** | unchanged |
| `eval:harness-checks` | **82/82** | +5 (was 77) |
| `eval:main:mock` | **70/76 questions, 76/82 turns** | **"No per-question change." Gate passed: no regression.** |
| `git diff --check` | pass | — |

Two pre-existing expectations were updated, both because the wording split is intentional and neither because behaviour regressed: `scripts/or-filter-checks.jsx` "omitted category" and `backend/src/assistant.test.mjs` "missing category" now expect `category_filter_coverage_incomplete`. **(ran)**

## 4. Live measurement — 7 paid calls, expectations written first

Server leg in process, `maxRetries: 0`, a fresh fictional ledger, and the expected figures computed by an independent oracle and **written to disk before the first call**. **(ran)**

**This is a sample of seven, not a rate.** Five of them are the same sentence, asked five times, to see which encodings the model actually produces.

| | Sentence | Encoding returned | Result |
| --- | --- | --- | --- |
| P2-1 | *Which weekday do I spend most on?* | no category filter | **200** — Saturday **S$47.10**, 5 calendar occurrences |
| P2-2 | same | **labels only (all 7)** | **200** — Saturday **S$47.10** |
| P2-3 | same | **labels only (all 7)** | **200** — Saturday **S$47.10** |
| P2-4 | same | **ids + labels (all 7 each)** | **200** — Saturday **S$47.10** |
| P2-5 | same | `category_terms: ["weekday"]` | **502 `invalid_intent`** → answered offline |
| NAMED | *How much did I spend on Public Transport this month?* | scalar `category: pub` | **200** — **S$2.20**, 1 transaction, *"Counting only: category Public Transport"* |
| SYNONYM | *how much did i spend on food last month?* | scalar `category: food`, `period: lastmonth` | **200** — **S$13.60**, 2 transactions |

**Every figure returned matches the pre-written oracle exactly** — Saturday S$47.10 (runner-up Monday S$30.30), S$2.20, S$13.60. **(ran)**

Three different encodings of "all categories" — none, labels, ids+labels — all now reach the same correct answer. **Before this release, the labels-only encoding returned 502** and the ids encoding returned a refusal; that is the whole point of the change.

**P2-5 is the honest limit, and it is a different thing again.** The model put the **grouping dimension** in the category field: `category_terms: ["weekday"]`. That is not "all categories" and "weekday" maps to no configured category, so it is correctly **not** normalised and correctly refused. The user sees an offline answer, never a wrong figure. It is a fourth shape for one sentence, and it is model variance, not a validation defect.

**So: the sentence is materially better and still not guaranteed.** **4 of 5 samples answer correctly now, against about 1 of 5 on `eaab1a5`.** The "about" is load-bearing: of the five samples, only P2-1's encoding — no category filter at all — would also have answered on `eaab1a5`; the two labels-only samples returned 502 there, the ids+labels sample was refused, and P2-5 refuses on both releases. Which encoding the model picks is not controlled, so 1-in-5 is this sample's shape, not a measured rate. One sample still does not answer. Describe it that way and no other way.

## 5. Publication plan — executed, see §7

Same procedure as [gate 11a §7](PUBLISH-GATE-2026-11-11.md#7-the-publication-plan--waiting-for-go), steps **A–F**, same rollback target.

**Step A — record state (changes nothing)**
```bash
git fetch --all --prune
git rev-parse HEAD main wallpaper-redesign gh-pages origin/main origin/wallpaper-redesign origin/gh-pages
git status --porcelain            # must be empty
git merge-base --is-ancestor main HEAD && echo FAST-FORWARD-OK
```
**Rollback target: the CURRENT Production deployment, which is `eaab1a5`.** Supplied with the go and recorded: **`ailodge-expensetracker-r9vueizjw-wei-kai.vercel.app`**. The deployment URL itself is behind Vercel login, so it was confirmed **by content instead**: see [§7.1](#71-step-a--state-recorded-and-the-rollback-target-content-verified). **(ran)**

**Do not reuse `ailodge-expensetracker-irrj2lx0i-wei-kai.vercel.app`.** That is the deployment for **`6cf9345`**, and promoting it would roll back **two** releases — this one and the one published earlier today. It is recorded in [gate 11a §11.1](PUBLISH-GATE-2026-11-11.md) as the rollback target *for that gate only*.

**Step B — publish source**
```bash
git checkout wallpaper-redesign && git merge --ff-only <tip> && git push origin wallpaper-redesign
git checkout main              && git merge --ff-only <tip> && git push origin main
git checkout checkpoint/2026-10-19-wip
```
**Verify:** `git ls-remote --heads origin` shows both at the tip.

**Step C — Vercel Production.** Confirm in the dashboard that the new Production deployment's source commit is **the tip** and status Ready. Externally I will reproduce the Vercel-shape build locally and byte-compare the served assets.

**Step D — Vercel live, free.** `/api/health`, `/` 200, `/assets/` prefix, CORS 204 + echoed origin for `https://wakigit.github.io`, no allow-origin for an unknown origin, no `localhost` in the bundle. **0 paid calls.**

**Step E — Pages artifact**, built from the clean checkpoint branch at the tip:
```bash
VITE_BASE=/Daily-Expense-Tracker/ \
VITE_ASSISTANT_URL=https://ailodge-expensetracker.vercel.app/api \
npm run build
```
**Step F — publish Pages**, on the current remote tip, `rsync -a --delete --exclude .git --exclude .nojekyll`, commit `Publish frontend build from <tip>`, normal push, **no force**. The `.nojekyll` exclusion is required: it exists on `gh-pages`, is not Vite output, and `--delete` would remove it.

~~**Step G is not in scope here** and is not approved.~~ **Superseded:** a two-call **Step G-lite** was approved separately after F and is recorded in [§8](#8-step-g-lite--2-paid-calls-on-the-live-pages-site).

**Rollback rule, unchanged:** roll back only for a wrong figure, a silently dropped filter, or a crash/500. A clarification on a supported question is a known limit. Source rollback is `git revert --no-commit <base>..HEAD` plus one commit; **never force-push.**

## 6. Blockers

**None that stop publication, and one that should shape how it is described.** **(inferred from §§1–4.)**

1. **The P2 sentence is better, not guaranteed.** §4. Every encoding of "all categories" now answers; a fourth shape, the grouping dimension written into the category field, still refuses. Do not describe this release as "fixed the weekday question".
2. **The scalar-category gap stays open, deliberately and on evidence.** A mention-guard would refuse **M59**, a legitimate Singlish question, plus 9 of 42 synonym and partial-label probes. Measured at zero cost before any guard was written, rejected, and written up in [ASSISTANT-SCALAR-CATEGORY-GUARD.md](ASSISTANT-SCALAR-CATEGORY-GUARD.md) with three designs worth measuring. **(ran.)** The literal `"null"` defect **is fixed** in `f7b280a`.
3. All carry-forward limits from [gate 11a §9](PUBLISH-GATE-2026-11-11.md#9-blockers) stand, including the six failing MAIN questions and the stale 502 recordings.
4. **`eval:main:mock` cannot catch this class of bug.** It replays recorded intents, and the recorded M23 intent predates the `categories` field. The server-leg corpus now carries the captured G2a intent so that exact model output stays under the standing gate at zero cost. **(ran.)**

## 7. Execution record — A–F, 17 November 2026

Executed on an explicit "go" naming candidate **`88bd48d`** and rollback target **`eaab1a5`** / `ailodge-expensetracker-r9vueizjw-wei-kai.vercel.app`. The candidate is `88bd48d`, not the `4d9ca5e` written in §1: that line was drafted before the commit it describes existed, and the two differ by nothing but this document's own text. Steps ran in order, each verified before the next.

### 7.0 Privacy review of everything that was about to become public **(ran)**

Required before any push, over `git log eaab1a5..88bd48d` — all 10 commits, every filename and every added line of all 14 files.

| Commit | | Verdict |
| --- | --- | --- |
| `addbb68` | docs: the §7 A–F execution record | PASS |
| `a28765a` | eval: Step G live check list | PASS |
| `f707203` | eval: the three G2 diagnostics | PASS |
| `81dc61a` | fix: every configured category is the absence of a filter | PASS |
| `17aff02` | eval: the two G2 rechecks | PASS |
| `7f50845` | docs: the first draft of this plan | PASS |
| `f7b280a` | fix: every encoding of "all categories" unified | PASS |
| `39c8c94` | docs: the scalar-category guard, rejected on evidence | PASS |
| `de47624` | eval: the seven G3 calls | PASS |
| `88bd48d` | docs: this plan, retargeted | PASS |

Zero hits in every class: `.env`/`.env.*`/`.pem`/`.key`/credential filenames; image, video, audio, PDF or archive extensions; `GIT binary patch` blocks; key-shaped strings (`sk-`, `sk-ant-`, `AKIA…`, `AIza…`, `ghp_`, `xox*-`, JWT triples, `BEGIN … PRIVATE KEY`, bare 32-char base64); secret assignments (`api_key=`, `token=`, `Authorization:`); NRIC `[STFGM]#######[A-Z]`, phone, email, street/block/postcode or card patterns; and absolute `/Users/…` paths. Three hostnames appear and all three are intentional: `ailodge-expensetracker.vercel.app`, `wakigit.github.io`, and `evil.example` in the CORS negative test. `scripts/eval/calls.log` adds 16 lines, all prose about fictional-ledger figures. `git diff --check` clean. **No FAIL, so no stop condition.**

### 7.1 Step A — state recorded, and the rollback target content-verified **(ran, changed nothing)**

| | |
| --- | --- |
| `HEAD` (candidate) | `88bd48d` |
| `main` = `origin/main` | `eaab1a5` |
| `wallpaper-redesign` = `origin/wallpaper-redesign` | `eaab1a5` |
| `origin/gh-pages` | `31754c8` |
| `git status --porcelain` | empty |
| `merge-base --is-ancestor main HEAD` | `FAST-FORWARD-OK` |

Local `gh-pages` was a stale `5e0e67b`; it was never used. Step F worked from `origin/gh-pages`.

**The rollback deployment URL is behind Vercel login, so it was verified by content rather than by visiting it.** `eaab1a5` was checked out into a throwaway worktree and built in the Vercel shape (`VITE_BASE=/`, `VITE_ASSISTANT_URL=/api`, `package.json` and `package-lock.json` being identical across the range, so the installed tree is the right one). The public alias then served **byte-identical** files:

| File | sha256 live vs local |
| --- | --- |
| `index.html` | `14997a5a…` — identical |
| `assets/index-CFbXn2jk.js` | `5a7a06c7…` — identical |
| `assets/index-CaBZ-uKt.css` | `de682f47…` — identical |

So **the alias was serving exactly the `eaab1a5` build** at the moment before Step B. That is what makes `r9vueizjw` a usable rollback target: its content is known, even though its URL cannot be opened from here. **(ran.)**

### 7.2 Step B — source published **(ran)**

`wallpaper-redesign` then `main`, each `git merge --ff-only 88bd48d` and a normal `git push`; back to `checkpoint/2026-10-19-wip`. No force, no rebase, no squash; all ten commits preserved. **Verify:** `git ls-remote --heads origin` → `main` and `wallpaper-redesign` both at `88bd48d`.

### 7.3 Step C — Vercel Production **(ran, plus one dashboard fact you confirmed)**

Verified from outside first: the alias had already redeployed, and all three served files are **byte-identical** to a local Vercel-shape build of `88bd48d` — `index.html` `d0fd1c7b…`, `assets/index-jQ1NlmnL.js` `7cbf3c47…`, `assets/index-CaBZ-uKt.css` `de682f47…` (the CSS is unchanged by this release; only the JS hash moved, `CFbXn2jk` → `jQ1NlmnL`). **So the deployed content is the candidate.** The commit association and the status label are not visible from outside; you confirmed them in the dashboard: **source `88bd48d`, status Ready, Production, Current, serving the alias.**

**New current Production deployment: `ailodge-expensetracker-mo5924pc4-wei-kai.vercel.app`.** The previous one, `ailodge-expensetracker-r9vueizjw-wei-kai.vercel.app` (`eaab1a5`), is the rollback target.

### 7.4 Step D — Vercel live, free, 0 paid calls **(ran)**

| Check | Result |
| --- | --- |
| `/api/health` | `{"status":"ok","service":"daily-expense-tracker-backend","providerConfigured":true}` |
| `/` | 200 |
| asset prefix | `/assets/…`, correct for base `/` |
| CORS, `https://wakigit.github.io` | **204**, `access-control-allow-origin` echoed exactly, `access-control-allow-methods: POST, OPTIONS` |
| CORS, `https://evil.example` | **405**, **no** `access-control-allow-origin` |
| `localhost` / `127.0.0.1` in the served bundle | none |

`/api/health` is free and is not an interpretation check.

### 7.5 Step E — Pages artifact built from the published source **(ran)**

Built on the clean checkpoint at `88bd48d` with both env vars explicit:

```
VITE_BASE=/Daily-Expense-Tracker/
VITE_ASSISTANT_URL=https://ailodge-expensetracker.vercel.app/api
```

`dist/index.html` references `/Daily-Expense-Tracker/assets/index-DdAoYaG4.js` and `…/index-CaBZ-uKt.css`; the Vercel endpoint appears twice in the bundle; **no** `localhost` or `127.0.0.1` anywhere in `dist/`. Note the three builds in this gate produce three different JS hashes for the same source — `CFbXn2jk` (`eaab1a5`, base `/`), `jQ1NlmnL` (`88bd48d`, base `/`), `DdAoYaG4` (`88bd48d`, Pages base) — because the base path and the endpoint are compiled in.

### 7.6 Step F — Pages published **(ran)**

Worktree on **`origin/gh-pages` = `31754c8`** (the current remote tip, not an assumed one), then `rsync -a --delete --exclude .git --exclude .nojekyll dist/ …`. Reviewed before committing: one JS file deleted, one added, `index.html` changed, CSS untouched, and `.nojekyll` still present — the exclusion did its job. Commit `ad40e1a` *"Publish frontend build from 88bd48d"*, normal `git push origin HEAD:gh-pages`, **no force**; worktree removed.

**Verify, live (ran):** `https://wakigit.github.io/Daily-Expense-Tracker/` serves `index-DdAoYaG4.js`, and `index.html`, the JS and the CSS are each **byte-identical by sha256** to the local `dist/`. `/.nojekyll` returns 200. The Vercel endpoint is present in the live bundle. `origin/gh-pages` = `ad40e1a`.

**A–F complete. No step failed, so no stop condition was reached.**

## 8. Step G-lite — 2 paid calls on the live Pages site

Approved separately, after F, with its scope fixed in advance: **up to 2 paid calls, retries 0, a fresh Playwright context, a seeded fictional ledger, expectations written first.** **2 calls were made and neither was repeated.** **(ran)**

`maxRetries: 0` needed no arranging — it is hardcoded at both live call sites, `backend/src/provider.js:382` and `:565`, so the deployed build already satisfies it. **(ran)**

### 8.1 Setup

The **live Pages site** `https://wakigit.github.io/Daily-Expense-Tracker/`, i.e. `gh-pages` `ad40e1a`, the build from `88bd48d` that §7.6 verified byte-for-byte. Playwright 1.65.0 from the npx cache, symlinked into a scratch directory outside the repo; `executablePath` points at the already-cached Chrome for Testing 153.0.8010.12 in `chromium-1243`, so **nothing was downloaded or installed**. `chromium.launch()` with no `user-data-dir`, a **fresh `newContext()` per check** with `timezoneId: Asia/Singapore`, each check in its own process — so no answer could influence another through chat history. **No real browser profile was opened and no real data was touched.**

**Every URL other than the Pages origin and the one intent endpoint is aborted (fail closed).** The only thing that ever blocked was the Google Fonts stylesheet, which is the single `net::ERR_FAILED` console error in both runs. That interception is also the budget control: `/assistant/roast` fires from `RoastCard` on the Ask tab and is itself a paid call, so roast was additionally disabled in seeded preferences. **Measured per check: exactly 1 request to `/api/assistant/intent`, 1 aborted request, nothing else.** **(ran)**

The 13-row fictional ledger — mine, invented, nothing from MAIN — was seeded through `addInitScript` so it exists **before any page script runs**; seeding after first load races the app's own persistence effect, which writes its empty default back and erases it. The page confirmed **13 rows** present and independently reported its Singapore date as **2026-11-17**. **(ran)**

**Expectations were computed first**, by an oracle that imports **nothing** from the app — its own integer-cent arithmetic, Sakamoto weekday derivation, its own month window — and written to `expectations.json` **before the first paid call**. The ledger was then *rejected or accepted by assertion*: it is only usable if Saturday is the largest weekday in **every** plausible scope and the Mon–Fri answer differs everywhere.

| Scope | Winner | Runner-up | What a silent Mon–Fri narrowing would have to say |
| --- | --- | --- | --- |
| all time | **Saturday S$87.70** | Wednesday S$43.40 | Wednesday S$43.40 |
| this month | Saturday S$40.90 | Wednesday S$26.00 | Wednesday S$26.00 |
| last 7 days | Saturday S$22.50 | Wednesday S$14.00 | Wednesday S$14.00 |
| last 30 days | Saturday S$87.70 | Monday S$27.30 | Monday S$27.30 |
| last 90 days | Saturday S$87.70 | Wednesday S$43.40 | Wednesday S$43.40 |

Second trap: a **Public Transport** row on **2026-10-31**, immediately outside "this month", so a leaked window reads **S$34.30 over 3 rows** instead of the correct figure.

### 8.2 Results — both exact

| | Question | Expected (oracle, pre-written) | Actual (live) | Outcome |
| --- | --- | --- | --- | --- |
| **Q1** | *Which weekday do I spend most on?* | **Saturday S$87.70**, Saturday rows `11-07 18.40`, `11-14 22.50`, `10-31 20.00`, `10-24 26.80` | `data-answer-source="model"`, **200**, **"Highest recorded weekday total: Saturday: S$87.70 total, 6 calendar occurrences."** Read as **All categories** · `2026-10-07 to 2026-11-17 (inclusive, Singapore calendar dates)`; `See transactions (4)`, all **4** rows exact | **PASS** — exact |
| **Q2** | *How much did I spend on Public Transport this month?* | **S$14.30**, **2** transactions, `2026-11-01 to 2026-11-17`, rows `11-04 12.00` and `11-17 2.30` | `model`, **200**, **"S$14.30 recorded spending across 2 transactions. Counting only: category Public Transport."** Read as **Public Transport** · `2026-11-01 to 2026-11-17`; `See transactions (2)`, both rows exact | **PASS** — exact |

Both bubbles carried `Answer #1` and **neither** carried "Edit original question", which is the DOM discriminator between an answer and a clarification: these are answers, not refusals.

**Q1 is the sentence this release exists for, and on the live site it answered.** It read as **"All categories"** — the identity filter normalised away rather than refused — and the Mon–Fri trap **did not fire**. Both boundary traps held: Q1's window spans the full recorded range, and Q2 excluded the 2026-10-31 row, so the S$34.30 misreading never appeared.

**One honest discrepancy, and it is the oracle's, not the app's.** Q1 reports **6 calendar occurrences** where the oracle recorded **4**. These are different metrics and the app's is the one it states: it counts every Saturday in the window including zero-spend ones — Oct 10, 17, 24, 31 and Nov 7, 14 — and says so in its own detail line ("Zero-spend calendar occurrences are included"). The oracle counted only Saturdays that have rows. **6 is correct for the stated definition; the pre-written expectation simply did not cover that field.** No figure is wrong.

**This is a sample of two, not a rate.** Q1's single sample does not tell us which encoding the model will choose next time — §4's point stands unchanged, and the 4-of-5 vs about-1-of-5 wording in §4 is the honest description of that sentence.

### 8.3 Rollback rule applied

The pre-agreed rule: roll back only for **a wrong figure, a silently dropped filter, or a crash/500**.

- **No wrong figure.** Both figures match the pre-written oracle to the cent.
- **No silently dropped filter.** Q1 disclosed "All categories"; Q2 disclosed "Counting only: category Public Transport". Both traps built to expose a silent narrowing stayed quiet.
- **No crash and no 500.** Both calls returned `httpStatus 200`; the only console error in either run is the deliberately blocked font request.

**None of the three triggers was met, so no rollback is recommended. I have not rolled anything back and will not without your instruction.** Should you want one, the rollback target is Production deployment **`ailodge-expensetracker-r9vueizjw-wei-kai.vercel.app`** (`eaab1a5`, content-verified in §7.1); source rollback is `git revert --no-commit eaab1a5..88bd48d` plus one commit, and Pages is a normal revert commit on the current remote tip. **Never force-push.**

### 8.4 Artifacts

All **outside the repo** and uncommitted, in `…/scratchpad/pg-G3/`: `ledger.mjs`, `oracle.mjs`, `expectations.json` (written before the first call), `driver.mjs`, `result-Q1.json`, `result-Q2.json`, `shots/Q1-answer.png`, `shots/Q2-answer.png`. The two paid calls are in `scripts/eval/calls.log` under `step=publish-G3`, `set=LIVE_PAGES`, `retries=0` — the `set` distinguishes them from the seven earlier `publish-G3` calls, which were `LIVE_SERVER_LEG`. Every context was discarded at the end of its check. **Nothing was pushed, redeployed or changed in the application by Step G-lite.**

**Verdict: published and verified. 2 of 2 paid live checks exact, no rollback trigger met.**
