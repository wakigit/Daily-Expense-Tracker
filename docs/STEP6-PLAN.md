# Step 6: the final Ask evaluation — plan only, nothing spent

**Nothing in this document has been executed.** It is written to be reviewed before any paid call. Claims are **ran** (executed, output read), **inferred** (follows from something ran) or **unverified** (not measured).

Written 18 November 2026 on `dev` at `c37f387`. The run it plans is frozen at a commit named in §7.

## 0. What the run produces

One MAIN run and one HOLDOUT run against the live model at the production runtime, then `docs/ASK-EVALUATION.md`. MAIN is **76 questions / 82 turns**; HOLDOUT is **20 questions / 21 turns**. **(ran** — `questions.js` via `turnCount`.**)**

## 1. Inventory: every MAIN recording is stale

**The headline: 74 recorded intents, 0 fresh, 74 stale — and 2 MAIN questions have no recording at all. (ran)**

**The model-facing surface** is `backend/src/provider.js` (`SYSTEM_PROMPT` at :168, `PLAN_PROMPT` at :84, `buildIntentRequest` at :349, the `json_schema` wiring at :367), plus the contracts it imports: `src/lib/queryContract.js` (`providerQuerySchemas`), `src/lib/planContract.js` (`buildPlanSchema`), `src/lib/planRequest.js` (which prompt is chosen), `src/lib/comparisonRequest.js` (period hints), and `src/lib/intent.js` (`buildContext`, i.e. the field list the model receives).

**Commits to that surface, newest first (ran — `git log -- <the files above>`):**

| Commit | Date | What |
| --- | --- | --- |
| `81dc61a` | **2026-11-11** | every configured category is the absence of a filter, not a narrowing |
| `9f00ee3` | 2026-11-11 | record why a bounded plan was refused |
| `24e6475` | 2026-11-10 | let a complete breakdown answer a recognised share question |
| `79ed805` | 2026-11-10 | one scope identity for either literal-description encoding |
| `29dd74f` | 2026-10-20 | integrate bounded plans behind the mock gate |
| `32353de` | 2026-10-20 | dormant bounded plan contract and pure executor |
| `3f760aa` | 2026-10-20 | align comparison decoding with canonical scopes |
| `d00aa91` | 2026-10-20 | checkpoint two-sided comparisons |
| `abf5209` | 2026-10-19 | bounded explicit OR filters |
| `4ad3e9e` | 2026-10-19 | tighten intent instructions for four misread families |

**The cutoff is therefore 2026-11-11 (`81dc61a`).**

**Commits to `scripts/eval/recorded-intents.json`, all of them (ran):**

| Commit | Date | Subject |
| --- | --- | --- |
| `d00aa91` | **2026-10-20** | wip(ask): checkpoint two-sided comparisons with blocked live gate |
| `abf5209` | 2026-10-19 | feat(ask): support bounded explicit OR filters |
| `a46cfc6` | 2026-10-19 | test(eval): close Step3A final-code live coverage gap |
| `8d71dcf` | 2026-10-19 | test(eval): record Step3A handling results and honest live provenance |
| `bc07d50` | 2026-10-19 | test(eval): record the Step 2 MAIN score and refine two scoring details |
| `d774741` | 2026-10-19 | test(eval): add the evaluation harness and record the live baseline |

**The newest recording is from 2026-10-20. The newest model-facing change is from 2026-11-11.** Every recording therefore predates the cutoff by at least three weeks and by **four** model-facing commits, two of which (`79ed805`, `81dc61a`) changed how filters are decoded.

| | Count | Of |
| --- | --- | --- |
| Recorded keys | **74** | — |
| **Stale** (recorded before 2026-11-11) | **74** | **100%** |
| **Fresh** (2026-11-11 or later) | **0** | 0% |
| MAIN questions with **no** recording | **2** — `M47`, `M49` | of 76 |

**How chains are keyed:** only turn 1 of each chain is recorded — `M41.1`, `M42.1`, `M43.1`, `M44.1`, `M48.1` — so 69 plain keys + 5 dotted = 74. Later turns are follow-ups the client answers locally without a model call, which is why they have no recording. **(ran** — key list.**)**

**Two findings that matter more than the dates.**

