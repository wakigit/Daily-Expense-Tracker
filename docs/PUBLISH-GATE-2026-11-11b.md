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

**So: the sentence is materially better and still not guaranteed.** Four of five samples answered correctly where the release before this one answered none of them. One sample did not. Describe it that way and no other way.

## 5. Publication plan — waiting for "go"

Same procedure as [gate 11a §7](PUBLISH-GATE-2026-11-11.md#7-the-publication-plan--waiting-for-go), steps **A–F**, same rollback target.

**Step A — record state (changes nothing)**
```bash
git fetch --all --prune
git rev-parse HEAD main wallpaper-redesign gh-pages origin/main origin/wallpaper-redesign origin/gh-pages
git status --porcelain            # must be empty
git merge-base --is-ancestor main HEAD && echo FAST-FORWARD-OK
```
**Rollback target: the CURRENT Production deployment, which is `eaab1a5`.** Its deployment URL arrives in the "go" message and is recorded here then. **(unverified — not yet supplied.)**

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

**Step G is not in scope here** and is not approved.

**Rollback rule, unchanged:** roll back only for a wrong figure, a silently dropped filter, or a crash/500. A clarification on a supported question is a known limit. Source rollback is `git revert --no-commit <base>..HEAD` plus one commit; **never force-push.**

## 6. Blockers

**None that stop publication, and one that should shape how it is described.** **(inferred from §§1–4.)**

1. **The P2 sentence is better, not guaranteed.** §4. Every encoding of "all categories" now answers; a fourth shape, the grouping dimension written into the category field, still refuses. Do not describe this release as "fixed the weekday question".
2. **The scalar-category gap stays open, deliberately and on evidence.** A mention-guard would refuse **M59**, a legitimate Singlish question, plus 9 of 42 synonym and partial-label probes. Measured at zero cost before any guard was written, rejected, and written up in [ASSISTANT-SCALAR-CATEGORY-GUARD.md](ASSISTANT-SCALAR-CATEGORY-GUARD.md) with three designs worth measuring. **(ran.)** The literal `"null"` defect **is fixed** in `f7b280a`.
3. All carry-forward limits from [gate 11a §9](PUBLISH-GATE-2026-11-11.md#9-blockers) stand, including the six failing MAIN questions and the stale 502 recordings.
4. **`eval:main:mock` cannot catch this class of bug.** It replays recorded intents, and the recorded M23 intent predates the `categories` field. The server-leg corpus now carries the captured G2a intent so that exact model output stays under the standing gate at zero cost. **(ran.)**
