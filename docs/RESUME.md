# Where I left off — 2026-10-17

Open this first. It is the state of the working tree, what is finished, what is
half-done, and what to say to pick the thread back up.

**Branch:** `wallpaper-redesign` · **Nothing is committed.** Everything below is
uncommitted working-tree changes: 21 modified tracked files and 10 untracked
files — roughly 2,180 insertions of application code, plus the documentation.

**Verification, re-run 2026-10-17:**

| | |
|---|---|
| `npm run build` | clean |
| `npm run smoke` | **517/518** — one failure, in the test, not the product; see below |
| `cd backend && npm test` | 27/27 |

> **The one smoke failure.** `scripts/smoke.jsx:1196` computes the expected
> "yesterday" from UTC (`new Date()` → `toISOString()`), while `parseUtterance`
> correctly resolves it on the **Asia/Singapore** day. Between 00:00 and 08:00
> SGT the two disagree by a day and the check fails — it was run at 01:24 SGT.
> **The product is right and the test's expectation is wrong. It is not fixed,
> and no code was changed to fix it** — the session that found it was docs-only.
> Fix it before Stage 3 adds metrics; a suite expected to fail by one is a suite
> that hides the next real failure.

---

## Finished and verified in a browser

1. **Laptop layout.** Below 1024px the phone column is unchanged. At 1024px+ a
   navigation rail, a centre column and a transaction ledger. One component set
   — `BottomNav` becomes a vertical rail purely in CSS. There is exactly one
   layout breakpoint, at 1024px.
2. **Three-step wallpaper decay.** `healthy` under 75%, `strained` 75–100%,
   `run down` past it, from `decayLevel()` in `src/lib/status.js` — a projection
   of `budgetStatus()`, not a second set of thresholds. Reversible; loops never
   restart (measured, not eyeballed).
3. **Widescreen scene compositions.** A second 1440x900 composition per scene,
   reusing every decay class name so one stylesheet drives both.
4. **Last 7 days bar chart** on Home (`src/components/WeekBars.jsx`). Reads all
   expenses, so the window is correct across the 1st.
5. **Per-view laptop grids.** Settings / Overview / Category fill two equal
   columns; Add and Ask keep one readable measure, centred.
6. **Watermark moved** out of every screen into the bottom of Settings.
7. **Receipt scanning** (added 2026-10-16, after the pause). Photograph a
   receipt on the Add screen and the form fills itself. New shared contract in
   `src/lib/receipt.js`, browser downscaler in `src/lib/receiptImage.js`,
   `POST /assistant/receipt` on the backend. Verified live end to end, not just
   unit tested — see `docs/PRD.md` §4.6.

### Bugs found and fixed along the way

- **The forest moon's phase never rendered**, long before this work. Chrome
  rasterises SVG mask content once and does not rebuild it when CSS moves it.
  Now three pre-masked discs cross-faded on opacity.
- **Travel loops reset on screen in the wide compositions** — I caused this. The
  keyframes were hard-coded in phone user-units, so a car "exiting right"
  stopped at x 1150 in a 1440 box and jumped back to x 380 in view. Distances
  now come from `travel()` in `src/themes/scenes.js`, unit tested.
- **`stroke` was missing from the `.trc` transition list**, so the banner mouth
  would have snapped instead of eased.

---

## About the receipt scanner specifically

Taken from `yuvanvishnupandi/finvora-desktop` (a JavaFX app — the idea, none of
the code). Four things were added that it does not do, each of which is a way a
receipt scanner is confidently wrong: the total is specified as the figure after
service charge and GST, the model can declare the image is not a receipt,
unreadable fields come back null instead of guessed, and foreign currency is
flagged rather than silently treated as SGD.

**Two things to know before demoing it:**

1. **It needs the backend running.** It is the first feature with no offline
   fallback, so it does nothing on the GitHub Pages build. The button says so
   rather than failing silently. Keep it off the critical path of any
   public-URL demo.
2. **It was tested on crisp rendered receipts, not creased thermal paper in bad
   light.** That case was always the hard one and is still unproven. What is
   proven is that a bad read is safe — it produces a draft you check, never a
   row.

To re-verify live: `cd backend && npm start`, then scan something on Add. The
test images used are gone with the scratch directory; any receipt will do.

---

## The two demo paths — read before promising anything to a judge