1. **73 of the 74 recorded intents have no `categories` field at all.** Only `M68` has one. That field is what Step 3 taught the model to emit and what the P2 fix normalises, so the replay corpus is almost entirely pre-Step-3 in shape. A replay over it cannot exercise the code path this release changed. **(ran.)**
2. **Six keys hold an HTTP error envelope instead of a model intent**, so they can never score a figure. Verified by reading the stored values **(ran)**:

| Key | Stored envelope |
| --- | --- |
| `M55`, `M56` | `{"status":502,"body":{"error":"invalid_intent","detail":{"code":"intent_bad_field","field":"message"}}}` |
| `M66`, `M67`, `M76` | `{"status":502, … "field":"query.comparison"}` |
| `M62` | `{"status":400,"body":{"error":"message_required"}}` |

`M66`/`M67`/`M76` are the three already documented in `STATUS.md`. **`M55`, `M56` and `M62` are not, and this inventory is the first place they appear.** `M62` looks deliberate — a 400 for an empty message may be its expected outcome — but `M55` and `M56` are stale 502s of the same shape as the documented three. **The executing session must confirm whether `M62`'s expectation is the 400 before treating it as a defect. (unverified.)**

**Conclusion: there is no fresh subset to preserve.** The choice in §2 is not "all vs stale" but "all vs nothing", which settles it.


## 2. Recommendation: re-record all of MAIN in one pass

**Re-record all 82 MAIN turns. I found no evidence against it, and three arguments for it.**

1. **The corpus is uniformly obsolete, not mixed.** §1 found 74 of 74 recordings stale and none fresh: all were made on 19-20 October, before four later model-facing commits, and 73 of them lack the `categories` field entirely. A total built from them describes a system that no longer exists. Your default is right, and there is no fresh subset it would discard.
2. **The replay cannot see the failure class that actually shipped.** `eval:main:mock` replays recorded intents, so a change in *what the model now emits* is invisible to it. That is exactly how the P2 regression reached production: the recorded M23 intent predated the `categories` field, so the mock stayed green while the live path returned 502. **(ran** — gate 11b §6.4 and the §8 live results.**)**
3. **Partial re-recording cannot be reasoned about afterwards.** If only the stale ones are refreshed, every future question about the number ("was this measured before or after the coverage fix?") has to be answered per question, from this document, forever.

**The cost of the alternative is small, which is the only argument the other way, and it is weak.** Re-recording only the stale subset saves a fraction of ~$0.20 (§6). Saving pennies is not a reason to publish a number nobody can interpret.

**One real cost of re-recording all, stated plainly:** the current 70/76 is no longer a comparison baseline, because the old number came from mixed recordings. `ASK-EVALUATION.md` must therefore present the new figure as the **first** single-version measurement and **not** as an improvement or regression against 70/76. **(inferred.)**

## 3. HOLDOUT — frozen, and never sent to the model

**Frozen. (ran)**

| Check | Evidence |
| --- | --- |
| 20 questions, 21 turns | `questions.js` `HOLDOUT`, ids `H01`–`H20`; `turnCount(HOLDOUT)` = 21 |
| File hash | `scripts/eval/questions.js` sha256 `8194b3bd6af2945e61252be73453575985f32c877de775506e9f4725188984bd` |
| Last commit to touch the HOLDOUT block | **exactly one in its whole history**: `d07e4dd`, 2026-10-19, *"test(eval): add the evaluation fixture, oracle, question bank and self-check"* — `git log -L 363,392:scripts/eval/questions.js` |
| Later commits to `questions.js` | `a85f157` and `fa343b3` (both 2026-11-10) and `a9fcbff` (2026-10-19) touched the file but **not** the HOLDOUT block |

**Never sent, never recorded. (ran)**

| Check | Result |
| --- | --- |
| `H01`–`H20` or "holdout" in `scripts/eval/calls.log` | **none** |
| `H*` keys in `scripts/eval/recorded-intents.json` | **none** — its 74 keys are all `M*` |
| `"H01".."H20"` in any `results-*.json`, `SCORECARD-*.md` or provenance file | **none** |
| Every HOLDOUT question text searched verbatim across `calls.log` and every `.json`/`.md` in `scripts/eval/` | **no HOLDOUT-unique text appears anywhere** |

**One collision, and it is not a leak.** H15 turn 2 is the sentence `"Show those transactions."`, which is also turn 2 of **M41**. Its occurrences in six `results-*.json` files are M41's turns, not H15's. Excluding that one MAIN-shared sentence, no HOLDOUT text appears in any log, result, scorecard or provenance file. **(ran.)**

