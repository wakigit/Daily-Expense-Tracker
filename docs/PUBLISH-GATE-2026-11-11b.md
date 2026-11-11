# Publish prep for the P2 coverage fix, 11 November 2026 (b)

**Nothing has been pushed.** Production is `main` = `wallpaper-redesign` = **`eaab1a5`**, Pages `gh-pages` = **`31754c8`**, both published earlier today by [gate 11a](PUBLISH-GATE-2026-11-11.md) §11. This document covers the **next** candidate: the P2 coverage fix plus the two local-only records that were never pushed.

Claims are **ran** (executed, output read), **inferred** (follows from something ran) or **unverified** (not measured).

## 1. The candidate, and what is new since production

**Candidate = `17aff02`.** Five commits ship, all currently local-only on `checkpoint/2026-10-19-wip`:

| | | |
| --- | --- | --- |
| `addbb68` | docs | the §7 A–F execution record, shipped candidate and rollback target |
| `a28765a` | eval | Step G live check list — 4 paid calls, 3 exact, 1 refusal |
| `f707203` | eval | the three Step G2 diagnostic calls |
| **`81dc61a`** | **fix** | **every configured category is the absence of a filter, not a narrowing** |
| `17aff02` | eval | the two Step G2 live recheck calls |

**Exactly one commit changes runtime behaviour: `81dc61a`.** **(ran)** `git diff --stat eaab1a5..17aff02 -- src/ backend/` touches `src/lib/categoryCoverage.js` (new), `src/lib/intent.js`, `src/lib/intentLimitations.js`, `src/lib/planContract.js`, `src/lib/planRequest.js` and two test files. `api/`, `vercel.json`, `package.json`, `package-lock.json` and `src/lib/storage.js` are **not** in the diff, so §§3–5 of gate 11a carry forward unchanged: same CORS, same rate limits, same dependencies, same storage keys, **no migration**. **(inferred from the diff, which is ran.)**

## 2. What the fix does

Step 3 taught the model the explicit OR list, and it began writing `categories: [every configured id]` to mean "across all categories". The coverage guard compared that against the categories the **user** named, found none, and refused. One named normalisation — `src/lib/categoryCoverage.js` — removes the identity filter **before** ordinary-query validation and **before** bounded-plan step validation, on server and client alike. **The guard's five branch predicates are unchanged.**

It can only broaden, it is more faithful about orphan rows than the literal all-ids filter, it never fires when the user named a category, and it never fires when a `category_terms` entry does not map to a configured category. `descriptionTerms` is deliberately untouched — there is no "every description" identity.

The single FILTER_COVERAGE string that served five branches is split into `CATEGORY_COVERAGE` and `DESCRIPTION_COVERAGE`, with the OR-coverage text kept for the case it was written for.

## 3. Gates — all green at `17aff02` **(ran)**

| Gate | Result | vs the 11a baseline |
| --- | --- | --- |
| `npm run build` | pass | — |
| `npm run smoke` | **2383/2383** | +5 (was 2378/2378) |
| `eval:self-check` | pass | — |
| `eval:fixture-checks` | pass | — |
| backend `npm test` | **239/239** | unchanged |
| `eval:harness-checks` | **80/80** | +3 (was 77) |
| `eval:main:mock` | **70/76 questions, 76/82 turns** | **"No per-question change." Gate passed: no regression.** |
| `git diff --check` | pass | — |

Two pre-existing expectations were updated, both because the wording split is intentional and neither because behaviour regressed: `scripts/or-filter-checks.jsx` "omitted category" and `backend/src/assistant.test.mjs` "missing category" now expect `category_filter_coverage_incomplete`. **(ran)**

## 4. Live recheck — 2 paid calls, and an honest result

Server leg in process, `maxRetries: 0`, fresh fictional ledger, independent oracle. **(ran)**

| | Sentence | Result |
| --- | --- | --- |
| 1 | `Which weekday do I spend most on?` | **502 `invalid_intent`** — the model returned a **different shape this sample**: `category_terms: [all 7 labels]` with `categories: []` |
| 2 | `Which weekday do I spend most on Food & Drinks?` | **200 `analyze`**, scalar `category: food` honoured → *"Highest recorded weekday total: Saturday: S$24.80 total, 2 calendar occurrences. Counting only: category Food & Drinks."* — **matches the independent oracle exactly** |