The frontend looks for the backend at `http://127.0.0.1:8787`
(`src/lib/assistantClient.js:23`), overridable only by `VITE_ASSISTANT_URL` at
**build** time. **`127.0.0.1` is whatever device the page is open on** — a
judge's phone, not this laptop. **No backend is hosted.**

- **Path A, the public Pages URL.** Tracker, both layouts, all three wallpapers
  and the decay, manual entry, voice entry, and the Assistant **via the offline
  matcher**. **Receipt scanning does not work** — the button says *"Scanning is
  unavailable — the assistant is offline."* A tracker with an offline assistant,
  which is honest and complete, but not an AI demo.
- **Path B, this laptop with `cd backend && npm start`.** All of Path A plus the
  model-backed Assistant and receipt scanning. **Drive it from
  `http://localhost:5173/…`**, not from the Pages URL — an HTTPS page calling
  `http://127.0.0.1` is mixed content and that combination has **never been
  tested**.

**A rehearsal with the backend stopped is a Path A rehearsal and cannot include
receipt scanning.** The earlier roadmap asked for exactly that; it was wrong.

Full detail in `docs/PRD.md` §9.1 and `docs/ROADMAP.md`.

---

## The planning pass of 2026-10-17 — docs only

A laptop hang interrupted a documentation update mid-way, leaving `docs/PRD.md`
partly rewritten for the current scope while every other document still
described a cat mascot, "Ask Tally" and bank statement import. That pass is now
finished. **Six documents changed; no application code, no staging, no commit,
no deploy.**

- `docs/PRD.md` — corrected against the code: the layout breakpoint is 1024px
  and not 768px, the smoke suite is 517/518 rather than 518/518, the rename is
  Stage 7, the uncommitted state is stated, and the three UI issues now cite
  the files and the reason each one happens.
- `docs/ROADMAP.md` — **rewritten.** Nine stages (0–8), each with a user
  benefit, frontend work, backend work, acceptance criteria, dependencies and a
  cut condition. The mascot, "Ask Tally" and CSV import stages are gone; the
  risk register lost the two risks that belonged to import and accounts and
  gained the uncommitted tree, the stale deploy and the failing check.
- `docs/PLANNING-BRIEF.md` — rewritten to the real scope, with a §5 that lists
  the cuts explicitly so a planning model does not suggest them back.
- `docs/CLAUDE-CODE-PROMPTS.md` — now a **prompt index**, not eight pre-written
  prompts. A pre-written prompt for a cut feature is how a cut feature comes
  back at 1 a.m.
- `README.md` — receipt scanning and its draft-before-save rule added, the
  assistant is no longer called "Tally", the deployed build is 31 commits behind
  and not 3, and the smoke count is honest.
- `docs/RESUME.md` — this file.

**A second docs-only pass, same day**, after review, added the two demo paths
above to `docs/PRD.md` (new §9.1), `docs/ROADMAP.md`, `README.md`,
`docs/PLANNING-BRIEF.md` (§3.1) and this file; put the backend hosting decision
in front of the owner with requirements, risks and a recommendation but **no
provider chosen and nothing deployed**; realigned Stage 0 and Stage 8 acceptance
to branch on that decision; removed the Day 1–Day 7 calendar from the roadmap,
since **the deadline has not been reconfirmed**; and fixed `backend/README.md`,
which still claimed *"the frontend is unchanged and does not call this server
yet"* — false since the Assistant landed — along with three stale `docs/PRD.md`
section references in it. **Still no application code changed.**

---

## The next thing to do

**Stage 0 in `docs/ROADMAP.md`, and it is not a feature.** The uncommitted tree
is the largest risk on the board and the deployed build has no Assistant at all.
Specifically:

1. **Commit this work** — 31 files spanning two separate pieces of work (the
   wallpaper/laptop redesign, and the receipt scanner), plus the documentation
   pass. **Worth two commits, not one.**
2. **Fix the Singapore "yesterday" smoke expectation** at
   `scripts/smoke.jsx:1196` — the expectation, never the parser — so the suite is
   a clean 518/518 gate rather than "517 with a known exception". This is the one
   piece of **code** work in Stage 0 and it is still **not done**; both
   documentation passes were docs-only. Do it before Stages 3–5 add metrics that
   the suite is the only check on.
3. **Decide what to do about `main`**, which is 23 commits behind: merge, or
   abandon it as a branch and point the deploy at the working branch. Do not
   merge or force-push without deciding deliberately.