**Carry this into `ASK-EVALUATION.md` as a stated limitation, not as a pass:** H15's follow-up sentence is one the model has already been asked many times through M41, so H15 turn 2 is less unseen than the other 20 turns. It stays in the denominator either way.

## 4. Where the calls go: the local backend at the production runtime

**Not the live Vercel API.** `api/assistant/intent.js:13` sets `limit: 20` against a 60-second window per IP (`api/_shared.js:43`, `WINDOW_MS = 60_000`), and the Function answers a breach with **HTTP 429** (`api/_shared.js:168`). An 82-turn run from one IP would therefore record 429s, and under §5 a 429 is a fail — so the run would measure Vercel's firewall, not the model. **(ran.)**

**Run the backend locally instead, on the same code the production deployment is built from.**

**Runtime parity is already proven. (ran)** `git diff --stat 88bd48d HEAD` over the model-facing surface — `backend/src/provider.js`, `src/lib/queryContract.js`, `src/lib/planContract.js`, `src/lib/planRequest.js`, `src/lib/comparisonRequest.js`, `src/lib/intent.js`, `src/lib/categoryCoverage.js`, `backend/src/routes.js` — is **empty**. The only differences between HEAD and the shipped `88bd48d` are `CLAUDE.md`, `.gitignore`, five docs and two `calls.log` lines. So a local run at HEAD exercises byte-identical prompt, schema, validation and route code to Production, with the same model id `gpt-4.1-mini` (`provider.js:29`) and the same `maxRetries: 0` (`provider.js:382`).

**This parity check must be re-run at the freeze commit and pasted into `ASK-EVALUATION.md`.** It is the whole basis for calling a local run a measurement of the production runtime.

### What the executing session must read before it starts

I did not finish reading `scripts/eval/run.mjs` (33 KB) inside this planning session, so these are **open items, not assumptions**, and each must be confirmed from the code and written into `ASK-EVALUATION.md`:

- the flag that selects live mode rather than `--mock`, the flag that selects `HOLDOUT` instead of `MAIN`, and the `--label` used for the result file;
- the env var or flag that points the runner at a local backend instead of `https://ailodge-expensetracker.vercel.app/api`;
- whether the runner has any delay or concurrency control, or whether pacing must be added at the call site (**no code change is permitted after the freeze, so if pacing needs code, it lands before the freeze and the freeze hash is taken afterwards**);
- which tracked files a live run writes — at minimum `scripts/eval/recorded-intents.json` and a `results-*.json` — so the commit after the run is deliberate rather than a surprise;
- how the local backend is started and which env vars it needs (`OPENAI_API_KEY`, optionally `OPENAI_MODEL`, `ALLOWED_ORIGINS`), from `backend/src/server.js` and `package.json`.

**Known already (ran):** the server-side call site hardcodes `maxRetries: 0` and a 10 s timeout (`backend/src/provider.js:382`); the client adds a 12 s timeout and no retry (`src/lib/assistantClient.js`); and the local `node:http` server has no rate limiter of its own — the 20/6/10 limits live in `api/_shared.js`, which only the Vercel Functions use.


**Pacing.** The local server has no rate limiter of its own, so pacing exists only to be kind to the provider and to keep one slow call from cascading. **Plan: strictly serial, one request at a time, with a fixed delay between calls**, no concurrency. At ~2–5 s of model latency plus the delay, 103 calls is roughly **8–15 minutes of wall clock**. **(inferred** from per-call latencies in past live checks; not measured for a full run.**)**

**Nothing else may be running.** No dev server, no Vercel preview being poked, no browser open on the app — any of those could add an unplanned paid call to the same key.

## 5. Scoring rules, fixed before any call

These are fixed now so that no rule can be chosen after seeing a number.

**A turn passes only if every one of these holds:**
1. **The figure is exact**, compared in **integer cents**, not floats and not rounded strings.
2. **The evidence rows are exactly the expected set** — the same fixture row ids, no extras and none missing.
3. **The date window matches** the expected start and end as literal dates.
4. **The filter disclosure matches**: a filter the question named is disclosed, and no filter the question did not name has been applied.
5. **Where the expectation is a clarification, a clarification is what arrives** — and it must carry **no figure**. A clarification where an answer was expected is a fail, and an answer where a clarification was expected is a fail.

