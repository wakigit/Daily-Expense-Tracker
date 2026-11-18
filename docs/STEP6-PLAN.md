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
| `81dc61a` | 2026-11-11 | every configured category is the absence of a filter — **post-model normalisation, not model-facing** |
| `9f00ee3` | 2026-11-11 | record why a bounded plan was refused |
| `24e6475` | 2026-11-10 | let a complete breakdown answer a recognised share question |
| `79ed805` | 2026-11-10 | one scope identity for either literal-description encoding |
| `29dd74f` | 2026-10-20 | integrate bounded plans behind the mock gate |
| `32353de` | 2026-10-20 | dormant bounded plan contract and pure executor |
| `3f760aa` | 2026-10-20 | align comparison decoding with canonical scopes |
| `d00aa91` | 2026-10-20 | checkpoint two-sided comparisons |
| `abf5209` | 2026-10-19 | bounded explicit OR filters |
| `4ad3e9e` | 2026-10-19 | tighten intent instructions for four misread families |

**Correction, and it matters: the cutoff is 2026-10-20, not 2026-11-11.** My first pass took the newest commit touching any file in that list, which is wrong — most of those November commits change what happens to the model's answer *after* it arrives, not what the model is asked. Separating the two **(all ran)**:

| What the model is actually sent | Newest change | Date |
| --- | --- | --- |
| `SYSTEM_PROMPT` (`provider.js:168-214`) | `3f760aa` — replaced the prose comparison section with a 4-rule decision table and 4 worked examples | 2026-10-20 |
| `PLAN_PROMPT` (`provider.js:84-89`) | `29dd74f` — introduced it; never edited since | 2026-10-20 |
| Intent schema and field order (`queryContract.js:134-188`) | `3f760aa` — added model-visible `description` strings, pinned `groupBy:null` and `aggregate:{enum:['total']}`, reordered `properties` so `operation`/`comparison` decode first | 2026-10-20 |
| Plan schema (`buildPlanSchema`, `planContract.js:158-176`) | `32353de` — introduced it; unchanged since | 2026-10-20 |
| Which prompt and schema a message gets (`planCapable`, `buildIntentRequest`) | `29dd74f` | 2026-10-20 |
| The `context` forwarded to the model (`provider.js:354-359`) | `f3a08f1` | 2026-10-18 |

**`git log -- backend/src/provider.js src/lib/queryContract.js` has no commit after 2026-10-20 at all. (ran.)** `81dc61a` touches `planContract.js` but **not** `buildPlanSchema` — verified, its diff contains no schema line — and the `planRequest.js` edits in `24e6475`/`81dc61a` sit behind the two `recognized:false` exits that `planCapable` returns on, so prompt and schema routing are unchanged since `29dd74f`. **The newest model-facing commit is `29dd74f`, 2026-10-20 15:44.**

**This makes the staleness argument different, and I am stating it the way the evidence supports rather than the way I first wrote it:**

- **71 of the 74 recordings are from 2026-10-19**, so they predate `3f760aa` (the prompt and schema rewrite, 2026-10-20 02:57) and `29dd74f` (plan prompt, plan schema and routing, 15:44) — **they were produced by a prompt and a schema that no longer exist**.
- The remaining 3 (`M66`, `M67`, `M76`, 2026-10-20) hold **502 error envelopes**, so they carry no model intent whatever their date.
- **The November work is post-model validation**, and the replay *does* exercise it — against stale inputs. That is exactly the P2 failure: the recorded M23 intent carried no `categories`, so the new coverage normalisation never fired, and the mock stayed green while the live model emitted a shape the recording did not contain.

**So what the replay cannot see is a change in the model's output distribution**, whether caused by the October prompt and schema rewrite or by ordinary model drift since. That is the thing a re-record fixes, and it is a stronger reason than a date gap. **(inferred from the commits and file contents above, all ran.)**

**Commits to `scripts/eval/recorded-intents.json`, all of them (ran):**

