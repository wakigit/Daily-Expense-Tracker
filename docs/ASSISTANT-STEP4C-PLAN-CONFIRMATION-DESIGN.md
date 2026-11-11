# Step 4C design: plan confirmation

**Design only. No code was written, no behaviour changed, and no audit rule was touched.** 10 November 2026, branch `checkpoint/2026-10-19-wip`, reference date 2026-11-10.

The bounded multipart plan feature collapses every failure into one typed clarification. When the local grammar cannot fully parse a question, or parses it but encodes a field differently from the model, the app refuses and states nothing — even when the model has returned a plan that is valid, bounded and computable. This design proposes the missing third outcome: **show the plan as a reviewable proposal the user must approve before any figure is computed**, reusing the Stage 4 spending-scope approval and fingerprint machinery rather than inventing a second approval path.

## 1. The evidence this is built on

Three paid calls were spent on the **identical sentence** `what share of my last 90 days spending was at "Popular bookstore"?`, capturing the raw plan each time. No ledger row, description or amount was sent to the provider: the diagnostic builds its context with `expenses: []`. **That is not the same request the live run made** — it changes `expenseCount` from 6 to 0 in the provider's user content — so the flip rate below measures this prompt, not the live one. See the correction at the end of this section.

| Call | Model intent | Steps / derived | Recognizer | Differing fields vs recognizer | Local verdict on the captured plan |
| --- | --- | --- | --- | --- | --- |
| CAP-1 | `plan` | 2 / `percent_of` | `recognized=true ok=true` | **2** | — |
| CAP-2 | `plan` | 2 / `percent_of` | `recognized=true ok=true` | **2** | audit `ok`, validate `ok`, **35.34%** |
| CAP-3 | `plan` | 2 / `percent_of` | `recognized=true ok=true` | **2** | audit `ok`, validate `ok`, **35.34%** |

The two differing fields are the same on every call, and they are one scope written two ways:

```
step q2.descriptionTerms:  model=["Popular bookstore"]   recognized=[]
step q2.description:       model=null                    recognized="Popular bookstore"
```

**Flip rate: 0 / 3 on the `expenseCount: 0` prompt.** The captured plans for CAP-2 and CAP-3 are byte-identical; CAP-1's field diff is identical, so its q1 matched the recognizer exactly as theirs did. Two further paid calls on 11 November 2026, this time with the **live** context shape (`expenseCount: 6`), returned the same encoding and were accepted by the server: **2 / 2, 0 flips.** Five same-encoding samples across two prompts is still not a stability guarantee — the one call that mattered, at 12:21Z, was not captured.

Replaying the captured plans *exactly as the model returned them* through `auditPlanRequest`, `validateIntent` and `executePlan`:

```
auditPlanRequest = {"ok":true,"family":"restricted_share"}
validateIntent   = OK -> plan
executePlan      = plan_answer | totals [5800,2050] | share 35.34%
```

`category_terms` in the model's query is not a mismatch: `src/lib/planContract.js:42` deliberately renames `categoryTerms` to `category_terms` on the wire, and the recognizer's own plan carries the same key.

### Correction, 11 November 2026: this section over-read its own evidence

**The paragraph that stood here was wrong, and it was wrong in the same way as the thing it claimed to correct.** It asserted that `79ed805`'s fix held, that the model was stable, and therefore that the live clarification "came from the server leg" rather than from model variance. The first two are measured. The conclusion does not follow from them, and it was never tested — because the diagnosis that produced it replayed only the client chain.

Measured on 11 November 2026 through a server-leg replay (`scripts/eval/server-leg-checks.mjs`, zero paid calls): the real `handleIntent`, with the provider stubbed to return the CAP-2 plan verbatim, **accepts it — HTTP 200, `intent: "plan"`** — at `79ed805`, `24e6475` and HEAD, and refuses it only at `6ebbcac`, with `plan_request_coverage`. Two live paid calls on the same sentence with the live context shape returned the CAP-2 encoding both times and were accepted 200/plan. **There is no server-leg defect on this plan, and there never was one after `79ed805`.**

Two mistakes compounded here, and both are worth naming because they are easy to repeat:

