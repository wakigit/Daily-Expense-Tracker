# TallyAI — hackathon roadmap

**Rewritten:** 2026-10-17, against the code and the git state, not against the
previous draft. **Stage 0 was executed and verified on 2026-10-17** — see its
entry below; everything from Stage 1 on is still unstarted. **Read with:** `docs/PRD.md` for what each stage means and
`docs/RESUME.md` for the state of the working tree.

> **This document replaces the 2026-10-05 roadmap.** That plan was built around
> a cat mascot ("Tally"), an "Ask Tally" panel and bank statement import with a
> reconciliation queue. All of those are **removed from the product** — cut, not
> deferred; see `docs/PRD.md` §7. Two features the old plan listed as
> unstartable are now **built**: the laptop layout and receipt scanning.

---

## Where the build actually stands

Verified 2026-10-17 by running the suites and reading the source.

| | |
|---|---|
| **Built and verified** | Tracker core · three live wallpapers with three-step decay in two compositions each · laptop layout · typed AI Assistant (5 intents, 9 metrics, 7 periods) with offline fallback · voice entry into the Add form · receipt scanning · backend with server-side key handling |
| **Checks** | 518 frontend (`npm run smoke`) **all passing** since Stage 0 · 27 backend (`cd backend && npm test`) · `npm run build` clean |
| **Committed** | Stage 0 landed the tree as six commits on `wallpaper-redesign` (`311f94f`…`717d6f2`, re-cut as `0b4c8db`…`717d6f2`). The branch is **local only — not pushed** |
| **Deployed** | `gh-pages` was rebuilt and pushed in Stage 0 (`29fc463`) and the live URL serves the current build. `main` is still **23 commits behind** and untouched by decision |

The base is further along than a typical hackathon week-one project. **The
remaining work is depth on what exists, not new pillars.** The risk that used
to top this list — "is the thing judges open the current build" — was closed by
Stage 0 on 2026-10-17. What remains is depth, and keeping the deploy current
(Stage 8).

---

## Two demo paths, and they are not the same demo

This is the decision the earlier drafts of this roadmap fudged, and it changes
what Stage 8 can claim.

`src/lib/assistantClient.js:23` sets the backend endpoint to
`http://127.0.0.1:8787` unless `VITE_ASSISTANT_URL` is set at **build** time.
`src/lib/receiptClient.js` reuses the same constant. **`127.0.0.1` is whatever
device the page is open on** — so on a judge's phone it is the judge's phone,
where nothing is listening. It is not, and cannot be, the presenter's laptop.

There is **no backend deployed**, so the public URL has no server to reach even
in principle.

### Path A — the public GitHub Pages URL, no hosted backend

What a judge gets on their own phone or laptop, with nothing of mine running:

| Works | Does not work |
|---|---|
| The whole tracker: add, edit, delete, undo, swipe, custom categories, budgets, the five-state status model | **The model-backed Assistant.** Every request to `127.0.0.1:8787` fails and the app falls back to the local regex matcher in `src/lib/ask.js` |
| Month total, donut, last-7-days chart, searchable list, month navigation, category drill-down | **Receipt scanning.** There is no offline substitute for a vision model. The button reports *"Scanning is unavailable — the assistant is offline."* — verified wording in `src/lib/receiptClient.js:76` |
| All three live wallpapers, the three-step decay, both compositions, reduced-motion handling | Any Assistant question the regex matcher cannot parse — it declines rather than guessing |
| Both layouts, phone and laptop | |
| Manual entry **and voice entry** — speech recognition is the browser's, not the backend's | |

**Path A is a real, complete, honest product.** It is a tracker with an offline
assistant. It is not an AI demo.

### Path B — the presenter's laptop with the local backend running

`cd backend && npm start`, frontend on `http://localhost:5173/Daily-Expense-Tracker/`.
Everything in Path A, **plus** the model-backed Assistant (Structured Outputs,
five intents, nine metrics) and receipt scanning end to end.

> **Drive Path B from the local dev server, not from the public URL.** Opening
> the Pages site on the demo laptop while the local backend runs *looks* like it
> should work — `ALLOWED_ORIGINS` in `backend/src/server.js:44` already lists
> `https://wakigit.github.io` — but an **HTTPS page calling `http://127.0.0.1`
> is a mixed-content request**, and Chrome's private-network-access rules may
> require a preflight this server does not implement. **This has never been
> tested and must not be discovered during a presentation.** The localhost dev
> server has no such problem. If the Pages-plus-local-backend combination is
> wanted, verify it in Stage 8 rather than assuming it.

### What this means for Stage 8

**"Rehearse the full demo path with the backend stopped" cannot include receipt
scanning** — that was an error in the previous draft. With the backend stopped
there is no OCR, by design and with no fallback. The backend-stopped rehearsal
proves the **Assistant fallback and the tracker**, which is exactly Path A.
Receipt scanning is rehearsed separately, on Path B.

---

## The open decision: host a backend, or not