| Commit | Date | Subject |
| --- | --- | --- |
| `d00aa91` | **2026-10-20** | wip(ask): checkpoint two-sided comparisons with blocked live gate |
| `abf5209` | 2026-10-19 | feat(ask): support bounded explicit OR filters |
| `a46cfc6` | 2026-10-19 | test(eval): close Step3A final-code live coverage gap |
| `8d71dcf` | 2026-10-19 | test(eval): record Step3A handling results and honest live provenance |
| `bc07d50` | 2026-10-19 | test(eval): record the Step 2 MAIN score and refine two scoring details |
| `d774741` | 2026-10-19 | test(eval): add the evaluation harness and record the live baseline |

**Not one recording was produced by the prompt and schema in force today.** The three dated 2026-10-20 hold error envelopes; the 71 that hold real intents are all from the day before the prompt and schema were rewritten.

| | Count |
| --- | --- |
| Recorded turn-keys | **74** |
| Produced by a prompt/schema that no longer exists (2026-10-19) | **71** |
| Dated 2026-10-20 but holding a 502 envelope, so carrying no intent | **3** — `M66`, `M67`, `M76` |
| **Carrying a model intent produced by the current prompt and schema** | **0** |
| MAIN questions with **no** recording | **2** — `M47`, `M49` |
| MAIN turns with no recording | **8** — the 2 above plus 6 chain follow-ups |

**How chains are keyed:** `run.mjs:465` — `const key = question.turns ? \`${question.id}.${i + 1}\` : question.id;` — so the keyspace is per **turn**. Only the `.1` key of each chain is recorded (`M41.1`, `M42.1`, `M43.1`, `M44.1`, `M48.1`); the six follow-up turns `M41.2 M41.3 M42.2 M43.2 M44.2 M48.2` have no entry, because the client answers a follow-up locally without a model call. 69 plain keys + 5 dotted = 74. **(ran.)**

**The two with no recording at all are `M47`** (`scope-clarify`, *"How much did I spend on transport this month?"*, `questions.js:267`) **and `M49`** (`must-clarify`, *"What was my highest expenditure?"*, `questions.js:273`). Neither trips the `status: 599 no_recorded_response` guard at `run.mjs:93-96`, because the client answers both locally before any request. **(ran.)**

**Provenance is fully resolved: all 74 keys attributed, no unresolved cases.** The file was born complete at `d774741` with all 74 keys and has never gained or lost one; `HEAD:` and `d00aa91:` are the same blob, so no commit after 2026-10-20 altered any recording. Per-commit attribution — keys whose value that commit set, and how many survive at HEAD **(ran** — blob-by-blob comparison cross-checked against per-key patch attribution, both methods agreeing**)**:

| Commit | Date | Keys it set | Surviving at HEAD |
| --- | --- | --- | --- |
| `d774741` | 2026-10-19 | all **74** (file created) | 52 |
| `bc07d50` | 2026-10-19 | 15 — M18 M23 M34 M36-M40 M45 M48.1 M54 M63 M64 M72 M73 | 15 |
| `8d71dcf` | 2026-10-19 | 5 — M46 M50 M65 M66 M68 | 3 |
| `a46cfc6` | 2026-10-19 | 2 — M66 M68 | **0** |
| `abf5209` | 2026-10-19 | 1 — M68 | 1 |
| `d00aa91` | **2026-10-20** | 3 — M66 M67 M76 | 3 |

`a46cfc6` contributes nothing to the current file — both its edits were later overwritten — which `git log --stat` would hide. Note also that a pickaxe search is actively misleading here: `git log -S'"M23"'` returns only `d774741`, while M23's value was last set at `bc07d50`.

**The question texts have not moved.** All 103 MAIN and HOLDOUT text lines are identical between `d00aa91` and HEAD; the only post-recording changes to MAIN are the `outcome`/`expect` corrections for M65 and M67 (`a85f157`, `fa343b3`, both 2026-11-10). So the recordings are keyed to the same questions — they are stale in *model behaviour*, not mismatched to their prompts. **(ran.)**

