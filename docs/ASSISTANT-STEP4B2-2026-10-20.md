# Step4B2: bounded plan integration, mock-only checkpoint

**Implementation and deterministic/HTTP checks pass. This gate is NOT fully accepted: the required browser visual/keyboard checks could not run because no browser connection was available. No live plan interpretation is claimed. Production remains `6cf9345`.**

## Baseline and boundaries

Started 2026-10-20 06:50:14 UTC on `checkpoint/2026-10-19-wip`, `32353dea8f539330b7249ec2a1d03e26a65d3358`. Tracked source was clean. The unexpected untracked `TallyAI/` media/project directory was identified and preserved without edits or staging. Published `6cf9345` is an ancestor. No repository AGENTS.md was found; user-supplied instructions apply. Read the Step4A design, B1 report, current runtime boundaries and latest comparison repair scorecard. The comparison repair remains locally accepted, with its historical failures and limitations preserved.

The first elapsed checkpoint was 07:21:42 UTC, 31m28s after start. Work finished before the 60/90/110-minute milestones; none of those deadlines was reached. Final timing/Git details are also saved outside tracked source under `/private/tmp/tallyai-step4b2/`.

Zero paid requests and zero real provider calls. No credentials loaded into the mock adapter, no provider verification command, HOLDOUT inspection/run/change, MAIN expectation/recording edits, dependency/model changes, storage migration, publication or next-stage work. `calls.log` has no new entry because no actual paid call occurred.

## Provider, validation and dispatch

- `backend/src/provider.js`: the existing bounded recognizer selects plan-capable decoding, with one coherent plan-only prompt and closed `plan|clarify` envelope. Ordinary and comparison-only decoders retain their existing schema/instructions. `buildIntentRequest` makes offline inspection possible; `requestIntent` accepts a client stub for tests. Exactly one SDK request, existing model, timeout 10000ms and `maxRetries:0`. Plan-capable ceiling **4096**; ordinary **700**. These are configured limits, not measured guarantees. Incomplete/truncated responses fail honestly, even if partial text happens to parse.
- `intent.js`, routes and assistantClient: the same structural validator and full-request audit run server/client with the same reference date. Old ordinary responses may omit plan or use null. Active/malformed plans, unknown fields, unknown categories, bad references and inactive-field conflicts reject. Well-formed unsupported/coverage failures become a fixed typed whole-request clarification, without a provider-outage label. A recognized multipart request cannot publish an ordinary one-sided total. Model category metadata is not semantic proof.
- `assistant.js::planFromIntent` dispatches through the accepted `executePlan`; App carries typed `planResult`, never reads money from prose. Current categories are checked again by the core. One immutable local expense/category/date snapshot supplies all base and derived values. No reviewed scope can enter a plan, and a base clarification blocks all financial parts.
- Diagnostic codes remain in structured diagnostics. Core clarification text no longer exposes internal reason identifiers as product prose.

Three integration defects received narrow repairs, without new operations: invalid reference dates no longer make every ordinary request look multipart; ambiguous grammar-like category vocabulary is considered only after a multipart candidate is detected; explicit extra count/average/question components cannot slip through as a single total. Comparison-only show wording, category conjunctions and quoted literal conjunctions retain their existing paths. These are routing/anti-partial barriers, not support for count/average plans.

Accepted limits/calculations are preserved: 1–4 total steps, common resolved period, at most two difference/percent_of results, base-cents references only, at least two displayed results, resource caps, static subset proof plus evidence containment, atomic ID handling and rational two-decimal share rounding. No matcher/date engine or calculation rewrite.

## App, session, evidence and presentation

The request ticket and shared publication barrier stop late responses after Stop, Clear or a newer ask. A Singapore date change while waiting asks for a fresh complete request before calculation. Current ledger changes while interpretation is pending are captured together after interpretation, rather than mixed across steps.

A tagged plan context replaces the previous eligible query only on successful publication. “Show those transactions” produces built-in numbered part choices bound to the historical answer ID. A derived choice shows both original input sets; it invents no difference transactions. Original numbering remains stable when only one historical part is shown. Selecting old evidence does not replace a newer ordinary query context. Unsupported period/amount/regrouping/exclusion amendments clarify. Failed plan clarification preserves previous eligible context. Independent ordinary questions restore ordinary follow-ups.