**This is not decided, and this document will not decide it.** It is the one
choice that changes Stage 0's and Stage 8's acceptance criteria, so both stages
below are written to branch on it. Options, requirements and risks are in
*The backend hosting decision* at the end of this document. **No hosting
provider has been chosen and nothing has been deployed.**

Until it is decided, assume **Option B (no hosted backend)**, because it is the
state the repository is already in and it requires no new work.

---

## Effort model

Solo hours including debugging and the test pass, not ideal hours.

**No deadline is assumed here.** The hackathon date, duration and judging format
have not been reconfirmed (`docs/PRD.md` §11), so these are **sizes and an
order**, not a countdown from any particular day. The earlier draft laid the
stages onto Day 1–Day 7; that encoded a seven-day window nobody has confirmed.
If the real window turns out to be three days, the order below still holds and
everything from Stage 4 down is cut.

| Stage | | Hours | Priority |
|---|---|---|---|
| 0 | Clear the decks | 1–3 | **MUST — do first** |
| 1 | Sample demo data | 3–5 | **MUST** |
| 2 | UI polish — the three known issues | 3–5 | **MUST** |
| 3 | Assistant comparisons and source rows | 6–10 | **SHOULD — highest value** |
| 4 | Charts in Assistant answers | 4–7 | SHOULD |
| 5 | Qualified budget forecast | 4–6 | SHOULD |
| 6 | Opt-in roaster | 4–6 | COULD — **the cut line** |
| 7 | Rename product strings | 1–2 | SHOULD |
| 8 | Deploy, rehearse, freeze | 4–6 | **MUST — last day** |

Stages 0–5, 7 and 8 total **26–44 hours**. That fits, with no slack for a
surprise. **Stage 6 is the cut line** and the first thing to drop.

---

## Stages

Each stage gives: **user benefit · frontend work · backend work · acceptance ·
depends on · cut condition.**

A note on two fields. *Backend work* is "none" for most stages, and that is a
real finding rather than an omission: the arithmetic lives in `src/lib/`, which
runs in the browser, so comparisons, charts and the forecast need no server at
all. *Cut condition* is a trigger to stop, not a wish — it names what ships
instead.

---

### Stage 0 — Clear the decks · 1–3h · MUST · ✅ DONE 2026-10-17

> **Outcome.** Six commits on `wallpaper-redesign` (`0b4c8db` assistant fix ·
> `144adbe` wallpaper/laptop · `fc3e83e` receipt scanning · `2ad4329` browser
> regressions · `2d9f376` deterministic test · `717d6f2` docs). The smoke suite
> is **518/518** and no longer time-dependent. `gh-pages` was rebuilt and
> pushed as `29fc463`; the live URL serves it and was checked in a browser
> against Path A. **`main` was left untouched** — see the decision below.
> **Option B** is in force: no backend is hosted.
>
> Two things this stage did **not** do, both deliberate: the
> `wallpaper-redesign` branch was **not pushed** (nobody asked, and it is the
> only off-machine backup question still open), and `main` was neither merged
> nor rewritten.

**User benefit.** Indirect but the largest on this list: right now a judge who
opens the public URL sees a build with **no Assistant and no receipt scanner**.
Every later stage is invisible until this is fixed.

**Frontend work.** No feature code. Two things:

1. **Commit the working tree.** It spans two distinct pieces of work (the
   wallpaper/laptop redesign, and the receipt scanner) and is worth **two
   commits, not one**, plus the documentation pass.
2. **Fix the Singapore "yesterday" smoke expectation.** This is the one piece of
   code work in Stage 0 and it is **upcoming, not done** — the documentation
   passes that found it were docs-only and changed no code.
   `scripts/smoke.jsx:1196` computes the expected date from UTC
   (`new Date().toISOString()`) while `parseUtterance` correctly resolves
   "yesterday" on the **Asia/Singapore** day, so the check fails between 00:00
   and 08:00 SGT. **The product is right; the test's expectation is wrong.** Fix
   the expectation to the Singapore day — do not touch the parser.

   This comes before anything else treats the suite as a release gate. A suite
   known to fail by one is a suite in which the next real failure is invisible,
   and Stages 3, 4 and 5 all add metrics that the suite is the only check on.

**Backend work.** None, unless the hosting decision lands on Option A — see
*Acceptance* below and *The backend hosting decision*.

**Acceptance.**
- The working tree is committed on `wallpaper-redesign`; `git status` is clean.
- **`npm run smoke` is 518/518** — a genuinely clean gate, not 517 with a known
  exception. `npm run build` clean, `cd backend && npm test` 27/27.
- A decision is recorded on `main`, 23 commits behind: merge, or explicitly
  abandon it as a branch and point the deploy at the working branch. **Not to be
  merged or force-pushed without the owner's approval.**
- `gh-pages` is rebuilt from the current tip and the live URL serves it.
- The live URL is loaded **in a browser** and checked against **Path A
  specifically**: the tracker works, the Assistant answers from the offline
  matcher, and the receipt button reports that scanning is unavailable. All three
  are the correct behaviour for Path A — none of them is a bug to chase.
