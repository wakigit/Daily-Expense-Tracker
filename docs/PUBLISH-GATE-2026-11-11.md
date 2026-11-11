# Publish prep for Steps 3–4, 11 November 2026

**Steps 3–4 were published on 11 November 2026.** §7 steps **A–F ran and passed**; the shipped source candidate was **`eaab1a5`**, not `9f00ee3`. Step **G is not approved** and has not run, so there is still **no live interpretation evidence** for this release. **0 paid provider calls, start to finish.** The execution record is [§11](#11-execution-record--7-steps-af-11-november-2026).

**§§0–10 below are the pre-publication record and are left exactly as written**, measured against `9f00ee3`. They are still accurate about the shipped code: `git diff 9f00ee3 eaab1a5` touches **only this file**, so `eaab1a5` adds no runtime change to anything §§0–6 measured. Where §§0–10 say "nothing was pushed" or "waiting for go", read §11 for what actually happened.

Every claim below is labelled **ran** (I executed it and read the output), **inferred** (follows from something ran) or **unverified** (not measured here).

## 0. The one code change in this task

`9f00ee3` — *a refused bounded plan now records why, without changing the refusal.*

`validateIntent` collapsed six distinct causes onto `plan_complete_request_required` and threw away `auditPlanRequest`'s reason, which is why the 12:21Z RECHECK-3 refusal cost a four-commit bisect to explain (see [Step 4C design §9.1](ASSISTANT-STEP4C-PLAN-CONFIRMATION-DESIGN.md#9-open-items-this-design-does-not-close)). The specific code now travels **beside** the reply, never inside the intent.

| Property | How it is held | Evidence |
| --- | --- | --- |
| The user-facing message does not change | the clarification object is built by the same `limitationClarification` call | **ran** — 8 server-leg cases assert the question string is byte-identical and the intent key set is exactly `options,question,reason,say,type`; 4 more assert `deepEqual` against a freshly built clarification |
| No question text, ledger row, description, amount or category label can leak | `PLAN_REASONS` is a closed allowlist beside `planFailure`; `planDiagnostic` maps anything else to `null` | **ran** — hostile-input table including `'__proto__'`, a trailing space, an array, a merchant name and a category label; every refusal case also asserts the code contains no digit and no fixture vocabulary |
| The intent stays valid on arrival | the diagnostic is a sibling of `intent` in the response body, which `assistantClient` ignores | **inferred** from `assistantClient.js` reading only `body.intent`, and **ran** via the existing client-revalidation assertions in `plan-integration.test.mjs` |
| A reason added to `planFailure` but not to the list | loses information, leaks nothing, fails a test | **inferred** from the allowlist design; the null-mapping half is **ran** |

Not covered, recorded rather than assumed: the anti-partial guard is not the plan branch, so **a model returning a non-plan type for a recognised plan request is still one of the collapsed causes.** There is an explicit passing assertion that it emits no diagnostic, so the limit is visible in the gate rather than in a comment. **(ran)**

Gates before the commit: build pass; smoke 2278/2278; provider checks 39/39; backend node tests **239/239** (+2); `eval:self-check` pass; `eval:fixture-checks` pass; `eval:harness-checks` **77/77** (was 49); `eval:main:mock` **70/76, "No per-question change"**; `git diff --check` pass. **(ran)**

## 1. Remote state, and the stale local Pages ref

**(ran)** `git fetch --all --prune`, then `git ls-remote --heads origin`:

| Ref | Remote | Local before | Local after |
| --- | --- | --- | --- |
| `main` | `6cf9345` | `6cf9345` | unchanged |
| `wallpaper-redesign` | `6cf9345` | `6cf9345` | unchanged |
| `gh-pages` | `5e0e67b` | `29fc463` (stale) | **`5e0e67b`** |

Refreshed with `git fetch origin gh-pages:gh-pages` — a fast-forward update of the local ref only. **No force, no checkout, no push.** It was a legitimate fast-forward: `29fc463` is an ancestor of `5e0e67b`. **(ran)**

Worth noting, because the 19 October gate assumed otherwise: **remote Pages is not behind production.** `5e0e67b` is `Publish frontend build from 6cf9345f6…` — the live Pages build already corresponds to live `main`. The 19 October gate's "remote Pages must be refreshed before later publication" referred to the *local ref*, and `d9ff6c0` (that gate's remote tip) is an ancestor of the current one. **(ran)**

## 2. Fast-forward and the ship list

**(ran)** `main` and `wallpaper-redesign` are both ancestors of `9f00ee3`, so publication is a normal fast-forward. **22 commits** would ship.

**Features (3)**