**Two findings that matter more than the dates.**

1. **Of the 57 entries that carry a `query`, 56 have no `categories` field. Only `M68` has one.** The other 17 entries are 11 clarify/help/propose intents with no `query` object at all (`M46 M51 M53 M54 M63 M64 M65 M72 M73 M74 M75`) and 6 error envelopes, none of which should carry the field — so "56 of 57" is the honest denominator, not "73 of 74". The corpus is therefore almost entirely without the field the P2 fix normalises, and a replay over it cannot exercise the code path this release changed. **(ran.)**

   **One correction to my own framing:** the `categories` field is older than the November work — it has been in `src/lib/queryContract.js` since `f3a08f1`, 2026-10-18, and `M68` gained it at `abf5209`, 2026-10-19. What changed on 11 November is the *handling* of an all-ids value, not the field's existence. Git cannot separate "the field" from "the Step 3 semantics of the field", so the plan should not claim it can. **(ran** for the dates; the semantic distinction is **inferred**.**)**
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

1. **The corpus is uniformly obsolete, not mixed.** §1 found that **no** recording was produced by the prompt and schema in force today: 71 come from the day before that rewrite and the other 3 are error envelopes. 56 of the 57 query-bearing entries carry no `categories` field. A total built from them describes a system that no longer exists. Your default is right, and there is no fresh subset it would discard.
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

### The runner, read (ran)

`scripts/eval/run.mjs` needs no code change to run live against a local backend, and its defaults are already most of what we want:

| Flag | Default | Note |
| --- | --- | --- |
| `--mock` | **off, so live is the default** | there is no `--live` |
| `--holdout` | off | `SET = HOLD ? HOLDOUT : MAIN` (`run.mjs:76`) |
| `--endpoint <url>` | **`http://127.0.0.1:8787`** | already local; `VITE_ASSISTANT_URL` is dead here because the flag value always wins |
| `--label <text>` | **`baseline`**, or `holdout` with `--holdout` | names the result and scorecard files |
| `--max-calls <int>` | `Infinity` | spend ceiling — see the warning below |
| `--only <ids>`, `--note`, `--purpose`, `--step` | — | `--purpose`/`--step` only affect the `calls.log` line |

**The runner writes its own `calls.log` line** when live and `paidCalls > 0` (`run.mjs:623-624`), using `--step` and `--purpose`. So the new labels in §6 are passed as `--step step6-main` and `--step step6-holdout`; no hand-editing of the log.

**Three hazards, all of which must be handled before the first call. (ran)**

1. **`--max-calls` does not stop the run.** The throw is inside the `fetchImpl` (`run.mjs:102`), so it is swallowed by the client's `catch` (`src/lib/assistantClient.js:100-101`), returned as `reason:'unreachable'`, and scored as an **offline fail**. The run then continues to the end and writes a scorecard that looks like a catastrophic accuracy collapse. It does cap spend correctly and does not corrupt the recording file. **Rule: `--max-calls` is a spend fuse, not a stop. If it ever trips, the run is void — report it as void and do not score it.**
2. **A live run overwrites tracked files.** `scripts/eval/recorded-intents.json` (merged, not replaced), `scripts/eval/calls.log`, and — with the default label — **`results-baseline.json` and `SCORECARD-baseline.md`, both tracked**. **Rule: always pass `--label step6-main` and `--label step6-holdout`.** Never run with the default label.
3. **There is no pacing, delay or concurrency option, and the loop is a bare sequential `await` with no sleep** (`run.mjs:457-468`). Nothing throttles locally either: the 20/6/10 limits live in `api/_shared.js`, which only the Vercel Functions use, and `backend/src/server.js` is bare `node:http` with no rate limiter.