Per-base immutable evidence and category fingerprints feed sticky staleness. Derived results are stale if either dependency is stale; any stale part warns at answer level. Description/category edits with unchanged totals, additions/deletions, currency changes, category rename/removal and initially empty scopes are covered. An already stale answer still traverses newly changed parts. A selected unaffected historical part keeps its own accurate stale status. Figures, operands and row snapshots remain unchanged after edits/Undo.

`PlanAnswer` reuses the current bubble, section and evidence styles: numbered code-generated labels, every filter, common dates, total/count, full evidence access, signed subtraction and named input links. Share calculation is visible, for example `S$10.00 ÷ S$40.00 × 100 = 25.00%`. Zero denominator occupies a visible unavailable slot without a numeric percentage. Typed cents format directly using integers, preserving large safe values. Evidence initially renders 50 rows with an explicit next-page button and complete source count; calculation/evidence data are never truncated. Focus styles are present for links/buttons, but actual keyboard/visual acceptance remains unverified.

Source distinctions remain explicit: mock interpretation, model interpretation with local calculation, built-in historical interaction and labelled offline fallback. The isolated adapter preserves built-in source labels. Offline multipart input clarifies the whole question before residual-word parsing; provider/auth/network/validation errors retain honest notices.

## Independent expected versus actual results

All figures below are application calculations from independent fictional fixtures at reference date **2027-03-10**, not model or MAIN figures.

| Case | Expected and actual | Evidence/range | Coverage |
| --- | --- | --- | --- |
| A total/Food share | 4000/1000 cents; counts 3/1; **25.00%** | q1 p1,p2,p3; q2 p1; March 1–10 | Mock HTTP through real handler/client validation and calculator; static renderer |
| B total/Transit/difference | 4000/1200; counts 3/1; **+2800 cents** | q1 p1,p2,p3; q2 p2; March 1–10; left q1 minus right q2 | Same mock HTTP/calculation path; signed renderer |
| C literal-description share | 1800/7000; counts 1/6; **25.71%** | numerator p3, denominator p1–p6; **2026-12-11 through 2027-03-10**, 90 inclusive dates | Same mock HTTP/calculation path; literal substring disclosure |
| D zero denominator | 0/0, counts 0/0; typed unavailable, no numeric percentage | Empty January 1–5, subjects exist outside window | Mock HTTP and static visible-unavailable rendering |
| E unsupported component | Whole-request clarification, no partial plan/figures | Original full request retained | Mock HTTP + shared semantic checks |
| F edit/staleness | Original 4000/1000 and 25.00% frozen; affected base/derived stale. Fresh pending-request snapshot 4100/1100 and **26.83%** | Original IDs/operands retained | Deterministic session/evidence/client tests, not browser editing |
| G plan → those → choice | Choices q1,q2,d1 bound to answer 1; d1 selects both input sets | Historical identity/numbering preserved | Session/helpers and server-rendered buttons, not browser clicks |
| H plan → ordinary → follow-up | Ordinary total context restored; evidence p1,p2,p3 | No accidental plan-step inheritance | Deterministic client/calculation/session pipeline |
| I Stop/Clear/newer/date change | Deferred response cannot publish; midnight requires fresh complete request | Actual client mock transport deliberately ignores abort for late-response test | Shared App publication barrier/session tests, not mounted App browser actions |
| J one-sided model-shaped response | HTTP200 validated clarification, no partial figure | Full original multipart request retained | Mock HTTP handler/client audit |
| K OR/comparison/scope | OR p1,p2; elapsed comparison 4000 vs3000; reviewed scope stays a proposal until approval | Existing comparison/evidence/approval regressions retained | Mock HTTP plus existing automated suites; no browser claim |
| Malformed/provider failure | Invalid plan HTTP502 `invalid_intent`; timeout HTTP504 `provider_timeout`; offline multipart clarifies, labelled honestly | No validation weakening or semantic success substituted for provider failure | Mock HTTP and client/SDK-stub checks |

## Tests and evaluation provenance