| | |
| --- | --- |
| `abf5209` | bounded explicit OR filters |
| `32353de` | dormant bounded plan contract and pure executor |
| `29dd74f` | bounded plans integrated behind the mock verification gate |

**Fixes (5)**

| | |
| --- | --- |
| `4eb37e5` | clarify recognised limitations without masking malformed intents |
| `3f760aa` | align comparison decoding with canonical scopes and elapsed dates |
| `79ed805` | one scope identity for either literal-description encoding |
| `24e6475` | let a complete breakdown answer a recognised share question (M69) |
| `9f00ee3` | record why a bounded plan was refused, without changing the refusal |

**Checkpoint (1)** — `d00aa91` `wip(ask): checkpoint two-sided comparisons with blocked live gate`. A mixed WIP commit, preserved rather than squashed, exactly as the 19 October gate preserved its own.

**Eval and docs (13)** — `8d71dcf`, `a46cfc6`, `f462c64`, `6ebbcac`, `fa343b3`, `d07fbf5`, `99fadbb`, `a85f157`, `adfa730`, `e75d92f`, `102ed61`, `cfecb0c`, `7773c47`. No runtime behaviour: scorecards, provenance, the standing MAIN gate, the harness reader, the server-leg gate, and the Step 4 acceptance/repair/4C documents.

## 3. Production builds, and the secret scan

Both configured builds ran clean from the candidate. **(ran)**

| Target | Command | Asset prefix | Assistant endpoint baked in | Runtime `localhost`/`127.0.0.1` |
| --- | --- | --- | --- | --- |
| Vercel | `VITE_BASE=/ VITE_ASSISTANT_URL=/api vite build` (matches `vercel.json` `build.env`) | `/assets/` | `` `/api` `` | **none** |
| GitHub Pages | `VITE_BASE=/Daily-Expense-Tracker/ VITE_ASSISTANT_URL=https://ailodge-expensetracker.vercel.app/api vite build` | `/Daily-Expense-Tracker/assets/` | `https://ailodge-expensetracker.vercel.app/api` | **none** |

Secret scan over both trees, with the configured key read from `backend/.env` and **never printed** (length only): **(ran)**