**Starting the backend:** `cd backend && npm start` → `node --env-file-if-exists=.env src/server.js`, which loads the gitignored `backend/.env`. Needs **`OPENAI_API_KEY`** (without it the route returns 503 and every turn goes offline); optional `OPENAI_MODEL` (default `gpt-4.1-mini`), `PORT` (default 8787), `HOST` (default 127.0.0.1). `ALLOWED_ORIGINS` is irrelevant — Node's `fetch` sends no `Origin`. Pre-flight `npm run verify` checks the key and model without a full run.

**Pacing — and a decision it forces.** The loop is already strictly serial, so nothing can stampede. But there is **no delay between calls**, and adding one is a code change to `run.mjs`. Under the §7 freeze no code may change after the freeze hash is taken, so either:

- **(a) run with no added delay** — serial calls at ~2-5 s of model latency each, which is already gentle, and keep the code untouched; or
- **(b) add a fixed inter-call delay first**, commit it, then take the freeze hash, which means the freeze commit is not the one you reviewed.

**My recommendation is (a).** A sequential run with a 10 s server timeout and a 12 s client timeout cannot exceed roughly 5 requests a minute, which is under the live Function's own 20-per-60-s limit, so a delay buys nothing we need. At that rate ~90 calls is roughly **5-12 minutes of wall clock**. **(inferred** from past per-call latencies; not measured for a full run.**)**

**Nothing else may be running.** No dev server, no Vercel preview being poked, no browser open on the app — any of those could add an unplanned paid call to the same key.

## 5. Scoring rules, fixed before any call

These are fixed now so that no rule can be chosen after seeing a number.

**A turn passes only if every one of these holds:**
1. **The figure is exact**, compared in **integer cents**, not floats and not rounded strings.
2. **The evidence rows are exactly the expected set** — the same fixture row ids, no extras and none missing.
3. **The date window matches** the expected start and end as literal dates.
4. **The filter disclosure matches**: a filter the question named is disclosed, and no filter the question did not name has been applied. **The harness does not check this.** I grepped `scripts/eval/` for `disclos|filterWording|filtersApplied`: the only hit is in `server-leg-checks.mjs`, a different suite, and on the answer path the soft `issues` array that would carry such a finding is always empty by the time it is tested (`run.mjs:447` is reachable only from the `propose_scope` branch). **(ran.)** So this rule is **not machine-enforced** — see decision 8 in §10.
5. **Where the expectation is a clarification, a clarification is what arrives** — and it must carry **no figure**. A clarification where an answer was expected is a fail, and an answer where a clarification was expected is a fail.

**Failures that are counted, never excluded:**
- **A 502, a timeout or any non-200 is a fail.** It is a result about the system, not an accident to be retried away.
- **An offline answer is a fail**, even when its arithmetic is right, because the question was whether the live path answers.
- **A refusal of a supported question is a fail**, even though it is the safe behaviour. §8 explains why that is the honest count.
- **A silent narrowing is a fail** even if the headline figure happens to match. In practice the harness catches most narrowings through the evidence-id and date-window comparisons rather than through the disclosure text, since a narrowed query almost always returns a different row set. A narrowing that returns the *same* rows and only misdescribes them would pass — that is the gap decision 8 addresses. **(inferred** from the scoring order.**)**

**What the harness actually asserts, confirmed by reading `scoreTurn` (`run.mjs:252-448`) (ran):** an offline source fails first and unconditionally; then outcome type (`clarify` and `unsupported` are interchangeable, answering with a figure where a clarification was due is scored as a *honesty* failure); then the shape family, **before** any figure, so an operation swap reads as misinterpretation rather than bad arithmetic; then the exact `start`/`end` date strings; then figures per shape in integer cents — including, for `breakdown`, a check that the groups re-sum to the grand total, and for `compare`, both sides' totals, the difference and **both** evidence-id lists; then exact ordered evidence ids. Plan expectations go through a deep recursive compare of every declared field (`plan-results.mjs:14-23`). Figures are read from the app's own typed output by `actual-figures.mjs:36`, which computes nothing itself.