Required gates pass: `npm run build`; smoke **2262/2262** (**89** added integration checks over B1); backend provider checks **39/39** and Node tests **230/230** (**22** new integration tests over B1); `git diff --check`. Eleven final isolated HTTP scenarios pass. The Vite build warns about a chunk above 500kB; no code-splitting redesign was added in this gate.

Additional checks cover closed schema construction, budgets/routing, SDK call count/retries/truncation, server/client normalization round-trip, missing current category IDs, omitted/invented filters, wrong periods/operands/units/evidence, complete typed extraction/scoring, whole-request offline handling, selective/sticky stale traversal, historical numbering, evidence-page bounds, exact cent display and ordinary/comparison/OR/scope regressions.

`plan-results.mjs` extracts typed parts/scopes/ranges/units/operands/figures/evidence/provenance and compares independent oracles. Harness dispatch uses tagged context, carries plan evidence choices and refuses a clarification as a numeric plan-oracle pass. Old scalar/comparison oracles remain separate. Unit assertions were updated only for the now-integrated plan contract/typed clarification reason. **No MAIN expectations or recordings changed.** No MAIN replay was run in this gate. The last report remains mixed-age 71/76 questions and 77/82 turns, not a new Step4B2 score or live plan evidence. M65's future plan-shaped numeric oracle and M67's stale unsupported expectation require their separately reviewed capability-based corrections. Historical comparison limitations/failures remain documented.

## Zero-call enforcement and browser limitation

Reproducible isolated adapter: `scripts/step4b2-mock-server.mjs`, port **8846**. It injects only registered fictional responses into the real handler, clears its own key environment, refuses unregistered routes and throws on any external fetch. SDK-construction tests use an explicit stub and a forbidden-network fetch. The HTTP runner permits only `127.0.0.1:8846`. No normal backend/frontend was restarted or stopped; the user's backend on **8787**, PID **52618**, remained running. Only the owned mock backend was restarted to import changed shared modules. No localhost5185 storage was accessed.

Prepared browser fixture: `/private/tmp/tallyai-step4b2/browser/`, isolated origin **127.0.0.1:5246**, fictional storage, explicit mock banner/reference date and disabled fictional roast preferences. Its injected transport and global fetch guard allow only same-origin mock intent/control/status routes. No browser storage was actually loaded or changed because no browser connection could be established.

Browser inventory returned no connected browser; native computer bridge startup failed. Attempting the stale previously documented Chrome ID was rejected by automatic approval review because the binding was unverified and could select a real user session. A fresh inventory again returned no browsers. No bypass was attempted. Consequently **1440×900, 390×844, visible focus, keyboard expansion/clicks, clipping/overflow and browser screenshots are unverified**. No screenshots were created or fabricated.

Local artifacts, excluded from commits: `/private/tmp/tallyai-step4b2/{build.log,smoke.log,backend.log,http-acceptance.json,mock-ledger.json,saved-plan-rendering.html}` plus the prepared fixture/Vite launcher. The saved HTML is explicitly a server-rendered mock artifact, not a screenshot or browser pass. Source fingerprints identify the isolated handler code. The local checkpoint remains unpublished.

## Remaining gate and exact next scope

First restore a verified browser connection and complete the requested mock matrix at both sizes against this checkpoint, including actual edits, evidence pagination, Stop/Clear/overlap, keyboard/focus and no-overflow checks. This is the specific remaining Step4B2 acceptance blocker.

Only under a separate live authorisation, verify the final checkpoint with populated target families A/B/C: exact whole/restricted scopes and common dates, independent totals/counts/IDs, directional difference and numerator/denominator, live model source with no fallback. Include a bounded unsupported-component check if authorised. Record actual calls with retries zero, preserve unrelated MAIN captures and stop on wrong scopes/figures or supported questions that only clarify. The 4096 ceiling has not been token-measured or tested against the provider here. No arbitrary multipart language, count/sum/ratio/percentage-change/derived-chain/multi-period/reviewed-scope plan support is claimed.

Recovery uses a focused normal revert of this local integration commit if needed, preserving accepted B1/comparison/OR history and unrelated user work. No reset/rebase/squash, automatic revert, publication, live call or next feature stage is authorised by this checkpoint.