- **The hosting decision is recorded**, even if the answer is "not yet". If it
  lands on **Option B**, this stage is complete as written. If it lands on
  **Option A**, Stage 0 also deploys the backend, sets `VITE_ASSISTANT_URL` at
  build time and **rebuilds** `gh-pages` afterwards — the endpoint is baked into
  the bundle at build time, so a backend deployed after the frontend build
  changes nothing until the frontend is rebuilt.

**Depends on.** Nothing.

**Cut condition.** None. This is not optional; it is the rollback point for
everything after it. If the `main` question cannot be settled, deploy from
`wallpaper-redesign` and leave `main` alone — the deploy is the part that
matters today. The hosting decision may stay open; Path A shipping correctly
must not wait on it.

**What actually happened (2026-10-17).**

- The smoke expectation was fixed first, by injecting the fixed clock
  `parseUtterance` already accepts and writing the expected Singapore date out
  in full. The parser was not touched. Verified identical under `TZ=UTC`,
  `Asia/Singapore`, `America/Los_Angeles` and `Pacific/Kiritimati`.
- The tree became **six** commits rather than two, because it held more than
  two units of work: two logic bug fixes that predate both features, the two
  features, the test fix, and the documentation pass. Each commit was checked
  to reproduce the working tree exactly, and each was run on its own.
- **The `main` decision was deferred, not taken.** `main` is untouched and the
  deploy points at the working branch, which the cut condition above already
  allows. It remains open.
- Live URL verified in a browser: tracker, navigation and expense entry work;
  the Assistant answers from the offline matcher and **says so**
  ("Answered offline — the assistant is unreachable"); receipt scanning reports
  *"Scanning is unavailable — the assistant is offline."* All three are Path A
  behaving correctly.

---

### Stage 1 — Sample demo data · 3–5h · MUST

**User benefit.** A first-time opener — including a judge on their own phone —
currently sees an empty shell: no expenses, no budgets, a flat donut, an empty
7-day chart and a wallpaper permanently at *healthy*. Sample data makes every
built feature visible in under two minutes without typing.

**Frontend work.** A seeded dataset plus load and clear controls in Settings.
Per `docs/PRD.md` §5.5: budgets set, enough history for a month-over-month
comparison, at least one category over budget so the decay and the status model
are both legible, and rows recent enough to populate the 7-day chart. Writes
through `src/lib/storage.js` like any other data.

**Backend work.** None.

**Acceptance.**
- Loading sample data makes all of these legible on one pass: month total,
  donut, 7-day chart, a *run down* wallpaper state, and an over-budget chip.
- It is **explicitly loadable and clearable from Settings**, and never
  overwrites existing rows without saying so first.
- It is obviously sample data — a judge cannot mistake it for a real ledger.
- It is **sample financial data, generated for the demo.** No real statement,
  no real card, no real account is involved anywhere in this stage.
- Clearing it returns the app to a genuinely empty state.
- `npm run smoke` passes with checks on the seeded figures.

**Depends on.** Stage 0 (so the seed ships to the live URL).

**Cut condition.** If the Settings controls get fiddly, ship **load-only** with
a browser-level "clear site data" note. A one-way seed is still a complete demo
story; a half-working clear that drops real rows is not.

---

### Stage 2 — UI polish: the three known issues · 3–5h · MUST

**User benefit.** Three rough edges a judge meets in the first thirty seconds,
all currently real and all verified in the source on 2026-10-17.

**Frontend work.**

1. **Native number spinners in the Amount field — NOT REPRODUCED; verify
   before "fixing".** Checked in Chrome 153 on 2026-10-17 at 390px and at
   laptop width: the computed `appearance` and `-webkit-appearance` on the
   input both resolve to `none`, no `::-webkit-inner-spin-button` rule exists
   or is needed, and **no spin arrows render** in either screenshot. Modern
   Chrome suppresses the spinner from `appearance: none` on the input alone.
   The original report may predate that, or may have come from Safari, which
   is untested here. **Confirm on Safari and on real iOS first** — adding a
   `::-webkit-inner-spin-button` rule for a spinner that is not there is a
   change with no observable effect. Fields are `AddView.jsx:84` and
   `SettingsView.jsx:106`.
2. **Long category names truncate on the phone donut legend.** `.legend-row`
   already ellipsises deliberately; the fix is to give the name more room at
   phone width rather than to remove the truncation, since removing it makes the
   name and the amount read as one string.
3. **The Assistant screen is sparse before a question is asked.** The empty
   state in `AskView.jsx` is a single sentence. Tappable example questions,
   drawn from metrics that actually exist in `src/lib/intent.js`, turn a blank
   screen into the demo's opening move.

While in here: **budget inputs display raw floats** (e.g.
`166.66666666666666`). Same file, same pass, and it looks like a bug on screen.

Three more cosmetic defects, all seen on screen during the Stage 0 browser
pass (2026-10-17) and none of them blocking:

4. **The "avg S$x" label on the 7-day chart overlaps the first bar** when the
   first bar is tall. Visible on both phone and laptop, on every theme.
5. **An Assistant answer reads "You spent S$115.30 food this month"** — the
   preposition is missing before the category label. One template string.
