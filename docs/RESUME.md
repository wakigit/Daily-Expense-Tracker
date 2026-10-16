# Where I left off — 2026-10-17 (after Stage 0)

Open this first. It is the state of the repository, what is finished, what is
deliberately not done, and what to pick up next.

**Branch:** `wallpaper-redesign` · **Everything is committed.** Stage 0 landed
the tree as six commits and redeployed the live site.

| | |
|---|---|
| Commits | `0b4c8db` assistant fix · `144adbe` wallpaper + laptop · `fc3e83e` receipt scanning · `2ad4329` browser regressions · `2d9f376` deterministic test · `717d6f2` docs |
| Deployed | `gh-pages` = `29fc463`, built from `717d6f2`, verified in a browser |
| **Not pushed** | `wallpaper-redesign` is **local only.** `origin` has no copy of any of it — the one remaining way to lose this work |
| `main` | Untouched at `74b00e6`, still 23 commits behind. The decision was deferred, not taken |
| Hosting | **Option B.** No backend hosted; the public URL is Path A |

**Verification, after Stage 0:**

| | |
|---|---|
| `npm run build` | clean |
| `npm run smoke` | **518/518** — no accepted failure, at any hour |
| `cd backend && npm test` | 27/27 |
| `git diff --check` | clean |

> **The time-dependent check is fixed.** `scripts/smoke.jsx` used to derive the
> expected "yesterday" from UTC while `parseUtterance` correctly resolves it on
> the Asia/Singapore day, so the suite failed between 00:00 and 08:00 SGT. It
> now injects the fixed clock the parser already accepts and asserts a literal
> date. **The parser was not touched — it was right.** Verified identical under
> `TZ=UTC`, `Asia/Singapore`, `America/Los_Angeles` and `Pacific/Kiritimati`.

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

## Stage 0 — done 2026-10-17

Committed in six commits (not two: the tree held six units of work — two logic
bug fixes that predate both features, the two features, the test fix, and the
docs). Each commit was checked to reproduce the working tree exactly and was
run on its own. The live site was rebuilt and verified in a browser.

**Verified on the live public URL (Path A):** assets load and match the local
build byte-for-byte; all five tabs navigate; expense entry works; the Assistant
answers **from the offline matcher and says so** — *"Answered offline — the
assistant is unreachable"*; receipt scanning reports *"Scanning is unavailable
— the assistant is offline."*; no horizontal scroll at 390px; the 390-wide
scene composition is used; no uncaught exceptions.

**Verified locally with the backend running (Path B):** add, edit, delete and
undo — including undo of a row added in the same session, which is the exact
bug `2ad4329` fixes; voice with permission denied shows *"Microphone permission
denied"* and writes nothing; a receipt scan filled the form with **19.90, the
total after service charge and GST — not the 16.60 subtotal** — and wrote **no
row** until Save was pressed; the model-backed Assistant answered
*"S$115.30 · 11 entries · Read as: Food · this month"*, matching a hand count.

**Seen at both viewports, all three wallpapers, strained and over-budget:**
laptop shows the left rail with per-view grids (Home 760+380 ledger, Overview
and Settings two equal columns, Add and Ask one measure); phone is a single
column with the bottom bar; decay flips 1→2 with the budget on every tab; no
horizontal scroll anywhere; one console warning in total.

### What Stage 0 deliberately did not do

- **`main` was not merged, rebased or pushed.** It sits at `74b00e6`. The
  roadmap's cut condition allows exactly this — deploy from the working branch,
  leave `main` alone — so the decision is still yours.
- **`wallpaper-redesign` was not pushed.** Nobody asked, and pushing a branch
  to a public repo is not a thing to do unasked. It does mean `origin` holds no
  copy of the work.
- **No backend was hosted** (Option B), no API key left the machine, and no
  application code was changed beyond the one test fix Stage 0 called for.

## The next thing to do

**Stage 1 (sample demo data) or Stage 2 (UI polish)** — see `docs/ROADMAP.md`.
Stage 2 depends on nothing and is the shorter of the two. Before either: The uncommitted tree
is the largest risk on the board and the deployed build has no Assistant at all.
Specifically:

1. **Decide whether to push `wallpaper-redesign`.** Until you do, one disk
   failure loses six commits of work.
2. **Decide what to do about `main`**, 23 commits behind: merge it, or declare
   it abandoned and let the deploy keep pointing at the working branch.

Then Stage 1 (sample demo data) and Stage 2 (the three UI issues), which are
cheap and are what a judge meets first.

### Judgement calls still open

0. **Push `wallpaper-redesign`, or not.** Six commits exist only on this
   machine.
1. **The 7-day chart shows on phone too.** It was asked for as a laptop detail.
   It is one component in one place in the DOM; to make it laptop-only, wrap it
   in `.col--main` with `display:none` below 1024px. Say the word.
2. **Whether Stage 6, the roaster, happens at all.** It is marked the cut line
   in the roadmap and cutting it costs the demo nothing.
3. **Whether to rename the product strings** (Stage 7) before judging, or leave
   "Expense Tracker" in the UI.
4. **The actual deadline.** Unconfirmed, so the roadmap gives sizes and a
   dependency order rather than a day-by-day plan. Reconfirm it before trusting
   any schedule.
5. **The number-spinner bug could not be reproduced.** Chrome 153 renders no
   spin arrows and `appearance: none` is in effect. Check Safari and real iOS
   before writing a `::-webkit-inner-spin-button` rule that may do nothing.

### Found on screen during Stage 0, parked for Stage 2

- The **"avg S$x" label on the 7-day chart overlaps the first bar** when that
  bar is tall — both viewports, all three themes.
- An Assistant answer reads **"You spent S$115.30 food this month"** — the
  preposition before the category label is missing.
- `<meta name="apple-mobile-web-app-capable">` is **deprecated** and logs a
  console warning on every load. It is the only console output the app makes.
- The **Assistant screen is very sparse at laptop width** — a small card at the
  top and roughly 650px of empty wallpaper below it. Already Stage 2; it is
  more obvious on a laptop than the note suggested.

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