**Failures that are counted, never excluded:**
- **A 502, a timeout or any non-200 is a fail.** It is a result about the system, not an accident to be retried away.
- **An offline answer is a fail**, even when its arithmetic is right, because the question was whether the live path answers.
- **A refusal of a supported question is a fail**, even though it is the safe behaviour. §8 explains why that is the honest count.
- **A silent narrowing is a fail** even if the headline figure happens to match.

**Multi-turn chains are scored twice over, and both numbers are published:** per **turn** (82 for MAIN) and per **question** (76), where a question passes only if **all** of its turns pass. MAIN has five chains — M41 (3 turns), M42, M43, M44, M48 (2 each). **(ran.)** This is the existing harness convention — the shipped figure is "70/76 questions, 76/82 turns" — and it is kept so the shapes stay comparable even though the vintage does not.

**The six known failures stay in the denominator: M46, M48.2, M65, M66, M67, M76.** No question is dropped, re-scoped or re-expected for this run. An expectation may change only for a documented capability reason, and no such change is planned here; if the run suggests one, it is written up and left for a later task, **after** the number is published.

## 6. Paid calls: exact count, cap, and cost

| | Turns | Paid calls |
| --- | --- | --- |
| MAIN, all re-recorded | 82 | **82** |
| HOLDOUT, once | 21 | **21** |
| **Cap for the session** | | **103** |

**The cap is 103 and it is hard.** `maxRetries: 0` is hardcoded at the live call site (`provider.js:382`), so the provider cannot retry behind our back. **(ran.)** A 502 is a recorded result, not a retry: the run moves to the next turn. If the runner dies part-way, the session stops and reports — it does not restart the set, because a partial replay plus a fresh start would double-count calls against the cap.

**Cost estimate — an estimate, from measured prompt sizes. (ran** for the sizes, **unverified** for the price.**)**

| Input | Measured |
| --- | --- |
| `SYSTEM_PROMPT` | 15,000 chars ≈ **3,750 tokens** |
| `PLAN_PROMPT` | 2,371 chars ≈ **593 tokens** |
| Model-visible context: `today`, `categories` (id + label), `expenseCount`, `hasData` — `buildContext`, `src/lib/intent.js:308`. No amounts, descriptions or dates leave the device | 410 chars ≈ **103 tokens** |
| Average question text | 51 chars ≈ **13 tokens** |
| Turns that take the plan prompt | **3 of 103**; the other 100 take the system prompt |
| Output ceiling | 700 ordinary, 4,096 plan (`provider.js:374`) |

So **≈ 3,866 input tokens per ordinary call** and ≈ 709 per plan call → **≈ 390,000 input tokens** for all 103, plus perhaps **12,000 output tokens** (an intent JSON is small; the 700/4096 figures are ceilings, not expected sizes). At gpt-4.1-mini list pricing **this lands well under US$1, most likely around US$0.15–0.25**. The token arithmetic is measured; **the price per token is from memory and must be confirmed against OpenAI's current pricing page before the session** — it is the one number here I cannot check offline. No token counts were recorded in past runs to calibrate against, and I found none in `calls.log` or the provenance files within this session.

**New `calls.log` labels, checked against the 15 already used** (`1, 2, 3A, 3A-close, 3B1, 3B2, 3B2-repair, 4-accept, 4-repair, 4c-design, 4c-open-9.1, publish-G, publish-G2, publish-G3, publish-gate` — **ran**):

- **`step6-main`** — the 82 MAIN re-recording calls
- **`step6-holdout`** — the 21 HOLDOUT calls

Both are new. One line per call, or one line per set with `calls=N` if the runner writes the log itself; either way `retries=0` and the set name in `set=`.

## 7. Order and freeze

1. **Freeze.** The run is frozen at the `dev` tip at the moment the session starts. **At the time of writing that is `c37f387`**, but this plan's own commit will move it, so the executing session must record the actual hash and paste `git rev-parse HEAD` into `ASK-EVALUATION.md`. Re-run the §4 parity diff against `88bd48d` at that hash and paste it too.
2. **MAIN first**, all 82 turns, one pass. Write the recordings and the result JSON.
3. **No code change between MAIN and HOLDOUT.** Not a fix, not a wording tweak, not an expectation correction. If MAIN reveals a bug, it is written down and left; HOLDOUT still runs on the frozen code.
4. **HOLDOUT once.** Whatever it scores **is the number**. No fix-and-rerun, no second sample, no "best of".
5. **Then** write `ASK-EVALUATION.md`.
6. If anything blocks between 2 and 4, the session **stops and reports** with the partial result and the calls already spent. It does not improvise a second run.