6. **`<meta name="apple-mobile-web-app-capable">` is deprecated**, and Chrome
   logs a console warning on every load asking for `mobile-web-app-capable`.
   It is the only console output the app produces.

**Backend work.** None.

**Acceptance.**
- The spinner question is **settled by observation on Safari and real iOS**,
  not assumed: either arrows are shown (then fix them) or they are not (then
  delete the claim from the docs rather than writing a no-op rule).
- A 20-character category name is readable in the phone donut legend at 390px.
- The Assistant screen before any question offers at least three example
  questions, each of which **actually resolves** — no example that maps to an
  unimplemented metric.
- Budget figures display rounded to cents.
- `npm run smoke` passes; the examples are asserted against the real metric list
  so one cannot drift into an unsupported query.

**Depends on.** Nothing. Can run in parallel with Stage 0.

**Cut condition.** The spinners and the float display are near-trivial and
should not be cut. If the legend needs a layout rethink, leave the ellipsis and
cut that item only — it is cosmetic, while an example question that errors in
front of a judge is not.

---

### Stage 3 — Assistant comparisons and source rows · 6–10h · SHOULD

**User benefit.** The two questions people actually ask that the Assistant
cannot answer today: *"am I spending more than last month?"* and *"which
transactions make that up?"* The second also strengthens the central trust
claim — an answer that can list the rows it summed is an answer that proves
itself.

**Frontend work.** In priority order, per `docs/PRD.md` §5.1:

1. **Source rows.** The plan returned by `src/lib/assistant.js` carries the ids
   of the rows it summed; the Ask thread can list them.
2. **A comparison metric** — two windows and a delta, with direction and
   percentage computed in `src/lib/stats.js`.
3. Comparison answer templates that still state their interpretation
   ("Read as: Food · this month vs last month").

`METRICS` in `src/lib/intent.js` and the Structured Outputs schema in
`backend/src/provider.js` must be extended **together** — `intent.js` is
imported by both sides precisely so the schema cannot drift.

**Backend work.** Extend the Structured Outputs schema for the new metric, in
the same change as the shared contract. Nothing else; the arithmetic stays in
the browser.

**Acceptance.**
- Every new figure asserted against a **hand-computed** sum from known rows, the
  way the `top_*` metrics already are. `money(undefined)` renders as `S$0.00`
  rather than throwing, so **assert the number, never that a string was
  produced.**
- A comparison says plainly when one side has too little data, rather than
  reporting a percentage against a near-zero base.
- "Which transactions make that up?" lists real rows whose sum equals the figure
  already shown.
- The offline fallback matcher handles, or cleanly declines, the new shapes —
  the deployed build runs in that mode.
- Tested against the live API, with the model's actual output reported.

**Depends on.** Stage 0. Independent of Stages 1 and 2 — but far better to demo
with Stage 1's data in place.

**Cut condition.** Ship **item 1 only**. Source rows are the higher value per
hour and the better demo. Follow-up context ("what about last month?"), the
per-category `essential` flag and multi-category questions stay **LATER** and
must not be started in this stage.

---

### Stage 4 — Charts in Assistant answers · 4–7h · SHOULD

**User benefit.** A comparison or a breakdown lands harder with one small chart
under the sentence. The sentence stays the answer; the chart is corroboration.

**Frontend work.** Reuse `Donut.jsx` and `WeekBars.jsx` inside an answer bubble.
Per `docs/PRD.md` §5.2: **no chart without the figure in words**, no chart type
the phone column cannot carry, and the **same computed numbers** behind the
sentence and the chart — not a second calculation.

**Backend work.** None. The model never chooses a chart; application code picks
one from the metric that was answered.

**Acceptance.**
- A chart appears only where the sentence already states the figure.
- The chart and the sentence are driven by one computed value, asserted in a
  test that would fail if they diverged.
- Renders inside the phone column at 390px without horizontal scroll, and in the
  laptop Ask column.
- `npm run smoke` passes with render checks at both widths.

**Depends on.** Stage 3 (a comparison is the answer worth charting).

**Cut condition.** If chart-in-bubble layout fights the existing components
after ~2 hours, cut the stage. Text answers are already complete and correct;
this is polish, and the charts exist on Home and Overview regardless.

---

### Stage 5 — Qualified budget forecast · 4–6h · SHOULD

**User benefit.** The one forward-looking question a tracker should answer:
*"at this rate, where do I land at month end?"*

**Frontend work.** Run rate in `src/lib/stats.js`: spend to date ÷ days elapsed
× days in month, on the real Asia/Singapore calendar. **Arithmetic, not a model
and not ML** — no seasonality, no learning, no per-category behaviour model.

The qualification is the feature, and `docs/PRD.md` §5.3 is binding:

- Labelled a projection **at the current rate**, with the rate stated.
- Shows the number of days it is based on.
- **Suppressed entirely** below a minimum of elapsed days (proposed: 5) and when
  no budget is set, rather than printing a confident figure from noise.
- Never phrased as what the user *will* spend. "At this rate, about S$X by the
  31st" — never "You will spend S$X".