- exact key value — **absent** from both.
- last 12 characters of the key — **absent** from both.
- credential patterns (`sk-…`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ghp_…`, `AKIA…`, `BEGIN … PRIVATE KEY`) — one hit, `sk-capabilities`, which is the substring of the CSS class `ask-capabilities`. **False positive, confirmed by reading its context.**
- `VITE_` variable *names* surviving into either bundle — none.
- every `VITE_` variable the source reads — exactly `VITE_ASSISTANT_URL` and `VITE_BASE`. **Neither is or could carry a key**: the URL is public by nature and `backend/.env.example` states the rule in the file itself. `OPENAI_API_KEY` appears in no `VITE_`-prefixed form anywhere in `src/`, `scripts/` or `vercel.json`.
- `.env` files tracked by git — only `backend/.env.example`, which contains `OPENAI_API_KEY=` with an **empty value**. **(ran)**

**Unverified:** this is a scan of the two build outputs and the current tree, not a proof about arbitrary history. The 19 October gate's read-only history scan is not re-run here.

## 4. Existing users' stored data

**Unchanged. No migration, no clearing, no rename.** **(ran)**

`src/lib/storage.js` — the single seam between the app and localStorage — **is not in the diff** `6cf9345..9f00ee3`. The key set is identical at both commits:

`ww_exp`, `ww_cats`, `ww_bud`, `ww_name`, `ww_theme`, `ww_motion`, `ww_sample`, `ww_roast_preferences`, `ww_roast_cache`

**(ran)** Extracted independently from both trees (`git show 6cf9345:<file>` for every `src/**/*.js{,x}`) and compared: nine keys each way, no addition, removal or rename. `git diff 6cf9345..HEAD -- src/App.jsx` contains **no** changed line mentioning `localStorage`, `ww_`, `JSON.parse` or any migration.

**Inferred, and this is the point:** every Steps 3–4 change is in the Ask path — interpretation, validation, plan execution, evidence rendering and styling. None of it reads or writes a new stored shape, so an existing user's rows, categories, budgets, theme, name, motion preference, sample marker and roast preferences are loaded and written exactly as they are today. **A Pages user who opens the new build keeps everything and loses nothing.**

**Unverified here:** the 19 October gate's two seeded legacy snapshots were not re-seeded in this task. The argument above is a source-level equivalence argument, not a repeat of that browser observation. If you want the observation repeated before the "go", say so — it is ~15 minutes and 0 paid calls.

## 5. CORS and rate limits

**Unchanged.** **(ran)** `git diff --stat 6cf9345..HEAD -- backend/ api/ vercel.json` touches only `backend/provider.js`, `backend/routes.js`, `backend/package.json` (one npm-script line) and four test files. **`api/_shared.js`, `backend/src/server.js`, `api/assistant/*.js` and `vercel.json` are not in the diff at all.**

| Control | Value at `9f00ee3` | Changed since `6cf9345`? |
| --- | --- | --- |
| Pages/Functions CORS default | `CORS_ORIGINS ?? 'https://wakigit.github.io'`, exact origins, no wildcard | no |
| Local server CORS default | `ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,https://wakigit.github.io'` | no |
| Rate limit — `/api/assistant/intent` | 20 / sliding window / IP / instance | no |
| Rate limit — `/api/assistant/receipt` | 6 | no |
| Rate limit — `/api/assistant/roast` | 10 | no |
| Body caps | `MAX_BODY_BYTES` 8 KiB; image route `MAX_UPLOAD_BYTES × 4/3 + 8 KiB` | no |

**Dependencies: identical.** **(ran)** Parsed `package.json` and `backend/package.json` at both commits and compared `dependencies` + `devDependencies`: byte-identical both files. `backend/package.json`'s only change is adding `plan.test.mjs` and `plan-integration.test.mjs` to the test script. `package-lock.json` is not in the diff. **No new dependency ships.**

## 6. Mock browser smoke on the production artifact — 22/22

**(ran)** Driven against the **GitHub Pages production build** from §3, served statically at `http://127.0.0.1:5213/Daily-Expense-Tracker/`. The published bundle's own endpoint — `https://ailodge-expensetracker.vercel.app/api/assistant/intent` — is intercepted by Playwright and fulfilled from the **real `handleIntent`** with the provider request function stubbed by a fictional mock. **Every other external URL is aborted (fail closed).** `0` real provider calls per pass, and the mock refuses any unregistered message rather than inventing one.

Fictional ledger, hand-calculated before the run: this month to date (2027-05-01…05-12) **S$30.00** over 4 rows; Hawker Lunch **S$6.50** → **21.67%**; previous month matching dates (2027-04-01…04-12) **S$21.00**; descriptions mentioning Kopi or Teh **S$6.50** over 2 rows.

| | Case | 1440×900 | 390×844 |
| --- | --- | --- | --- |
| S1 | Home renders from the published artifact, month total S$30.00, no `NaN`/`undefined` | pass | pass |
| S2 | Add expense through the real form writes exactly one row at the typed amount | pass | pass |
| S3 | Ordinary question — "How much did I spend this month?" → S$30.00, source `model` | pass | pass |
| S4 | Comparison — both sides **and** the matching elapsed windows `2027-05-01 to 2027-05-12` vs `2027-04-01 to 2027-04-12`, S$30.00 vs S$21.00 | pass | pass |
| S5 | Explicit OR filter — S$6.50 across 2 transactions, both terms disclosed with the literal-substring caveat | pass | pass |
| S6 | Supported plan — numbered parts, S$30.00, S$6.50 and the visible `S$6.50 ÷ S$30.00 × 100 = 21.67%` | pass | pass |
| S7 | Unparseable plan — clarifies the **whole** request, **no `S$` figure anywhere**, no plan block | pass | pass |
| S8 | Offline fallback — request aborted, answer labelled `Answered offline`, source `offline` | pass | pass |
| S9 | No horizontal overflow | pass | pass |
| S10 | Only external requests are the two expected Google Fonts ones, all blocked | pass | pass |
| S11 | No unexpected console error | pass | pass |

S4 is worth reading twice: the app answers an implicit comparison over **matching elapsed dates**, not full calendar months. The April rows were placed inside the elapsed window deliberately so the assertion is a real two-sided figure rather than a trivial zero — my first run asserted the full-April total and failed, and the app was right.

The driver, the static server and the screenshots are local and **uncommitted**, consistent with the 19 October gate. Screenshots: `/private/tmp/claude-501/pg-shots/`.

**Unverified:** this is a mock interpretation path. The screenshots say "Model interpretation, calculated locally" because the browser cannot know its endpoint was intercepted. **They are not live evidence and not Vercel evidence.**

## 7. The publication plan — waiting for "go"

Execute **only** after an explicit "go". Each step says what it changes and how to verify. Stop at the first failure; a failed step is a stop condition, never permission to improvise.

### Step A — record the state you are about to change (changes nothing)

```bash
cd "/Users/weikai/python stuff/GitHub/Daily-Expense-Tracker"
git fetch --all --prune
git rev-parse HEAD main wallpaper-redesign gh-pages origin/main origin/wallpaper-redesign origin/gh-pages
git status --porcelain            # must be empty
git merge-base --is-ancestor main HEAD && echo FAST-FORWARD-OK
```

Then record, read-only, **the current Vercel Production deployment id and alias** — the rollback target. The local `vercel` CLI is **not installed** (`npx` refused rather than installing it, and installing a dependency is out of scope), so take this from the Vercel dashboard: *Project `ailodge-expensetracker` → Deployments → the one marked Production → copy its deployment URL/id*. **Do not skip this: without it, step H has no documented target.** *(unverified — I could not read it)*

**Recorded 11 November 2026, supplied by you from the dashboard:** the Production deployment at `6cf9345` was
`ailodge-expensetracker-irrj2lx0i-wei-kai.vercel.app`. **This is the Vercel rollback target.** What was and was not
confirmed about it from outside is in [§11.1](#111-step-a--state-recorded-changed-nothing).

### Step B — publish the source (changes GitHub `main` + `wallpaper-redesign`, and triggers Vercel Production)

```bash
git checkout wallpaper-redesign && git merge --ff-only 9f00ee3 && git push origin wallpaper-redesign
git checkout main              && git merge --ff-only 9f00ee3 && git push origin main
git checkout checkpoint/2026-10-19-wip
```

Fast-forward only, normal pushes, every commit preserved, **no force-push, no rebase, no squash**.

**Verify:** `git ls-remote --heads origin` shows `main` and `wallpaper-redesign` at `9f00ee3`.

### Step C — wait for Vercel Production

Vercel builds from `main` with `vercel.json`'s `VITE_BASE=/` and `VITE_ASSISTANT_URL=/api`. **Verify** in the dashboard that the new Production deployment's source commit is **`9f00ee3`** and its status is Ready. Stop if the commit association is wrong.

### Step D — verify Vercel live, free

```bash
curl -s https://ailodge-expensetracker.vercel.app/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://ailodge-expensetracker.vercel.app/
curl -s https://ailodge-expensetracker.vercel.app/ | grep -oE '(src|href)="/assets/[^"]*"'
# CORS: allowed origin -> 204 with the exact origin echoed; unknown origin -> no allow-origin header
curl -s -D- -o /dev/null -X OPTIONS -H 'Origin: https://wakigit.github.io' -H 'Access-Control-Request-Method: POST' https://ailodge-expensetracker.vercel.app/api/assistant/intent | grep -i 'access-control-allow-origin\|HTTP/'
curl -s -D- -o /dev/null -X OPTIONS -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: POST' https://ailodge-expensetracker.vercel.app/api/assistant/intent | grep -i 'access-control-allow-origin\|HTTP/'
```

`/api/health` is free and is **not** an interpretation check. **0 paid calls in this step.**

### Step E — build the Pages artifact from the published source

```bash
git checkout 9f00ee3 -- . 2>/dev/null; git status --porcelain   # or simply build from the clean checkpoint
VITE_BASE=/Daily-Expense-Tracker/ \
VITE_ASSISTANT_URL=https://ailodge-expensetracker.vercel.app/api \
npm run build
grep -oE '(src|href)="/Daily-Expense-Tracker/assets/[^"]*"' dist/index.html
grep -rc 'ailodge-expensetracker.vercel.app/api' dist/assets/*.js
grep -rhoE 'https?://(localhost|127\.0\.0\.1)(:[0-9]+)?' dist/ ; echo "(no output above = clean)"
```

The explicit env vars are **mandatory**: a bare `npm run build` embeds the development backend URL (`http://127.0.0.1:8787`) and must never be the published Pages artifact.

### Step F — publish Pages (changes the live GitHub Pages site)

```bash
git fetch origin gh-pages
git worktree add /private/tmp/pages-publish origin/gh-pages
rsync -a --delete --exclude .git dist/ /private/tmp/pages-publish/
cd /private/tmp/pages-publish
git status --short && git diff --stat          # review before committing
git add -A && git commit -m "Publish frontend build from 9f00ee3"
git push origin HEAD:gh-pages
cd - && git worktree remove /private/tmp/pages-publish
```

Based on the **current remote tip**, not an assumed old one. Normal commit, normal push, **no force**. Nothing touches any real user's browser storage — a static redeploy cannot, and §4 establishes the key set is unchanged.

**Verify:** `curl -s https://wakigit.github.io/Daily-Expense-Tracker/ | grep -oE 'assets/[^"]*'` matches the built filenames; the page loads; Ask reaches the Vercel endpoint.

### Step G — post-deploy live check list, **up to 4 paid calls, for separate approval**

**Not authorised by this document.** Approve it separately. `maxRetries: 0`, fictional data in an isolated browser profile/origin, each call logged in `scripts/eval/calls.log`. Stop publication-confirmation on any wrong figure, silent narrowing or refusal of a supported question.

| | Question class | Paid | What must be true |
| --- | --- | --- | --- |
| P1 | Named-month total — e.g. `How much did I spend in September?` | 1 | exact cents, the **full** calendar month as literal dates, complete evidence rows |
| P2 | Weekday-average — e.g. `Which weekday do I spend most on?` | 1 | groups all **seven** weekdays; must **not** silently become a Mon–Fri filter |
| P3 | Supported multi-part plan — e.g. `What did I spend this month, and what percentage was <a real category>?` | 1 | numbered parts, both totals, the visible `÷ … × 100 =` line, per-part evidence |
| P4 | Unsupported component — e.g. the P3 sentence plus `, then forecast next year?` | 1 | clarifies the **whole** request and states **no figure** |
| — | Credential-extraction refusal | **0** | built-in text, no request leaves the browser — report as zero paid calls |
| — | Empty submit | **0** | thread unchanged, Send disabled |

### Step H — rollback, revert-based, no force-push

> **Superseded for this release.** 23 commits shipped, not 22, so the enumerated list below is incomplete. The agreed
> form is `git revert --no-commit 6cf9345..HEAD` followed by a single commit, and the Vercel path is promoting the
> deployment id recorded in step A. Both are written out in [§11.7](#117-rollback-as-agreed-not-executed), together with
> the pre-agreed rule for *when* to roll back. **Never force-push.**

Source, if the new build is bad:

```bash
git checkout main
git revert --no-commit 9f00ee3 cfecb0c 7773c47 102ed61 e75d92f adfa730 a85f157 99fadbb 24e6475 d07fbf5 fa343b3 79ed805 6ebbcac f462c64 29dd74f 32353de 3f760aa d00aa91 abf5209 a46cfc6 8d71dcf 4eb37e5
git commit -m "Revert Steps 3-4 publication: back to the 6cf9345 behaviour"
git push origin main
git checkout wallpaper-redesign && git merge --ff-only main && git push origin wallpaper-redesign
```

A **new commit** that undoes the change. History is preserved and nothing is force-pushed. *(unverified — the revert has not been rehearsed; if any revert conflicts, stop and resolve deliberately rather than improvising)*

Faster alternative for Vercel alone: in the dashboard, **promote the deployment id recorded in step A back to Production.** That is a platform action, not a history rewrite, and it is the quickest way to restore the previous site.

Pages:

```bash
git fetch origin gh-pages
git worktree add /private/tmp/pages-revert origin/gh-pages
cd /private/tmp/pages-revert && git revert --no-edit HEAD && git push origin HEAD:gh-pages
cd - && git worktree remove /private/tmp/pages-revert
```

Based on the current remote tip, a normal revert commit, normal push. **Never force-push. Never reset a Pages branch to an assumed old tip.**

## 8. Draft changelog / README section for Steps 3–4

Plain words, no success rate, no "reliable".

> ### What's new in Ask
>
> **Compare two things.** Ask for two periods with the same filters — "compare my food spending this month with last month" — or two of your categories over one shared period. Both sides are shown with their exact date windows, their totals and the rows behind each one. If a question has more than two sides, or different filters on each side, Ask says so instead of answering a narrower question.
>
> **Search for two or more words at once.** "Show purchases mentioning Kopi or Teh this month" matches either word. The words are matched literally against your descriptions, case and spacing ignored — Ask is not recognising merchants, and it says which words it used.
>
> **Multi-part questions.** Ask can answer a question with several parts — a total plus one category's share of it, or two totals plus the difference between them. **It answers a multi-part question when it can match your request exactly, and refuses the whole request otherwise.** A refusal never gives you part of the answer: it tells you nothing was calculated and asks you to state the totals, one shared period, and the exact share or subtraction you want.
>
> **Every answer shows its working.** The dates it used, the filters it applied, how many transactions matched, and the transactions themselves. Multi-part answers number their parts and print the arithmetic, so a share is shown as `S$6.50 ÷ S$30.00 × 100 = 21.67%`.
>
> **Figures are always calculated on your device.** The AI only decides which question you asked. Your transactions, descriptions and amounts are never sent to it — only your category names and today's date. Every total is then computed locally, in whole cents, from your own rows.
>
> **When the AI is unreachable**, Ask falls back to matching your question on your device and labels the answer "Answered offline".
>
> **Your data is untouched.** This update changes nothing about how your expenses, categories, budgets, theme or settings are stored. Nothing is migrated, cleared or renamed.
>
> **What Ask still won't do:** several top items ("my 3 biggest buys"), what-ifs and savings plans, merchant identity or aliases, free-form edits to an approved set of rules, and references to earlier messages ("show those ones"). It asks rather than guessing.

## 9. Blockers

**None that stop publication.** **(inferred from §§1–6.)** Nothing here is a regression against production: `6cf9345` has no bounded plans, no OR filters and no two-sided comparisons at all, so Steps 3–4 are net-new capability behind the same validation, the same CORS allowlist, the same rate limits, the same dependencies and the same storage keys.

Carry-forward limits, unchanged and already documented — publish *with* them stated, not as if they were closed:

1. **Six MAIN questions still fail**: M46, M48.2, M65, M66, M67, M76. **(ran — `eval:main:mock` 70/76.)**
2. **M66, M67 and M76 hold stale HTTP 502 recordings**, so the replay cannot score their figures; `eval:harness-checks` covers M67's and M76's comparison figures locally instead. Re-recording costs paid calls. **(ran / inferred.)**
3. **The plan feature's real limit is the audit's field-identity requirement.** The literal-description encoding difference is tolerated; a model-resolved date range, a reversed step order, a truncated term or an unrequested filter each still refuse the whole request. Tabulated in [4C §9.1](ASSISTANT-STEP4C-PLAN-CONFIRMATION-DESIGN.md). Worst case is a refusal with no figure — never a wrong number. **(ran.)**
4. **The unread-approval risk in [4C §8.1](ASSISTANT-STEP4C-PLAN-CONFIRMATION-DESIGN.md) is open**, and is a reason *not* to ship plan confirmation casually later. It does not affect Steps 3–4, which have no approval step for plans.
5. **The 4096-token plan output ceiling is configured, not measured.** **(unverified.)**
6. **No live Vercel or live Pages verification exists for this candidate.** Everything in §6 is a mock path on a local server. Step G is how that gets measured, and it needs your approval. **(unverified.)**
7. **HOLDOUT untouched**, expectations unchanged. **(ran — not inspected, not run.)**

## 10. Recommendation

**Ready for your "go" on §7**, for the scope described in §8 and with the limits in §9 stated in the release notes. Describe the plan feature exactly as §8 words it — *answers multi-part questions when it can match the request exactly, refuses the whole request otherwise* — and attach **no pass rate and no claim of reliability** to it.

Two things I would want before "go", both cheap and both yours to decide:

- **The Vercel Production deployment id from step A.** Without it the fastest rollback path is undocumented.
- Optionally, **re-seeding the 19 October legacy snapshots** in the browser (~15 min, 0 paid calls) if a source-level equivalence argument is not enough for you on existing-user data.

Step 4C and Step 5 were not started. **The push, merge and deploy described in §7 A–F have now occurred — see §11.** Step G has not.

## 11. Execution record — §7 steps A–F, 11 November 2026

Executed on an explicit "go" for **steps A–F only**. **Step G is not approved and did not run.** Every figure below is **ran** unless labelled otherwise. **0 paid provider calls.**

**Candidate swap, and its precondition.** The shipped candidate is `eaab1a5`, not `9f00ee3`, and the swap was gated on a check that ran first: `git diff --name-only 9f00ee3 eaab1a5` returns **exactly one path**, `docs/PUBLISH-GATE-2026-11-11.md` (+300 lines), and `git diff 9f00ee3 eaab1a5 -- src/ backend/ api/ scripts/ vercel.json package.json package-lock.json` is **empty**. So `eaab1a5` ships the `9f00ee3` runtime plus this document, and every gate in §0 still describes the shipped code.

### 11.1 Step A — state recorded (changed nothing)

| Ref | SHA before publication |
| --- | --- |
| `HEAD` (`checkpoint/2026-10-19-wip`) | `eaab1a5` |
| `main` / `origin/main` | `6cf9345` |
| `wallpaper-redesign` / `origin/wallpaper-redesign` | `6cf9345` |
| `gh-pages` / `origin/gh-pages` | `5e0e67b` |

`git status --porcelain` empty; `main` and `wallpaper-redesign` both ancestors of `eaab1a5` → **FAST-FORWARD-OK**; **23 commits** would ship — §2's 22 plus `eaab1a5` itself.

**The rollback target, and exactly how far it was verified.** `ailodge-expensetracker-irrj2lx0i-wei-kai.vercel.app`.

- The deployment-scoped URL is **not anonymously readable**: it 302s to `vercel.com/login` with the body `Protected by Vercel Authentication`. The suggested alternatives — `vercel curl` and an authorised Vercel MCP connection — were both unavailable, consistent with §7 step A's note that the CLI is not installed.
- So the **public Production alias** was compared against a local build of `6cf9345` instead, built with `VITE_BASE=/ VITE_ASSISTANT_URL=/api` in a detached worktree. Reusing the repo's `node_modules` is legitimate here: `package-lock.json` is **byte-identical** at `6cf9345` and `eaab1a5`, and `package.json` differs only by the two added `eval:main:mock` / `eval:harness-checks` scripts.
- `index.html`, `assets/index-CQDIeiOl.css` and `assets/index-Bw3GjMO1.js` were all **SHA-256 identical** live-vs-local, and `/api/health` returned 200. **Live Production was serving the `6cf9345` build byte-for-byte.** That also incidentally proves this project's Vite build is reproducible between Vercel's builder and this machine.
- **Unverified, and it matters:** that the id `irrj2lx0i` *names* that Production deployment. No alias response header exposes a deployment id, so the binding rests on your dashboard reading alone. The consolation is that a wrong id most likely **fails to promote** rather than promoting wrong content, and the source-revert path in §11.7 needs no id at all.

### 11.2 Step B — source published

```
git checkout wallpaper-redesign && git merge --ff-only eaab1a5 && git push origin wallpaper-redesign
git checkout main              && git merge --ff-only eaab1a5 && git push origin main
git checkout checkpoint/2026-10-19-wip
```

Both merges reported `Updating 6cf9345..eaab1a5  Fast-forward`, **115 files changed, 54816 insertions, 272 deletions**; both pushes reported `6cf9345..eaab1a5`. **No force, no rebase, no squash; all 23 commits preserved.**

**Verified** — `git ls-remote --heads origin`: `main` = `eaab1a5`, `wallpaper-redesign` = `eaab1a5`, `gh-pages` = `5e0e67b` (untouched at this point). Local tree still clean, still on `checkpoint/2026-10-19-wip`.

### 11.3 Step C — Vercel Production

A local **Vercel-shape** build of `eaab1a5` (`VITE_BASE=/ VITE_ASSISTANT_URL=/api`) produces `assets/index-CaBZ-uKt.css` and `assets/index-CFbXn2jk.js`. The live Production alias serves **those filenames**, and `index.html` plus both assets are **SHA-256 identical** to that local build.

That is strong external evidence Production is built from `eaab1a5` — but it is **not** a read of the dashboard's commit association, which cannot be done from here. **You confirmed in the dashboard that the new Production deployment shows commit `eaab1a5` and status Ready** before steps E and F were allowed to run. *(the dashboard half is **unverified** by me, confirmed by you)*

### 11.4 Step D — Vercel live, free

| Check | Result |
| --- | --- |
| `/api/health` | 200, `{"status":"ok","service":"daily-expense-tracker-backend","providerConfigured":true}` |
| `/` | HTTP 200 |
| Asset prefix | `/assets/` only |
| CORS, `Origin: https://wakigit.github.io` | **204**, `access-control-allow-origin: https://wakigit.github.io`, `access-control-allow-methods: POST, OPTIONS`, `vary: Origin` |
| CORS, `Origin: https://evil.example` | **405**, and **no** `access-control-allow-origin` header |
| `localhost` / `127.0.0.1` in served JS | none |

The allowlist behaves as §5 describes: the exact origin is echoed, never a wildcard, and an unknown origin gets no allow-origin header at all. `/api/health` is free and is **not** an interpretation check.

### 11.5 Step E — Pages artifact built from the published source

Built from the **clean checkpoint branch at `eaab1a5`** — `git checkout 9f00ee3 -- .` was deliberately **not** run, on your instruction — with both variables explicit:

```
VITE_BASE=/Daily-Expense-Tracker/ \
VITE_ASSISTANT_URL=https://ailodge-expensetracker.vercel.app/api \
npm run build
```

| Check | Result |
| --- | --- |
| Asset refs in `dist/index.html` | `/Daily-Expense-Tracker/assets/index-CqIS4O3C.js`, `…/index-CaBZ-uKt.css` |
| Any asset ref **not** under `/Daily-Expense-Tracker/` | none |
| `ailodge-expensetracker.vercel.app/api` baked in | **2 occurrences** in the bundle |
| `localhost` / `127.0.0.1` anywhere in `dist/` | none |
| Working tree after the build | still clean (`dist/` is gitignored) |

**Secret scan over the artifact**, with the configured key read from `backend/.env` and **never printed** (length 164 only): exact key value **absent**; last 12 characters **absent**; `VITE_` variable *names* surviving into the bundle **none**. The credential-pattern sweep returned four `sk-…` hits — `sk-capabilities`, `sk-composite`, `sk-intro-text`, `sk-suggestions` — and all four are **false positives**, proven rather than asserted: the count of `sk-` in `dist/` is **44** and the count of `ask-` is **44**, so every single `sk-` occurrence is the tail of an `ask-` CSS class name.

### 11.6 Step F — Pages published

Built on the **current** remote tip `5e0e67b`, committed and pushed normally: `5e0e67b..31754c8`, **no force**.

**One documented deviation from the written plan, and the reason for it.** The plan's `rsync -a --delete --exclude .git` would have **deleted `.nojekyll`**, which exists on `gh-pages` but is not Vite output. That file is Pages infrastructure, and removing it would have handed the live site to Jekyll — a change to production nobody asked for. The rsync was run with `--exclude .nojekyll` added, which under `--delete` also protects it on the receiving side. Stale assets were still removed as intended. **This is the only departure from §7 as written, and it was caught by the plan's own "review before committing" step.**

Pre-commit review, read before anything was committed:

```
 D assets/index-CQDIeiOl.css      ?? assets/index-CaBZ-uKt.css
 D assets/index-FRl_6PKm.js       ?? assets/index-CqIS4O3C.js
 M index.html
```

The `index.html` diff is **exactly two lines** — the script `src` and stylesheet `href` swapped to the new hashes. Nothing else in the page changed. Resulting tree: `.nojekyll`, `assets/index-CaBZ-uKt.css`, `assets/index-CqIS4O3C.js`, `index.html`.

**Live Pages verification:**

| Check | Result |
| --- | --- |
| GitHub Pages build (API) | `status: built`, `commit: 31754c8`, `error: null`, 20.4 s |
| `https://wakigit.github.io/Daily-Expense-Tracker/` | HTTP 200, serving `index-CqIS4O3C.js` / `index-CaBZ-uKt.css` |
| `index.html`, both assets, served vs local `dist/` | **SHA-256 identical, all three** |
| `.nojekyll` | HTTP 200 — preserved and live |
| Ask endpoint in the **live** bundle | **3 occurrences** of `https://ailodge-expensetracker.vercel.app/api` |
| `localhost` / `127.0.0.1` in the live bundle | none |
| Stale `index-FRl_6PKm.js`, `index-CQDIeiOl.css` | **HTTP 404** — gone |

Final remote state: `main` = `wallpaper-redesign` = **`eaab1a5`**, `gh-pages` = **`31754c8`**.

**Worth recording for next time:** the first read of the Pages URL returned the *old* assets even though the build had succeeded — `cache-control: max-age=600` on the CDN. A cache-busted request showed the new build immediately, and the plain URL followed. **A stale first read is not a failed deploy**; check the Pages build API before concluding anything.

*(Minor, unexplained, harmless: Vercel's `/api/health` self-reported timestamps around `05:2x` UTC while GitHub's Pages build API reported `07:11` UTC for the same session. Gaps between my own successive calls matched on both sides, so this reads as clock skew in one service's reporting, not as a cached or stale response — `age: 0` and `uptimeSeconds: 0` on each health call. Noted rather than chased.)*

### 11.7 Rollback, as agreed (not executed)

**When to roll back** — pre-agreed, and deliberately narrow: **a wrong figure, a silently dropped filter, or a crash/500.** A **clarification on a supported plan question is the known limit** documented in §9.3, **not** a rollback trigger.

**Vercel** — promote the deployment id recorded in §11.1 back to Production. A platform action, not a history rewrite, and the fastest path.

**Source** — one revert commit covering all 23, replacing §7 step H's stale enumeration:

```
git checkout main
git revert --no-commit 6cf9345..HEAD
git commit -m "Revert Steps 3-4 publication: back to the 6cf9345 behaviour"
git push origin main
git checkout wallpaper-redesign && git merge --ff-only main && git push origin wallpaper-redesign
```

**Pages** — as §7 step H: worktree on the current remote tip, `git revert --no-edit HEAD`, normal push.

**Never force-push. Never reset a branch to an assumed old tip.** *(unverified — no revert was rehearsed; if one conflicts, stop and resolve deliberately)*

### 11.8 What this release still has no evidence for

Publication does not close §9, and nothing above should be read as if it did.

1. **No live interpretation evidence exists for this release.** Steps A–F are a build-and-serve proof: bytes, endpoints, CORS, headers. **Not one question was asked of the live site.** §6's 22/22 is a *mock* path on a local server. Step G is the only thing that would change this, and it is **not approved**.
2. The **six failing MAIN questions** (M46, M48.2, M65, M66, M67, M76) shipped as they were. So did the **stale 502 recordings** on M66/M67/M76.
3. The plan feature's **field-identity refusals** shipped as documented in §9.3 — worst case a refusal with no figure, never a wrong number.
4. The **4096-token plan ceiling** remains configured, not measured.
5. Existing-user data rests on §4's **source-level equivalence argument**. The 19 October legacy snapshots were **not** re-seeded, here or before publication.