## 8. Variance: one run is one sample

**Each run is a single live sample, and the model's output for the same sentence is not stable.** The measured case: the P2 weekday sentence was asked five times at the same commit and the model produced **four different encodings** — no filter, labels only (twice), ids + labels, and the grouping dimension in the category field. Four of the five answered; one refused. **(ran** — gate 11b §4.**)**

Therefore:
- **`ASK-EVALUATION.md` reports "X of 82 turns on one run, on this date, at this commit"** — never "X% accurate" and never "reliable".
- **No repeat runs to pick a better result.** A second run would only be legitimate as a declared variance measurement, published *alongside* the first with both numbers shown, and it is not in scope here.
- Where a question's result is known to vary, the write-up says so and points at the P2 evidence rather than implying stability.
- A turn that passes is evidence that the pipeline *can* answer that question, not that it always will.

## 9. Outline of `docs/ASK-EVALUATION.md`

1. **What this measures, and the one-sample caveat** — up front, not in a footnote.
2. **Setup and provenance** — freeze commit, the parity diff against `88bd48d`, model id, `maxRetries: 0`, local backend, pacing, the fixture, the date the calls were made, and the two `calls.log` labels with their call counts.
3. **Headline numbers** — MAIN per question and per turn; HOLDOUT per question and per turn; each as `X/Y`, with the date and commit beside them. No percentage without the fraction next to it.
4. **The scoring rules from §5, restated verbatim**, so the rules are visible with the numbers they produced.
5. **Failure taxonomy** — every failing turn in one table: id, question, expected, what arrived, and a class: *wrong figure*, *silent narrowing*, *refused a supported question*, *clarification where an answer was due*, *answer where a clarification was due*, *502 or timeout*, *offline fallback*, *evidence-row mismatch*. Counts per class.
6. **MAIN vs HOLDOUT** — whether HOLDOUT's unseen paraphrases score like MAIN, and the H15 turn-2 overlap noted honestly.
7. **Known gaps carried from `STATUS.md`** — the six MAIN failures; the unmeasured 4096-token plan ceiling; no screen-reader or physical-device audit; the plan feature's dependence on exact recognizer/model field agreement; the scalar-category narrowing documented in `ASSISTANT-SCALAR-CATEGORY-GUARD.md`; the weekday sentence's roughly 1-in-5 fallback.
8. **State exactly what the model receives** — `today`, the category id/label list, `expenseCount` and `hasData` (`buildContext`, `src/lib/intent.js:308`). That is two derived scalars more than "your category names and today's date" as CLAUDE.md and the PRD currently put it. No amount, description or date is sent, so the architecture claim holds, but the published wording should not be looser than the code.
9. **What this evaluation cannot see** — model variance between runs; one fixture's data shapes only; a local backend rather than the deployed Function (CORS, the 20-per-60s limit and cold starts are untested by it); browser rendering; real users' ledgers; and that the recordings it writes will themselves go stale the next time anything model-facing changes.
10. **What would change the number** — the specific things that would require re-running, so the next session knows when this document expires.

## 10. Time estimate, and the decisions I need from you

**Execution session: 60–90 minutes.** Calls 8–15 min (§4); writing recordings and results ~10 min; `ASK-EVALUATION.md` 25–40 min; the standing commit gate ~5 min; handover ~5 min. **(inferred.)** It should be given a hard stop and told to commit partial work, since the §7 freeze forbids a casual second attempt.

**Decisions needed before it starts:**

1. **Re-record all of MAIN (§2), or only the stale subset?** My recommendation is all 82. Your default agrees.
2. **Confirm the 103-call cap**, or set it lower (which means cutting scope, not retrying less).
3. **Confirm gpt-4.1-mini pricing**, or accept the cost as "well under US$1, unverified".
4. **Confirm the §5 scoring rules as binding**, especially that an offline answer and a refusal of a supported question both count as fails.
5. **Confirm MAIN-then-HOLDOUT-once with no code change between**, and that whatever HOLDOUT scores is published.
6. **Does the run write its recordings into `scripts/eval/recorded-intents.json` (a tracked file), or into a new file?** Overwriting the tracked file discards the old recordings from the working tree; they stay in git history either way.
7. **Who writes `ASK-EVALUATION.md`** — the same session, or a later one reading the result JSON.