- **Never drives the wallpaper decay or the status chip**, which stay on actual
  spend. A forecast that darkened the world for money not yet spent would be the
  app lying about the present.

**Backend work.** None. No model involvement at all — which is the point, and
worth saying out loud in the demo.

**Acceptance.**
- The projection is unit tested at the month boundary, on a 28-day month, and on
  a 31-day month, against hand-computed figures.
- It is **provably suppressed** at day 4 and with no budget set — a test, not an
  inspection.
- No wallpaper or status-chip code path reads the forecast. Assert this.
- The on-screen wording contains the rate and the day count, and contains no
  phrasing that predicts rather than projects.

**Depends on.** Nothing in code. Demo-wise it needs Stage 1, since a projection
from an empty ledger is suppressed and therefore invisible.

**Cut condition.** Cut the whole stage before weakening the qualification. An
unqualified forecast is a fabricated number presented as fact, which is exactly
the failure the rest of this product is built to avoid. **A forecast that
cannot be labelled correctly must not ship.**

---

### Stage 6 — Opt-in roaster · 4–6h · COULD · THE CUT LINE

**User benefit.** A reason to open the app that is not duty. Cheap creativity
points, and the local template fallback means it works on the Pages build.

**Frontend work.** The intensity ceiling setting (default **0, off**), the roast
line on a confirmed transaction, the per-transaction-id cache, and the local
template bank. Tier rule from `docs/PRD.md` §5.4 — `tier = min(userCeiling,
bandOf(budgetRemainingPct))`, **capped at 2 even when over budget**, de-escalating
in tone rather than escalating.

**Backend work.** A roast route. Sent to the model: description, amount,
category label, time-of-day bucket, budget-remaining **band** (not the exact
figure), tier, angle. **Never** the ledger, other transactions, the user's name
or exact balances. Content rules in the prompt **and** in a post-filter.

**Acceptance.**
- Tier is a pure function of (budget band, user ceiling), unit tested at **every
  boundary**, including the over-budget cap at 2.