**Read call 1 carefully, because it matters more than the fix.** It is **not** a regression from this change: normalisation is a no-op when `categories` is empty, so HEAD and `eaab1a5` behave identically on that shape. **(inferred, from the normalisation's own precondition, which is ran.)** It is a **second, pre-existing failure mode of the same sentence** — `category_terms` naming every category with no ids — which lands on `intent.js:151–152` and returns `invalid_intent`, so the client answers offline.

**Therefore: this fix is necessary but NOT sufficient for the P2 sentence.** It is proven for the shape that was actually captured refusing in production (G2a), which now answers and is pinned in the standing server-leg gate at zero cost. It does not make the sentence reliable, because the model emits at least two shapes for it. **(ran.)**

The symmetric extension — treat `category_terms` naming every configured category, with no ids and no category named by the user, as the same identity — is **not implemented and not approved.** It should get its own gate run.

## 5. Publication plan — waiting for "go"

Same procedure as [gate 11a §7](PUBLISH-GATE-2026-11-11.md#7-the-publication-plan--waiting-for-go), steps **A–F**, same rollback target.

**Step A — record state (changes nothing)**
```bash
git fetch --all --prune
git rev-parse HEAD main wallpaper-redesign gh-pages origin/main origin/wallpaper-redesign origin/gh-pages
git status --porcelain            # must be empty
git merge-base --is-ancestor main HEAD && echo FAST-FORWARD-OK
```
Rollback target is unchanged: **`ailodge-expensetracker-irrj2lx0i-wei-kai.vercel.app`** (Production at `6cf9345`). Note it still points at `6cf9345`, **not** at today's `eaab1a5` production. Promoting it would roll back **both** releases. *(unverified — the deployment URL is behind Vercel Authentication and cannot be read from here.)*

**Step B — publish source**
```bash
git checkout wallpaper-redesign && git merge --ff-only 17aff02 && git push origin wallpaper-redesign
git checkout main              && git merge --ff-only 17aff02 && git push origin main
git checkout checkpoint/2026-10-19-wip
```
**Verify:** `git ls-remote --heads origin` shows both at `17aff02`.

**Step C — Vercel Production.** Confirm in the dashboard that the new Production deployment's source commit is **`17aff02`** and status Ready. Externally I will reproduce the Vercel-shape build locally and byte-compare the served assets.

**Step D — Vercel live, free.** `/api/health`, `/` 200, `/assets/` prefix, CORS 204 + echoed origin for `https://wakigit.github.io`, no allow-origin for an unknown origin, no `localhost` in the bundle. **0 paid calls.**

**Step E — Pages artifact**, built from the clean checkpoint branch at `17aff02`:
```bash
VITE_BASE=/Daily-Expense-Tracker/ \
VITE_ASSISTANT_URL=https://ailodge-expensetracker.vercel.app/api \
npm run build
```
**Step F — publish Pages**, on the current remote tip, `rsync -a --delete --exclude .git --exclude .nojekyll`, commit `Publish frontend build from 17aff02`, normal push, **no force**. The `.nojekyll` exclusion is required: it exists on `gh-pages`, is not Vite output, and `--delete` would remove it.

**Step G is not in scope here** and is not approved.

**Rollback rule, unchanged:** roll back only for a wrong figure, a silently dropped filter, or a crash/500. A clarification on a supported question is a known limit. Source rollback is `git revert --no-commit <base>..HEAD` plus one commit; **never force-push.**

## 6. Blockers

**None that stop publication, and one that should shape how it is described.** **(inferred from §§1–4.)**

1. **The P2 sentence is still not reliable.** §4 call 1. The fix closes the captured shape; a second shape remains. Do not describe this release as "fixed the weekday question".
2. Two pre-existing defects were surfaced and **pinned by tests rather than fixed**: a scalar `category` the user never named has no coverage guard at all and silently narrows; and a `null` message reaches the user as the literal word "null". Neither is introduced here. **(ran.)**
3. All carry-forward limits from [gate 11a §9](PUBLISH-GATE-2026-11-11.md#9-blockers) stand, including the six failing MAIN questions and the stale 502 recordings.
4. **`eval:main:mock` cannot catch this class of bug.** It replays recorded intents, and the recorded M23 intent predates the `categories` field. The server-leg corpus now carries the captured G2a intent so that exact model output stays under the standing gate at zero cost. **(ran.)**