4. **Rebuild and redeploy `gh-pages`**, which is 31 commits behind and predates
   the Assistant and the receipt scanner, and then load the live URL in a
   browser rather than localhost — checking it against **Path A**, where a
   falling-back Assistant and an unavailable receipt button are both correct.

Then Stage 1 (sample demo data) and Stage 2 (the three UI issues), which are
cheap and are what a judge meets first.

### Judgement calls still open

0. **Host a backend for the public URL, or not** — the live decision, and the one
   that changes Stage 0 and Stage 8 acceptance. Option A converges the two paths
   but needs HTTPS, the key in a host secret store, a frontend rebuild, and
   **rate limiting that does not exist in the code yet**; CORS does not stop a
   direct caller, so an unprotected hosted endpoint is a free OCR service billed
   to you. Option B costs nothing and makes the public URL a tracker demo plus
   one honest sentence in the presentation. Recommendation on file: **B for the
   hackathon, A afterwards.** Not decided, no provider chosen, nothing deployed.
1. **The 7-day chart shows on phone too.** It was asked for as a laptop detail.
   It is one component in one place in the DOM; to make it laptop-only, wrap it
   in `.col--main` with `display:none` below 1024px. Say the word.
2. **Whether Stage 6, the roaster, happens at all.** It is marked the cut line
   in the roadmap and cutting it costs the demo nothing.
3. **Whether to rename the product strings** (Stage 7) before judging, or leave
   "Expense Tracker" in the UI.
4. **The actual deadline.** Unconfirmed, so the roadmap now gives sizes and a
   dependency order rather than a day-by-day plan. Reconfirm it before trusting
   any schedule.

## Still not started

The roaster, sample demo data, Assistant comparisons and source rows, charts
inside answers, and the budget forecast. See `docs/ROADMAP.md`.

**Not coming back:** Tally the cat, the "Ask Tally" framing, CSV or PDF
statement import, card syncing, and reconciliation. These are **cut, not
deferred** (`docs/PRD.md` §7) — the laptop layout, the decay feature and the
receipt scanner consumed the budget they had, and the cuts also removed two
entries from the risk register.

---

## Things worth knowing before touching this code

- **`SCENE_CSS` in `src/themes/scenes.js` is a template literal.** A backtick in
  a comment inside it ends the string. This has bitten twice.
- **`money(undefined)` renders as `S$0.00`** rather than throwing, so a missing
  field looks like a real answer. Always assert the number, never that a string
  was produced.
- **React SSR inserts `<!-- -->`** between static text and an expression, so
  `html.includes('avg S$11.71')` fails where `includes('S$11.71')` passes.
- **Never let JavaScript touch the SVG after build.** The build effect in
  `useTheme.js` depends on `[themeId, wide]` and nothing else; adding anything
  budget-related to it restarts every animation on screen.
- **Phone width is verifiable** via an iframe at exactly 390x844 served from the
  same origin — window resizing does not go below ~1512px in this environment.
  That is still not a phone: **nothing has been tested on real iPhone
  hardware.**
- **Date-sensitive tests must use the Singapore day**, not `new Date()` in UTC.
  The one failing check above is exactly this mistake.
- **`scripts/scene-matrix.js`** renders every scene at every level to one page
  for eyes-only checking: `npx vite build --ssr scripts/scene-matrix.js --outDir
  .matrix-build && node .matrix-build/scene-matrix.js [--wide] > out.html`.

## Environment left running

A Vite dev server on `http://localhost:5173/Daily-Expense-Tracker/`. Its
localStorage holds ~30 seeded demo expenses added for testing — that store was
empty beforehand, and it is a different origin from the deployed site, so no
real data was touched. Clear site data for localhost to remove it. These are
**not** the sample dataset of Stage 1; that is still unbuilt.

## Published previews

| | |
|---|---|
| Live app | https://claude.ai/code/artifact/42dca600-bb37-48f8-ae63-6431ab419290 |
| Decay reference, all 9 states x both compositions | https://claude.ai/code/artifact/164bc9e4-3a9b-4eaa-a1df-d2e2dd74d62d |

Both are **stale** — they predate the 7-day chart, the per-view grids, the
watermark move, the travel-loop fix and the receipt scanner. Republish before
showing anyone: `npx vite build --base=./ --outDir dist/artifact --emptyOutDir`,
then publish `dist/artifact/page.html` with the two `assets/` files and the
artifact URL.