- Off by default; the ceiling persists.
- The post-filter demonstrably rejects a planted bad output — in particular any
  **invented investment return** ("that $6 could have been $600 in the S&P
  500"), which is a fabricated financial claim and must never appear, in jest or
  otherwise.
- With the backend stopped, the template bank still produces a line.
- The same angle does not repeat within the last N.
- Ten generated examples reviewed at each tier before this ships.

**Depends on.** Stage 0. Independent of everything else.

**Cut condition.** **This is the first stage to cut, and cutting it costs the
demo nothing.** If model tone is inconsistent after ~2 hours of prompt work,
ship the **local template bank only** — it is funnier than a bad model joke and
costs nothing per use. If the content post-filter is not solid, cut the feature
entirely: a cruel line in front of judges is a worse outcome than a missing
joke.

---

### Stage 7 — Rename product strings · 1–2h · SHOULD

**User benefit.** The product is TallyAI; the UI says "Expense Tracker". A judge
reading the pitch and then the app sees two different products.

**Frontend work.** `index.html`, `src/App.jsx`, `src/hooks/useAppData.js`, the
`SettingsView.jsx` placeholder, and `backend/package.json`.

**Backend work.** The `backend/package.json` name and description only.

**Acceptance.**
- No user-visible "Expense Tracker" string remains.
- The **repository, git remote and Pages URL are untouched** — renaming a public
  repo breaks the deployed link for zero judging benefit. This is deliberate,
  not an oversight.
- `npm run smoke` passes; any test asserting the old name is updated with it.

**Depends on.** Nothing. Do it **before** Stage 8, so the final deploy carries
the new strings.

**Cut condition.** Cut freely. The storage key prefix (`ww_*`) must **not** be
renamed in any case — that silently orphans every existing user's data for a
cosmetic gain.

---

### Stage 8 — Deploy, rehearse, freeze · 4–6h · MUST · LAST DAY

**User benefit.** The thing judges open actually works. Everything above is
worth nothing if this is skipped.

**Frontend work.** Rebuild and redeploy `gh-pages` from the final tip. No new
code.

**Backend work.** Whatever the hosting decision requires — nothing under Option
B; under Option A, the deploy plus its usage controls, and a rebuild of the
frontend with `VITE_ASSISTANT_URL` set.

**Acceptance — Path A, the public URL. Required either way.**
- The live URL serves the final build, verified **in a browser**, not localhost.
- Sample data loads on a fresh browser profile.
- **The Path A rehearsal is explicitly the backend-stopped rehearsal.** The
  Assistant falls back to the local matcher and the demo continues on the
  tracker, the charts, the wallpapers and manual and voice entry.
- **Receipt scanning is NOT part of this rehearsal and is not expected to work
  here.** It has no offline fallback; the button must report that scanning is
  unavailable, and that is a pass, not a failure. The previous draft of this
  roadmap asked for a backend-stopped rehearsal of "the full demo path" — that
  was wrong, because the full path includes OCR, which cannot survive the
  backend being stopped.
- If a phone is part of the demo, the public URL is opened on **real iPhone
  hardware** — see R3.

**Acceptance — Path B, the live AI and OCR.**
- Rehearsed from **`http://localhost:5173/…` with `cd backend && npm start`**,
  not from the Pages URL — see the warning under *Two demo paths*.
- The model-backed Assistant answers, and a receipt scans end to end, on the
  actual demo laptop.
- The presentation contains **one honest sentence** naming which path the audience
  is being shown, so that a judge who then opens the public URL on their phone
  and finds no OCR understands why rather than concluding it is broken.
- If the Pages URL *is* to be driven against the local backend, that exact
  combination is verified here — HTTPS page to `http://127.0.0.1` — rather than
  assumed. If it does not work, use the dev server and say so.

**Acceptance — under Option A only.**
- The hosted endpoint is reachable from the Pages origin over **HTTPS**, and the
  frontend was **rebuilt** with `VITE_ASSISTANT_URL` pointing at it.
- The usage controls listed in *The backend hosting decision* are in place and
  were tested, including a provider-side spend cap.
- **The backend can be switched off in seconds** and the app degrades to Path A
  rather than breaking. Rehearse that too.

**Also required either way.**
- `npm run build`, `npm run smoke` (518/518, per Stage 0) and
  `cd backend && npm test` all green.
- Two full run-throughs on the actual demo laptop, on the actual network.

**Depends on.** Every stage that is shipping, and the hosting decision.

**Cut condition.** None for Path A. **Option A is itself cuttable at any point**
— falling back to Option B costs no code and loses only the model-backed
Assistant on the public URL.

---

## The order, and where the cut line sits

Dependency order, not a calendar. **The deadline has not been reconfirmed**, so
this is expressed in sequence and in fractions of whatever time exists.

```
FIRST        Stage 0   commit · fix the smoke expectation · deploy Path A
             Stage 2   can run in parallel; it depends on nothing

THEN         Stage 1   sample data  (Path A's first impression depends on it)
             Stage 3   source rows, then the comparison metric

MIDDLE       Stage 5   forecast
             Stage 4   charts in answers

══════ CUT LINE ══════ everything below is optional ══════

MAYBE        Stage 6   roaster — the first thing to drop
             Stage 7   rename product strings

LAST         Stage 8   deploy, rehearse both paths, freeze. No new code.
```

**Two rules that hold regardless of how long the window is.**

1. **Nothing new starts in the last fifth of the time available.** The remainder
   finishes what exists and rehearses. A hackathon demo fails on the thing
   nobody tested, not on the feature nobody built.
2. **Stage 8 gets a whole slot of its own**, not the leftovers of the previous
   one. Under Option A it needs more than that.

---

## Stop trying to build these this week

Each will feel tempting at 1 a.m.

1. **Bank statement import, card syncing, reconciliation, duplicate queues.**
   **Removed from the product** (`docs/PRD.md` §7) — not a stretch goal, not a
   later stage. Receipt scanning is already built and is the good half of
   ingestion.
2. **A cat mascot, a character state machine, a docked assistant panel.**
   Removed. The animation budget belongs to the wallpapers, which already work.
3. **Accounts, login, database, sessions.** `docs/PRD.md` §6 sets the minimum
   bar: 16–30+ hours done carefully, and the failure modes harm real people. **A
   frontend-only login form is not an account system and will not be presented
   as one.**
4. **PDF statement parsing.** Every bank's layout differs. A project, not a task.
5. **Voice into the Assistant.** The Add-form path exists and is the foundation.
   **LATER** — it competes with capabilities judges can actually see.
6. **Multi-currency and FX.** Still a non-goal. Receipt scanning **reports**
   currency and never converts, which is the correct amount of this feature.
7. **Renaming the repository or the Pages URL.** Breaks the deployed link for
   zero benefit. Product strings only (Stage 7).
8. **Reworking the wallpaper engine.** It works, it is tested, it is a
   differentiator. Leave it alone.
9. **Refactoring `src/App.jsx`.** It owns most state and every handler and it is
   genuinely the wrong place for the next feature — but a refactor mid-week buys
   no judging points and risks everything that currently passes.

---

## Risk register

| # | Risk | Likelihood | Impact | Mitigation | Trigger to act |
|---|---|---|---|---|---|
| ~~R1~~ | **CLOSED 2026-10-17 (Stage 0).** Was: a smoke check fails and gets normalised. `scripts/smoke.jsx:1196` computes the expected "yesterday" from UTC, while the parser correctly uses the Asia/Singapore day — so the suite reads 517/518 between 00:00 and 08:00 SGT. **The product is right and the test is wrong**, but a suite that is "expected to fail by one" is a suite that hides the next real failure | Closed | — | Fixed in `2d9f376` by injecting a fixed clock and a literal Singapore date; the parser was untouched. The suite is 518/518 and verified under four timezones | Reopen if any new date-sensitive check derives its expectation from `new Date()` |
| R2 | **Deployed build is stale at judging.** Was 31 commits behind with no Assistant; **rebuilt and verified in a browser on 2026-10-17 (`29fc463`)** | Low until the next change lands | **Fatal to the demo** | Stage 0 closed the gap; Stage 8 must redeploy from the final tip. Verify the live URL in a browser, never localhost | Any commit after `717d6f2` that is not followed by a redeploy |
| R2b | **A judge opens the public URL expecting what the presentation showed.** Path A has no model-backed Assistant and no receipt scanning; the presentation is Path B | **High** if unaddressed | Medium — reads as a broken feature rather than a scoped one | One honest sentence in the presentation naming the path; the receipt button already says scanning is unavailable rather than failing silently; or resolve it by hosting a backend (Option A) | Any demo claim that does not distinguish the two paths |
| R3 | **Nothing has been tested on real iPhone hardware.** Every "works on phone" claim means a 390×844 viewport in desktop Chrome | High | Medium–High | Open the live URL on a real phone during Stage 8; treat the phone layout as **unverified on device** until then | Any phone claim made to a judge before this is done |
| R4 | **Assistant reports a wrong figure** | Low | Fatal to the story | Every figure from `stats.js` over real rows; model output discarded; new metrics asserted against hand-computed values. `money(undefined)` renders `S$0.00` rather than throwing — this has already produced a confident wrong figure once | Any metric added without a hand-computed test |
| R5 | **The forecast reads as a prediction** | Medium | High | §5.3's labelling is binding; suppression below 5 elapsed days; never drives decay or the status chip; cut the stage rather than weaken the wording | Any forecast wording that says *will* |
| R6 | **Receipt scanning fails on a creased thermal receipt in bad light** | **High** | Low, by design | Testing used crisp rendered receipts; the untested case is the hard one. What is proven is that a bad read is **safe** — it produces a draft a person checks, never a row. Demo with a known-good receipt and say plainly that thermal paper is unproven | Any claim that scanning is accurate rather than safe |
| R7 | **Demo fails live** — no network, backend down, mic denied | Medium | High | The offline fallback is built and must stay; rehearse Path A with the backend stopped; sample data; no Path A step depends on the network. **Receipt scanning is the one feature with no fallback** — it belongs only to Path B and must never be on the critical path of a public-URL demo | Any Path A step that cannot survive the backend being off |
| R12 | **A hosted backend is abused.** Under Option A the repo is public, the endpoint is in the client bundle, and the receipt route calls a paid vision model. **CORS does not prevent this**: it is a browser policy that governs which *pages* may read a response, and `curl` or any script ignores it entirely. An unprotected hosted endpoint is a free OCR and LLM service billed to the owner | **High under Option A**, N/A under Option B | **High — direct financial loss** | A provider-side hard spend cap first, as the only control a bug cannot bypass; per-IP and global rate limits on both routes; the existing body-size caps and `max_output_tokens`; request-count logging; and a kill switch, since the app degrades to Path A when the backend disappears | The day Option A is chosen — these are prerequisites, not follow-ups |
| R8 | **Roaster says something cruel** | Low | High reputational | Bounded tiers capped at 2; de-escalation when over budget; prohibited-topic list; post-filter for invented financial claims; off by default | Any output touching identity, family, academics, poverty, body or health |
| R9 | **Scope creep past the cut line**, or a removed feature creeping back | **High** | High | The cut line in *The order*; per-stage cut conditions; the stop-list above; §7 of the PRD is a cut list, not a backlog | Starting anything new in the last fifth of the available time, or any work on import/mascot/accounts |
| R10 | **Model cost runs away** | Low | Medium | Small payloads; roast cached per transaction id; no call on interim speech or per keystroke; `max_output_tokens` capped; offline fallback always available | Any per-keystroke or per-render model call |
| R11 | **The work is lost.** The tree is now committed (six commits), but the branch is **local only — never pushed**, so a disk failure still loses all of it | Low–Medium | **Severe, irreversible** | Stage 0 committed it. The remaining exposure is the un-pushed branch; pushing `wallpaper-redesign` to `origin` closes it and is an open decision | Any hardware trouble, or more work landing on top of an un-pushed branch |

Note what has **left** this register. The old plan's R2 (import corrupts the
ledger) and R4 (account isolation leaks another user's data) are gone because
import and accounts are gone — removing a feature removes its risks, which is
the strongest argument for the cuts in `docs/PRD.md` §7.

---

## The backend hosting decision

**Option B is in force as of Stage 0 (2026-10-17), for this build.** No
provider has been chosen and nothing is hosted; the public URL is Path A and
the presentation runs Path B from the laptop. This is a decision for the
hackathon, not a permanent one — Option A stays available and the requirements
below are what it would cost. Both options remain viable; they trade money and attack surface against what the
public URL can show. The requirements and risks are stated so the choice can be
made on facts rather than on optimism.

### Option A — host a backend for the public demo

The public URL gains the model-backed Assistant and receipt scanning. Path A and
Path B converge, and R2b disappears.

**Minimum requirements. All of them, not a subset.**

1. **A host that holds `OPENAI_API_KEY` in its own secret store** — the
   environment settings of the running service, never the repo, never the image.
2. **HTTPS on the backend.** The Pages site is HTTPS, and an HTTP endpoint is
   blocked as mixed content. This rules out the simplest options.
3. **`ALLOWED_ORIGINS` set to the Pages origin only**, with `HOST=0.0.0.0` and
   the platform's injected `PORT`. Both are already configurable
   (`backend/src/server.js`); no code change is needed for this part.
4. **A frontend rebuild** with `VITE_ASSISTANT_URL` pointing at the host. The
   endpoint is inlined at **build** time, so deploying a backend without
   rebuilding `gh-pages` changes nothing.
5. **A real usage-control plan — the part that does not exist yet.**

**On that last point, plainly: CORS is not an access control.** It is enforced
by browsers and it decides which *web pages* may read a response. It does
nothing about `curl`, a script, a bot, or anyone who reads the endpoint URL out
of the public bundle — which is where it necessarily is — and calls it directly.
The receipt route forwards an image to a paid vision model. Exposed without
controls, it is a free OCR service with the owner's billing attached.

The minimum control set, in order of how much they actually protect:

- **A hard spend cap at the provider** (OpenAI usage limits). The only control
  that still holds when my own rate limiter has a bug. Set this first — and
  understand precisely what it is:
  - It must be **explicitly configured**. An account does not come with a
    useful one, and the default state is not a cap.
  - **A spend alert / notification threshold is not a limit.** It emails you
    and then lets the spending continue. Only the hard limit refuses requests.
  - **Even the hard limit can overshoot slightly.** Usage is metered and
    enforced with a lag, so billing can land a little above the number you
    set. Treat it as "stops runaway spend", not "cannot exceed this figure by
    one cent", and set it low enough that the overshoot is affordable.
- **Per-IP rate limits on both routes, plus a global ceiling**, with the receipt
  route limited far more tightly than the intent route — it is the expensive one.
  **Neither exists today; this is new code.**
- **Request-count logging**, so abuse is noticed rather than discovered on an
  invoice.
- **A kill switch.** Because the app degrades to Path A, turning the backend off
  is a safe and instant mitigation. This is a genuine advantage of the fallback
  architecture and worth rehearsing.
- A shared token baked into the build **is not an authenticator** — it ships in
  the public bundle and can be copied in seconds. It raises the effort of casual
  abuse and nothing more. Do not let it substitute for the caps.

**Risks.** A key-holding service exposed to the internet. Cost abuse on the
vision route. A new deploy surface to debug, plausibly on the worst possible
day. And the public URL acquires a dependency on a server that can be down
during judging — where today the fallback is the only path and therefore always
works.

**Effort.** A few hours at minimum, most of it the rate limiting that does not
exist, plus the redeploy. Treat it as a stage, not a task, and not a last-day
one.

### Option B — local backend for the presentation; the public URL is a tracker demo

Drive the live AI and OCR from the laptop (Path B), and describe the public URL
honestly as a tracker with an offline assistant (Path A).

**Requirements.** No code and no new infrastructure. One honest sentence in the
presentation naming which path is on screen. A rehearsal of both paths in Stage
8. And do not let a judge's phone be the first place anyone tries to scan a
receipt — the button says scanning is unavailable, which is correct, but it is a
poor way to learn the scope.

**Risks.** A judge who opens the public URL on their phone sees less than the
presentation showed. That is R2b, and one sentence addresses it. No model-backed
Assistant on the public URL — though the offline matcher answers the common
questions with the same arithmetic, so the gap is narrower than it sounds.

**Effort.** Zero.

### Recommendation

**Option B for the hackathon; Option A afterwards, if the project continues.**
*(Adopted for this build in Stage 0.)*

The reasoning: Option A's cost is not the hosting, it is that it adds a new
internet-facing surface holding a paid API key, with rate limiting that has to
be written and tested, at exactly the time the remaining budget should go to
Stages 1, 2 and 3 — which affect every viewer, including Path A. Option B's cost
is one sentence of honesty in a presentation.

**This is a recommendation, not a decision. The owner decides.** If Option A is
chosen, it is a stage of its own with the controls above as acceptance criteria,
scheduled before Stage 8 and never on the final day.

---

## Assumptions

Labelled so they can be corrected rather than inherited silently.

1. **No deadline is assumed.** The hackathon date, duration and judging format
   have **not been reconfirmed**, so this roadmap gives sizes and a dependency
   order rather than a countdown. Any day-numbered plan that appears here again
   is an assumption that needs confirming first.
2. Solo, no teammates.
3. Judging is a live demo on a laptop, with limited time per project, and judges
   may open the public URL on their own phones.
4. Pre-existing code is permitted (confirmed 2026-10-02).
5. OpenAI remains the provider and `gpt-4.1-mini` the model
   (`backend/src/provider.js:24`).
6. GitHub Pages remains the deploy target, with **no backend deployed** — the
   default assumption until the hosting decision is made. If it changes to
   Option A, the model-backed Assistant and receipt scanning become
   demonstrable from the public URL; today neither is.
7. No budget for paid infrastructure this week.
8. **The demo uses sample financial data generated for it.** No real bank
   statement, card or account is involved at any stage. Nothing in the product
   presents accounts or login as existing.