**Multi-turn chains are scored twice over, and both numbers are published:** per **turn** (82 for MAIN) and per **question** (76), where a question passes only if **all** of its turns pass. MAIN has five chains — M41 (3 turns), M42, M43, M44, M48 (2 each). **(ran.)** This is the existing harness convention — the shipped figure is "70/76 questions, 76/82 turns" — and it is kept so the shapes stay comparable even though the vintage does not.

**`M66`, `M67` and `M76` currently score from the offline fallback, not from a model answer** — they replay a 502, so `scoreTurn` returns at the offline gate before any figure is compared, and `summary.offlineTurns` is 3. Their present pass/fail says nothing about the model. The same is true of `M55` and `M56`, which is why re-recording changes what these five measure for the first time. **(ran.)**

**The six known failures stay in the denominator: M46, M48.2, M65, M66, M67, M76.** No question is dropped, re-scoped or re-expected for this run. An expectation may change only for a documented capability reason, and no such change is planned here; if the run suggests one, it is written up and left for a later task, **after** the number is published.

## 6. Paid calls: exact count, cap, and cost

| | Turns | Turns that reach the model | Expected paid calls |
| --- | --- | --- | --- |
| MAIN, all re-recorded | 82 | **69** | **69** |
| HOLDOUT, once | 21 | ≤ 20 | **≤ 20** |
| **Expected total** | 103 | | **≈ 89** |
| **Hard cap for the session** | | | **103** |

**Why 69 and not 82. (ran)** In the last mock run, **13 of the 82 MAIN turns made no HTTP call at all**: the six chain follow-ups `M41.2 M41.3 M42.2 M43.2 M44.2 M48.2`, the two unrecorded questions `M47 M49`, and `M54 M55 M56 M62 M63`, which the client's own dialogue matcher and validation answer locally before any request. That short-circuit is client-side, so it applies in live mode too. **(inferred** for live, from the client code path; verified in mock.**)** The historical figure is 74 HTTP calls — the five now answered locally were requested back in October — so the count has fallen, not risen.

HOLDOUT's figure is **not** measured: it has one chain, whose follow-up turn (`H15.2`, *"Show those transactions."*) will be answered locally like MAIN's, and some of its 20 single-turn questions may be too. **The executing session must count HOLDOUT's actual requests rather than assume 21. (unverified.)**

**The cap is 103 and it is hard — but `--max-calls` is a fuse, not a brake (see §4).** `maxRetries: 0` is hardcoded at the live call site (`provider.js:382`), so the provider cannot retry behind our back. **(ran.)** A 502 is a recorded result, not a retry: the run moves to the next turn. If the runner dies part-way, the session stops and reports — it does not restart the set, because a partial replay plus a fresh start would double-count calls against the cap.

**Cost estimate — an estimate, from measured prompt sizes. (ran** for the sizes, **unverified** for the price.**)**

| Input | Measured |
| --- | --- |
| `SYSTEM_PROMPT` | 15,000 chars ≈ **3,750 tokens** |
| `PLAN_PROMPT` | 2,371 chars ≈ **593 tokens** |
| Model-visible context: **three** fields — `today`, `categories` (id + label), `expenseCount`. The client's `buildContext` also builds `hasData`, but the server **drops it** before the call (`provider.js:354-359`), asserted at `provider-errors.test.mjs:72`. No amounts, descriptions or dates leave the device | ≈ 394 chars ≈ **99 tokens** |
| Average question text | 51 chars ≈ **13 tokens** |
| Turns that take the plan prompt | **3 of 103**; the other 100 take the system prompt |
| Output ceiling | 700 ordinary, 4,096 plan (`provider.js:374`) |