- **`clarify` + `plan_complete_request_required` does not identify its own cause.** `src/lib/intent.js` collapses six distinct outcomes onto that one typed reason — a structurally invalid plan, a failed request audit, a structurally sound `answer`/`analyze`/`propose_scope`, any other non-`clarify` type, and the model's own `clarify` — and `auditPlanRequest`'s specific reason is discarded before the response is built. Reading "the server refused a valid plan" out of that response was an inference, not an observation. (The live adapter's `rawShape` log does establish one thing: at 12:21:22Z the model returned `type: "plan"`, 2 steps, `percent_of`. So the model did not itself clarify.)
- **The three captures did not reproduce the live request.** `raw-capture.mjs` builds its context with `expenses: []`, so the provider received `expenseCount: 0`; the live browser fixture sent `expenseCount: 6`. `buildIntentRequest` puts `expenseCount` in the user content, so **those were different prompts.** A flip rate of 0/3 on one prompt is not evidence of stability on another, and the raw plan behind the 12:21Z refusal was never captured at all — only its shape.

What remains true, and what this design still rests on: the captured plan is valid, the whole chain accepts it, and the refusal the user saw named nothing a user or a maintainer could act on. **The live 12:21Z plan differed from the capture in at least one field the audit compares, and which field is unknown and now unknowable.** The bounded failure surface is measured in §9.1.

So the design's premise holds in a weaker and more honest form: **a plan the app would accept, and a plan it must refuse, are indistinguishable to the person who asked.** A confirmation step makes the plan visible instead of collapsing it to one sentence. That is diagnostic value for the user and for us — independently of whether any particular refusal was correct.

## 2. What the user sees

A new answer kind, `plan_proposal`, published into the thread where a plan answer or a clarification would otherwise go. It states no aggregate and no derived figure.

> **I can answer this, but check my reading first.**
>
> **1. Total recorded spending**
> 2026-08-13 to 2026-11-10 · all categories · 5 recorded transactions
> *no amount limit · all days*
>
> **2. Spending with "Popular bookstore" in the description**
> 2026-08-13 to 2026-11-10 · matches the words *Popular bookstore* · 2 recorded transactions
> *no amount limit · all days*
>
> **3. Part 2 as a percentage of part 1**
> *percentage share · 2 ÷ 1*
>
> Recorded spending only. Missing logs can affect the result.
>
> `[ Calculate ]` `[ Edit my question ]` `[ Cancel ]`

Properties of that rendering, each deliberate:

- **Every step is numbered and named**, matching the numbering a plan answer already uses, so an approved proposal and the answer that follows read as the same object.
- **Each step shows its resolved period as literal dates**, never a relative phrase. `last 90 days` is already resolved to `2026-08-13 to 2026-11-10` in the proposal, because that is the window that will be used.
- **Each step shows a count, never a total.** A count tells the user whether the scope looks right; a total is the answer.
- **Every filter slot is printed, including the empty ones** — "all categories", "no amount limit", "all days". This is the anti-silent-drop rule in §4.
- **The derived step names its operands by their numbers**, the same wording `PlanAnswer.jsx` already uses (`2. … ÷ 1. …`), so approving the proposal is approving the arithmetic too.
- **`Calculate` is the only path to a figure.** `Edit my question` returns the original text to the composer unchanged — the Stage 4 affordance, not a new one. `Cancel` leaves the thread with no answer and no partial state.

The plain-words text is **mostly** existing rendering, but not entirely, and the gap matters for the estimate:

- **Free and already pre-execution.** `validatePlan` returns `{ok, plan, ranges}` (`planContract.js:117`) and `ranges[i]` is resolved by `resolveQueryRange` with **no row summation** — so literal dates are available before any figure exists. `activeFilterPhrases` (`src/lib/filterWording.js:49-58`) produces the filter sentence from the canonical query alone, and `SpendingScopeReview.jsx:20` already calls it with exactly the id→label adapter this needs.
- **Must be lifted out.** `interpretation.category` / `interpretation.period` are built inside `buildAnswer` (`queryEngine.js:112-113`), i.e. *together with the total*, so identical wording requires extracting that construction. `planPartLabel` (`src/lib/planPresentation.js:2-8`) reads `part.evidence.scopeCategories`, which only exists post-execution, so it needs a `cats`-based variant.

Neither is hard, but "render the same strings" is not free, and a reimplementation rather than an extraction is how the plan and its description come to disagree — the §8.2 risk.

## 3. When a proposal appears

The decision sits in `src/lib/intent.js`, at the branch that currently chooses between answering, clarifying and the plan path.

| Condition | Today | Proposed |
| --- | --- | --- |
| Model plan passes strict validation **and** the recognizer agrees field-for-field | plan answer | plan answer, unchanged |
| Model plan passes strict validation, recognizer **disagrees on encoding** or **cannot fully parse** the sentence | hard clarify | **plan proposal** |
| Model plan fails validation | hard clarify | hard clarify, unchanged |
| More than 4 steps, or more than 2 derived nodes | hard clarify | hard clarify, unchanged |
| Unsupported operation — any step that is not a plain `total`, or a derived node that is not `difference` / `percent_of` (`plan_operation_unsupported`) | hard clarify | hard clarify, unchanged |
| A reviewed spending scope inside a plan step | hard clarify — **structurally impossible**, `canonicalPlanQuery` rejects a non-null `spendingScope` | unchanged, and deliberately so: a plan never carries a Stage 4 scope, so the two approval flows cannot nest |
| Not recognised as multipart at all | ordinary path | ordinary path, unchanged |

The gate for a proposal is **strict validation of the model's plan**, not agreement with the recognizer. The recognizer stops being the thing that authorises a calculation and becomes the thing that decides whether a human needs to look first. Nothing that is invalid today becomes valid.

This also retires the over-blocking class of bug that `24e6475` fixed by hand. A recognised-but-unparsed message currently has no safe outcome except refusal, which is what made the anti-partial guard refuse complete breakdowns. With a proposal available, "recognised, not parsed, model plan valid" has a correct destination.

## 4. A filter can never be silently dropped

Three independent mechanisms, because this is the property whose failure would be worst: the user approves what they read, so anything the plan does that the text omits is an unreviewed calculation wearing a review.

1. **Render from the validated plan, exhaustively, by enumeration over the contract's own field list.** The proposal renderer walks every filter field the plan contract defines — not the fields that happen to be set — and prints a phrase for each, using an explicit "all"/"no limit" phrase when a field is inactive. A field added to the contract later with no phrase of its own is a **build-time failure**, not a silent omission: the renderer's field table is exhaustive over the contract and a missing entry throws.

2. **Approve a fingerprint of the plan, not a summary of it.** The approved object carries a fingerprint computed over the plan's canonical normalised form. `Calculate` recomputes it and refuses if it differs. So the figure can only ever come from the exact plan that was rendered.

3. **The rendered text is itself part of what gets checked.** The fingerprint covers the rendered phrase list alongside the plan. If a future change makes the plan and its description disagree, the mismatch surfaces as a refusal to calculate rather than as a figure with a misleading caption.

Point 1 is the one that actually prevents the risk; points 2 and 3 stop a drop from becoming a wrong figure after the fact.

## 5. What invalidates an approval

Reusing `src/lib/spendingScope.js` rather than writing a second approval mechanism. `previewSpendingScope` already returns a `fingerprint` over `{query, range, categories, rows}` where `rows` carries every matched row's `[id, date, description, category, amount, notes]` (`spendingScope.js:15`), and `confirmSpendingScope` re-previews on confirmation and returns `{kind: 'refresh', preview}` when the fingerprint has moved (`spendingScope.js:21`). That is exactly the invalidation this needs, one level up.

A plan proposal's fingerprint is the ordered list of its steps' scope fingerprints plus the canonical plan itself. Consequences:

| Event | Effect | Why it falls out of the fingerprint |
| --- | --- | --- |
| **Any ledger edit touching a matched row** — add, amend, delete, recategorise, change an amount or note | approval void, refreshed review required | row contents are in the fingerprint |
| **A row entering or leaving a step's window** | approval void | the row list changes |
| **Period rollover** — a relative period resolving to a different window because the date advanced | **not covered by the Stage 4 pattern as it stands — see below** | `today` is not in the fingerprint, and `App.jsx:468` re-previews with the proposal's *pinned* `referenceDate` |
| **Any plan field change** | approval void | the canonical plan is in the fingerprint |
| **A category renamed or removed** | approval void | `categories` is in the fingerprint |
| **A newer question, Stop, or Clear** | proposal discarded, never approvable | the existing session barriers already cover a pending proposal |

A refreshed review is a **new proposal that must be approved again**, never a silent re-run.

### Two gaps in the Stage 4 pattern this design must close rather than inherit

Reuse is the right call, but the existing mechanism does **not** cover everything this feature needs, and recording that is the difference between a guarantee and a claim.

- **Date rollover is invisible to the existing check.** `today` is not part of the fingerprint, and `approveScope` (`App.jsx:468`) deliberately re-previews with the proposal's *pinned* `referenceDate` rather than the live date. A scope approved at 23:59 and confirmed at 00:01 therefore re-previews against yesterday and the fingerprint matches. For a plan this is not acceptable: `last 90 days` and `this month` both move, and the user approved a window shown as literal dates. **The plan fingerprint must include the reference date**, so a rollover forces a refreshed review. There is a precedent for the rejection path — `assistantFollowup.js:109-113` already refuses publication with `reason: 'reference_date_changed'`, but it fires *before* a proposal exists, so it does not help here.
- **A candidate row's `currency` is not fingerprinted.** The six-tuple is `[id, date, description, category, amount, notes]`. `planEngine.js:65` hard-rejects non-SGD rows, so a currency edit between proposal and approval would change the plan's own validity while leaving the fingerprint identical. The plan fingerprint should include it.

Two further behaviours are inherited deliberately and should be stated rather than changed:

- **A pending proposal is never auto-refreshed on a ledger edit.** The staleness effect at `App.jsx:96-99` does not touch `scopeProposal`; the change is caught at the approve click. That is the right trade — a proposal that rewrites itself under the user's eyes is worse — but it means the proposal on screen can be out of date, and the refreshed-review notice is the only signal.
- **An approved scope is not revoked by a later ledger edit for follow-ups** (`assistantFollowup.js:100` inherits `approvedScope`, appending a prose notice instead). An approved plan's *answer* inherits the Step4B2 staleness behaviour — per-part and derived stickiness, dependency propagation — so nothing new is needed after `Calculate`.

## 6. What this does to the measured live pass rate

Honestly stated, because the acceptance report's "live numeric pass" language is what this task has been correcting.

Measured surface from the Step 4 acceptance review §3, and what each row would become:

| Phrasing class | Today | With confirmation |
| --- | --- | --- |
| Grammar parses, model agrees field-for-field | answer | answer (unchanged) |
| Grammar parses, *literal-description* encoding differs — the RECHECK-3 class | **answer already**, since `79ed805` folded the two encodings; measured again on the server leg 11 Nov | answer (unchanged) |
| Grammar parses, any **other** field differs — period resolved to explicit dates, reversed step order, a truncated term, an unrequested filter (§9.1) | clarify | **proposal → answer after one click** |
| Grammar cannot parse casual wording, model plan valid — the three not-recognized phrasings in §3 of that report | clarify | **proposal → answer after one click** |
| Period-less multipart (RECHECK-6) | clarify | **proposal**, with the period it would use shown as literal dates — which is the honest resolution of open item §7.2 |
| Over-limit, unsupported operation, invalid plan | clarify | clarify (unchanged) |

The RECHECK-3 row is the correction that matters here: the encoding class this design was partly motivated by **is already answered**, and the class that is still refused is the wider set of field disagreements in §9.1. The feature is still worth building, but it should not be sold on the one case that turned out to work.

**The claim this design does and does not make.** It does not widen what the app can compute, and it must not be reported as a higher pass rate on the same metric. It converts a class of silent refusal into a reviewed answer, which is a different and weaker claim than "the question is now answered". Any scorecard reporting this must count a proposal-then-approve as its own outcome, not as `answer` — otherwise the number improves because the bar moved.

The period-less row is the clearest win: the disagreement there is real (the model reads no period as all time, the recognizer defaults to this month), and the right resolution was never to pick one — it was to show the user which window would be used. That is what a proposal does.

## 7. Test plan

**Deterministic and mock, zero paid calls** — this is where the behaviour is established.

1. **Contract tests** (`backend/src/plan.test.mjs` style, fictional rows): a valid plan with an encoding difference yields a proposal; an invalid plan, a 5-step plan, a 3-derived plan and an unsupported operation each still yield a hard clarify; a proposal carries no total and no derived value on any field.
2. **Exhaustive-rendering test**: assert the renderer's field table covers every filter field the plan contract defines, by enumerating the contract rather than listing fields in the test. This is the test that fails when someone adds a contract field without a phrase — the §4.1 guarantee.
3. **Fingerprint tests**: approve, then (a) edit a matched row, (b) edit an unmatched row outside every window, (c) advance the clock past a period boundary, (d) rename a category, (e) mutate one plan field. Exactly (a), (c), (d), (e) must void the approval; (b) must not, or the feature is unusable.
4. **Barrier test**: no code path computes a base total or a derived value from a proposal that has not been confirmed. Assert on the typed result, not on rendered text.
5. **Smoke checks** (`scripts/plan-checks.jsx`): proposal rendering at both viewports, every filter slot present including inactive ones, operands named by number, no `S$` figure anywhere in a proposal bubble.
6. **Browser matrix additions** to the existing 26-case driver: approve → answer; cancel → no answer and no partial state; edit → original text returned unchanged; ledger edit between proposal and approval → refreshed review; Stop and Clear with a proposal pending.
7. **The mock blind spot must be closed for this feature.** `mockPlanIntent` *is* the recognizer, so a mock gate cannot by itself produce the encoding disagreement this feature exists to handle (acceptance review §7.4). At least one registered mock response must differ from the recognizer in a field the audit compares — the `descriptionTerms` / `description` pair measured in §1 is the obvious fixture, and it is real data rather than an invented case.

**Live set — small, bounded, and only after the above passes.** Four questions, one call each, cap 4, `retries: 0`, hand-calculated expectations written before the first call, on a fresh fictional ledger that is not MAIN, HOLDOUT or the mock fixture:

| | Question class | Expected |
| --- | --- | --- |
| L1 | The RECHECK-3 sentence | proposal, then the approved answer at 35.34% |
| L2 | A phrasing the grammar does not parse (casual wording, model plan valid) | proposal, then a correct approved answer |
| L3 | A period-less multipart request | proposal showing literal dates for the window it would use |
| L4 | An over-limit request (5 totals and 4 shares) | hard clarify, no proposal |

The live set proves routing and rendering against a real model. It does not prove figures — the deterministic suite does that, which is the lesson from M67 having a numeric expectation no replay ever evaluated.

## 8. Risks

1. **Users approve without reading — and nothing in this design stops them. OPEN RISK, not mitigated.**

   The question asked directly: *what stops a user approving a plan with a wrong filter without reading it?* **Nothing does.** The honest, complete answer is the plain-words rendering, and a rendering is not a control — it is an invitation to read that the user is free to decline. Enumerate what the three mechanisms in §4 actually do and the gap is unambiguous:

   | Mechanism | What it guarantees | Does it stop an unread approval? |
   | --- | --- | --- |
   | Exhaustive enumeration over the contract (§4.1) | every filter the plan carries, and every one it does not, appears in the text | **No.** It guarantees the text is complete, not that it was read |
   | Plan fingerprint on approval (§4.2) | the figure comes from the exact plan that was rendered | **No.** It binds the figure to the rendered plan, wrong filter included |
   | Rendered phrases inside the fingerprint (§4.3) | the plan and its caption cannot drift apart | **No.** Same: it protects consistency, not comprehension |

   All three defend against *the app misdescribing the plan*. None defends against *the user not reading a correct description*. Those are different failures, and only the first is addressed.

   What is genuinely available, and still only mitigation: counts but no totals, so there is nothing to skim for; resolved literal dates in the first line of each step, where a wrong period is most visible; a proposal short by construction, since the contract caps it at 4 steps and 2 derived nodes. Explicitly rejected: a confirmation checkbox or an enforced delay, both of which train dismissal and would convert this risk into a worse one — a user who has clicked through a friction gate has taken on more apparent responsibility while reading no more closely.

   **Consequences this design accepts and must be reported with:**

   - An approved proposal is **weaker evidence than it looks**. It shows the app disclosed its reading; it does not show the reading was checked. Any scorecard, report or user-facing claim that treats "approved" as "verified by a human" overstates it.
   - The failure mode is a **confidently wrong figure the user authorised**. That is worse than today's refusal in one specific respect: responsibility has moved to the user without their comprehension moving with it. §8.2's "worse than no review because the user has now taken responsibility for it" applies to this risk too, not only to a misleading phrase.
   - Therefore **a proposal must never be offered for a plan the app could have accepted outright.** Routing (§3) already does this — agreement goes straight to an answer — and it must stay that way, or the feature would be adding unread approvals to cases that needed none.

   **Recorded as an open risk.** It is not closed by this design, it is not closable by rendering, and the only real reductions available are out of scope here: narrowing *when* a proposal is offered (§3), and narrowing *what can differ* before one is needed (§9.1, §10).
2. **Plain-words rendering hides a wrong filter.** The sharpest technical risk: a phrase that reads correctly while the plan does something else turns review into theatre, and is worse than no review because the user has now taken responsibility for it. §4 is the whole answer — exhaustive enumeration over the contract with a build-time failure for an unphrased field, plus the rendered text inside the fingerprint. The test at §7.2 is the one that must not be allowed to rot.
3. **A proposal for a question the user did not ask.** If the model's plan is valid but means something else, a proposal invites approval of a misreading. Partly mitigated by rendering the resolved scope rather than the model's intent, so the user checks dates, filters and counts rather than a restatement of their own sentence.
4. **Two approval mechanisms drifting apart.** Mitigated by reusing `spendingScope.js`'s preview/confirm/fingerprint rather than copying it. If the plan case genuinely cannot reuse it, that is a signal to stop and review, not to fork it.
5. **Scope creep into a tool loop.** A proposal is a one-shot review of one validated plan. It is not an iterative negotiation, and `Edit my question` deliberately returns the original text instead of offering per-field editing.
6. **An approved plan outliving its data.** Addressed by §5, but the failure mode if the fingerprint is incomplete is a confidently wrong figure, so the fingerprint must cover row contents and not just row ids — which is why `spendingScope.js:15` already includes `[id, date, description, category, amount, notes]`.

## 9. Open items this design does not close

1. ~~**The server/client divergence measured in §1.**~~ **CLOSED, 11 November 2026 — there was no divergence.** Bisected through a new server-leg replay, zero paid calls: the real `handleIntent`, with the provider stubbed to return the CAP-2 plan verbatim and the same message and context shape, **accepts it (200, `intent: "plan"`) at `79ed805`, `24e6475` and HEAD**, and refuses it only at `6ebbcac` — at `src/lib/planRequest.js` `auditPlanRequest`, the coverage comparison now on lines 171–173, with `plan_request_coverage`. `79ed805`'s `planDescriptionKey` fold is what fixed it; `24e6475` did not touch the plan branch of `validateIntent` at all, which returns at line 96–103 before any of the code that commit changed. The hypothesis that the M69 fix re-routed recognised share questions before the plan audit is **false**.

   Two live paid calls on the RECHECK-3 sentence with the live context shape confirmed it end to end: both returned the CAP-2 encoding and both were accepted 200/plan.

   The replay is now permanent: `scripts/eval/server-leg-checks.mjs`, run by `npm run eval:harness-checks`, 16 cases. It is proven to bite — three fail at `6ebbcac`, one at `79ed805` (M69), none from `24e6475`.

   **What is still not explained**, and cannot be: the raw plan behind the 12:21Z refusal was never captured, only its shape (`type: "plan"`, 2 steps, `percent_of`). It differed from the capture in at least one field the audit compares. The candidate space is bounded, and was measured through the same replay:

   | Encoding the model might emit for this sentence | Server verdict |
   | --- | --- |
   | `q2.descriptionTerms: ["Popular bookstore"]` (CAP-2) | **accept** |
   | `q2.description: "Popular bookstore"` (recognizer's own) | **accept** |
   | the term lower-cased | **accept** |
   | the 90-day window resolved by the model into `period: "range"` with literal dates | refuse — `plan_request_coverage` |
   | the two steps in the opposite order | refuse — `plan_request_coverage` |
   | the merchant mapped onto a category id | refuse — `plan_request_coverage` |
   | a truncated term (`"Popular"`) | refuse — `plan_request_coverage` |
   | `dayCount` off by one | refuse — `plan_request_coverage` |
   | mixed periods across the two steps | refuse — `plan_common_range` |
   | the denominator narrowed by the same merchant | refuse — `plan_request_coverage` |
   | both description encodings set at once | **HTTP 502 `invalid_intent`** |
   | the merchant placed in `category_terms` | **HTTP 502 `invalid_intent`** |

   The two 502 rows are excluded by the observation that the live run returned 200, so the 12:21Z plan was one of the `plan_request_coverage` / `plan_common_range` class. **`PLAN_PROMPT`'s phrase "one common *resolved* period" is the most plausible invitation to the first row of that class** — the ordinary `SYSTEM_PROMPT` says "do not calculate dates yourself" and the plan prompt does not. Unproven, and deliberately not patched here: changing a prompt to fix a single uncaptured call is how a prompt accumulates unmeasured rules.

   **This therefore stops being a prerequisite for Step 4C and becomes its subject.** The real limit is the audit's field-identity requirement across the encodings above — §6 and §10, not a routing defect.

   **One defect does stand, and it is diagnostic rather than behavioural:** `src/lib/intent.js` discards `auditPlanRequest`'s specific reason, collapsing six causes onto `plan_complete_request_required`. That is correct for the user — a refusal must not leak which internal gate fired — but it left the server with no record of its own decision, which is why this took a bisect instead of a log line. A server-side diagnostic log of the audit reason, carrying no ledger text and no model values, would be a real improvement and is not attempted here.
2. **M66, M67 and M76 hold stale HTTP 502 `invalid_intent` recordings.** The replay falls back to the offline path and `scoreTurn` returns before any figure is compared, so these three questions cannot be scored on figures by `npm run eval:main:mock` at all. `npm run eval:harness-checks` covers M67's and M76's comparison figures locally, but the recordings themselves are stale against the current server schema and **need re-recording in Step 6**, at one paid call each.
3. **The 4096-token plan ceiling is configured, not measured.** A proposal adds no provider output, so this design does not change it — but it remains unmeasured.
4. **M46, M48.2 and M65 still fail.** Untouched here.

## 10. Rejected alternative: widening the grammar

The obvious alternative is to make `recognizePlanRequest` parse more sentences. **Rejected**, for two reasons that the measurements in this repair make concrete.

**Coverage by enumeration does not scale.** The Step 4 acceptance review §3 measured that removing "in total", removing "of that", title-casing a category, or dropping the question mark each breaks recognition, and that `show me my total spending …` fails where `show my total spending …` succeeds — a one-word difference. Each is a separate rule, every rule is a place a future sentence can still miss, and the review's own §7.3 warns that the phrasings it measured must not be special-cased because they are that task's test sentences. A grammar built by accumulating cases has no point at which it is done, and its failure mode is always the same silent refusal.

**More decisively: parsing the sentence is not sufficient.** RECHECK-3 is a sentence the grammar *does* parse — `recognized=true ok=true` on all three calls in §1 — and it was still refused in the live run. Widening the grammar would not have helped it at all. The constraint is the requirement that the model's plan and the recognised plan agree field-for-field, plus whatever refused it on the server leg; sentence coverage is a different axis from the one that is actually failing.

Widening may still be worth doing later as an *ergonomic* improvement, so that common phrasings reach an answer without a review step. It is not a substitute for confirmation, because it cannot address a disagreement between two valid encodings of the same scope — and that disagreement is what the measurements in §1 actually show.

## 11. Size

| Piece | Estimate |
| --- | --- |
| ~~Root-cause the §9.1 server/client divergence~~ — **done, 11 Nov 2026; no defect found, replay now permanent in `eval:harness-checks`** | — |
| `plan_proposal` result type, contract and the `intent.js` routing branch | 45–60 min |
| Exhaustive proposal renderer with the build-time field-table check | 45–60 min |
| Plan-level fingerprint, approve/confirm/refresh reusing `spendingScope.js` | 45–60 min |
| Session wiring: pending proposal, Stop/Clear/newer barriers, approved-plan handoff to the existing answer path | 30–45 min |
| Deterministic tests 1–5 and the mock-blind-spot fixture (7.7) | 60–75 min |
| Browser matrix additions | 30–45 min |
| Live set of 4, cap 4 | 20–30 min |

**Roughly 5–6.5 focused hours**, split into independently gated commits in that order. The uncertainty is concentrated in the renderer and the fingerprint; the routing branch is small.

**Do not implement from this document alone.** Item §9.1 is now resolved: there is no routing defect, a proposal can reach the browser, and the routing design in §3 stands. What that resolution changes is the *motivation* — the RECHECK-3 encoding class already answers (§6), so the feature's case now rests on the wider field-disagreement surface in §9.1 and on the unread-approval risk in §8.1 being accepted as open. No implementation, publication or live call is authorised by this design.