So **≈ 3,866 input tokens per ordinary call** and ≈ 709 per plan call → **≈ 340,000 input tokens** for the ≈89 expected calls (≈390,000 if all 103 somehow fired), plus perhaps **10,000 output tokens** (an intent JSON is small; the 700/4096 figures are ceilings, not expected sizes). At gpt-4.1-mini list pricing **this lands well under US$1, most likely around US$0.15–0.25**. The token arithmetic is measured; **the price per token is from memory and must be confirmed against OpenAI's current pricing page before the session** — it is the one number here I cannot check offline. No token counts were recorded in past runs to calibrate against. Confirmed structurally: `provider.js` reads only `status`, `output_text` and `incomplete_details` and never touches `response.usage`, and `git log --all -S"response.usage"` finds nothing, so usage was never captured and then removed. `step4b1-provenance.json:192` records the same gap in its own words ("no tokens measured"). If you want calibration for next time, the capture point is `provider.js:382-388`, where the response object is already in hand.

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
8. **State exactly what the model receives** — three fields: `today`, the category id/label list, and `expenseCount` (`provider.js:354-359`; the client also builds `hasData` but the server drops it, asserted at `provider-errors.test.mjs:72`). That is one derived scalar more than "the category names and today's date" as `docs/PRD.md:208` and the draft changelog at `docs/PUBLISH-GATE-2026-11-11.md:280` put it. CLAUDE.md makes no claim about the context at all, so my earlier attribution to it was wrong. No amount, description or date is sent, so the architecture claim holds, but the published wording should not be looser than the code.
9. **What this evaluation cannot see** — model variance between runs; one fixture's data shapes only; a local backend rather than the deployed Function (CORS, the 20-per-60s limit and cold starts are untested by it); browser rendering; real users' ledgers; and that the recordings it writes will themselves go stale the next time anything model-facing changes.
10. **What would change the number** — the specific things that would require re-running, so the next session knows when this document expires.

## 10. Time estimate, and the decisions I need from you

**Execution session: 60–90 minutes.** Calls 5–12 min (§4, ≈89 of them); writing recordings and results ~10 min; `ASK-EVALUATION.md` 25–40 min; the standing commit gate ~5 min; handover ~5 min. **(inferred.)** It should be given a hard stop and told to commit partial work, since the §7 freeze forbids a casual second attempt.

**Decisions needed before it starts:**

1. **Re-record all of MAIN (§2), or only the stale subset?** My recommendation is all 82. Your default agrees.
2. **Confirm the 103-call cap**, or set it lower (which means cutting scope, not retrying less).
3. **Confirm gpt-4.1-mini pricing**, or accept the cost as "well under US$1, unverified".
4. **Confirm the §5 scoring rules as binding**, especially that an offline answer and a refusal of a supported question both count as fails.
5. **Confirm MAIN-then-HOLDOUT-once with no code change between**, and that whatever HOLDOUT scores is published.
6. **Confirm the output files.** The runner **merges** into the tracked `scripts/eval/recorded-intents.json` rather than replacing it, appends to the tracked `calls.log`, and writes `results-<label>.json` plus `SCORECARD-<label>.md`. With `--label step6-main` / `--label step6-holdout` those two are new files; with the default label it would **overwrite the tracked `results-baseline.json` and `SCORECARD-baseline.md`**. Confirm the labels, and confirm you want the merge into `recorded-intents.json` (the old values stay in git history either way). **(ran.)**
7. **Pacing: option (a), no code change, or option (b), add a delay before the freeze?** I recommend (a) — see §4.
8. **The filter-disclosure rule is not machine-checked (§5).** Three ways forward: accept it and spot-check the disclosures by hand on a sample; add an assertion to the harness **before** the freeze; or drop the rule and say so in `ASK-EVALUATION.md`. My recommendation is the hand spot-check, because adding an assertion means changing the harness in the same session that measures with it.
9. **`M62` holds a `400 message_required`.** Confirm whether that 400 is its expected outcome — if it is, it is not staleness and should be excluded from the "error envelope" count of six. **(unverified.)**
10. **Who writes `ASK-EVALUATION.md`** — the same session, or a later one reading the result JSON.
