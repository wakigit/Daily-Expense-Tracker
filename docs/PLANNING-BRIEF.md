# TallyAI — planning brief

**Purpose.** Paste this whole file into another model to get help thinking about
TallyAI. It is the state of the repository as of **2026-10-17**, verified by
running the test suites and reading the source rather than remembered. The ask
is at the bottom (§9).

**Supersedes** the brief written 2026-10-05, which described a cat mascot
("Tally"), an "Ask Tally" panel, and bank statement import with reconciliation
as the plan. **All of those are now removed from the product** — cut, not
deferred. That brief also listed receipt capture and the laptop layout as not
built; both are now built. If this file disagrees with the code, the code wins.

---

## 1. What it is

**TallyAI** — a mobile-first daily expense tracker for Singapore dollars, with a
typed **AI Assistant** and three live wallpapers that react to the budget. Built
solo for a hackathon.

The thesis: people quit expense tracking because logging is tedious and the
payoff is a dashboard they still have to read. So the product optimises for
seconds-to-log and for answering questions in sentences.

> **The Assistant is a normal section of the app — not a character.** There is
> no mascot, no "Ask Tally" framing and no docked assistant panel. The animation
> budget belongs to the wallpapers, which already work.

> **Naming:** the code, the repository and the deployed URL still say "Expense
> Tracker" / `Daily-Expense-Tracker`. Renaming the product strings is planned;
> renaming the repository is deliberately **not**, because it breaks the public
> URL.

## 2. Stack, verified 2026-10-17

- React 19 + Vite 8, JavaScript, **no UI framework** — hand-rolled CSS driven
  entirely by custom properties.
- ~7,990 lines across 46 files in `src/`.
- Persistence: `localStorage`, six keys (`ww_*`), behind `src/lib/storage.js`,
  whose functions are already `async` so a backend swap is a change to that one
  file.
- **A backend exists**: `backend/`, Node ≥20.12, `node:http`, one dependency
  (`openai`). **Three routes**: `GET /health`, `POST /assistant/intent`,
  `POST /assistant/receipt`. Model `gpt-4.1-mini`.
- Tests: **518** frontend checks (`npm run smoke`), **all passing**, and **27**
  backend checks (`npm test`). No framework: a bespoke SSR-render-and-assert
  script. **No CI.**
- Deployed: GitHub Pages from `gh-pages`, **current as of 2026-10-17** and
  verified in a browser, with **no backend deployed** — see §3.1, which is the single most important thing to understand about what a
  stranger can actually reach.

## 3. What is built and working

**Tracker.** Add/edit/delete with undo and swipe. Custom categories with
colours. Per-category monthly budgets with a five-state status model shared by
every screen. Month total, donut, last-7-days bar chart, searchable list, month
navigation, category drill-down. Money summed in integer cents. Dates on the
Asia/Singapore calendar day, so a 1 a.m. supper is dated today.

**Three live wallpapers, in two compositions each.** Forest, beach, city, drawn
at 390×844 for the phone and 1440×900 for the laptop, sharing one set of class
names so a single stylesheet drives both. They run down across **three** states
— healthy under 80%, strained 80–100%, run down past it — from `decayLevel()`
in `src/lib/status.js`, which is a *projection* of `budgetStatus()` rather than
a second set of thresholds. Every level reversible; loops never restart visibly;
loops pause off Home and when the page is hidden. Reduced motion honoured, with
an in-app override.

**A laptop layout.** Below 1024px the phone column is untouched; at 1024px and
up a navigation rail, a centre overview column and a transaction ledger, sharing
one component set and one state model. `BottomNav` becomes a vertical rail
purely in CSS. The 768–1023px band deliberately gets no layout of its own.

**Typed AI Assistant.** `POST /assistant/intent`, OpenAI Responses API with
Structured Outputs (`strict: true`), the category enum rebuilt from the user's
real category ids on every request. **Five intents** (answer, propose_add,
find_delete_candidates, undo, clarify), **nine metrics** over **seven time
windows**, optionally scoped to one category. Confirmation cards for anything
that changes data. Deletion targets resolved from the model's *description*
against real rows — never a model-supplied id. Each answer states how it was
interpreted. Offline regex fallback when the backend is unreachable, which is
how the deployed build runs.

**Voice into the Add form.** A mic button fills expense fields from speech,
including a Singapore-correct "yesterday". It pre-fills and never submits. With
permission denied it reports why rather than failing silently.

**Receipt scanning.** `POST /assistant/receipt` takes a downscaled image and
returns a **draft** that fills the Add form. **It pre-fills and never submits** —
that is the central rule, because OCR reads the subtotal instead of the total,
loses decimal points and misreads years, confidently. Five guards: the total is
specified as the figure *after* service charge and GST; the model can declare
the image is not a receipt; unreadable fields come back `null` and are named,
never guessed; currency is reported and **never converted**; and a
foreign-currency scan **actively clears** the amount field rather than leaving a
stale SGD figure one tap from being saved. The merge has one definition
(`mergeReceiptIntoForm`) and is regression-tested on merged form state, not just
on the field patch.

This is the only feature that sends user content off the device, the only one
with **no offline fallback**, and it is opt-in per photo and stored nowhere.

### 3.1 …but only two of those reach the public URL

`src/lib/assistantClient.js:23` points the frontend at `http://127.0.0.1:8787`
unless `VITE_ASSISTANT_URL` is set at **build** time; `receiptClient.js` reuses
it. **`127.0.0.1` is whatever device the page is open on** — a visitor's phone,
never the developer's laptop. **No backend is hosted**, so the public URL has
nothing to reach. Two paths follow, and they are different demos:

**Path A — public URL, no hosted backend.** The tracker, both layouts, all three
wallpapers and the decay, manual entry and voice entry (browser speech, not the
server) all work. The Assistant works **via the offline regex matcher**, with the
same arithmetic and narrower language. **Receipt scanning does not work at all**
— no local substitute for a vision model exists, and the button reports
*"Scanning is unavailable — the assistant is offline."* A complete, honest
tracker with an offline assistant; not an AI demo.

**Path B — the author's laptop with the local backend running.** All of Path A
plus the model-backed Assistant and receipt scanning end to end. Should be driven
from `http://localhost:5173/…`: an HTTPS Pages page calling `http://127.0.0.1` is
mixed content and that combination is **untested**.

**Consequence:** a rehearsal with the backend stopped exercises Path A and
**cannot include receipt scanning**, which has no fallback by design.

**Whether to host a backend is undecided** — no provider chosen, nothing
deployed. Note for anyone reasoning about it: **CORS does not protect a hosted
endpoint from abuse.** It is browser-enforced and governs which pages may read a
response; `curl` ignores it, and the endpoint URL ships in the public bundle. A
hosted backend that forwards images to a paid vision model needs provider-side
spend caps and real rate limiting — **neither of which exists in the code
today** — not an origin allowlist.

## 4. What is NOT built

- **No accounts, no login, no database, no sync, no server storage.**
  `localStorage` on one device, six keys, no export. Nothing in the product
  presents accounts as existing.
- **No sample demo data** — a first-time opener sees an empty shell. Planned.
- **No spending comparisons, no source-row explanations, no charts inside
  Assistant answers, no budget forecast.** All planned.
- **No roaster.** Planned, opt-in, off by default.
- **No voice in the Assistant.** Speech reaches the Add form only. LATER.
- **No follow-up context** — each Assistant message is independent.

## 5. Removed from the product — cut, not deferred

Listed explicitly because a planning model will otherwise helpfully suggest
them back:

- **The cat mascot ("Tally the cat") and the "Ask Tally" framing.** The feature
  is the AI Assistant, a section of the app.
- **Bank statement import (CSV or PDF).** PDF layouts differ per bank; CSV
  without reconciliation is a half-feature, and with it, it was the largest item
  on the old plan.
- **Card syncing.** Requires accounts, a provider integration and a trust
  posture this project does not have.
- **Transaction reconciliation, duplicate detection and merge queues.** They
  existed only to serve import.

Receipt scanning stays — it is built, it is the good half of ingestion, and it
needs none of the above. **The hackathon demo uses sample financial data
generated for it.** No real statement, card or account is involved.

## 6. The rule that shapes everything

**The model interprets language; application code does arithmetic.**

`src/lib/intent.js` constrains what the model may say and is imported by both
the server and the client, so the schema cannot drift. `src/lib/stats.js`
computes every figure from the real rows. A number the model produced is
discarded. Anything that changes data is a proposal until a person confirms it.

This is the most defensible property of the build and the centre of the demo
story. It is also fragile in one specific way: a bug in a *caller* can silently
render a correct-looking wrong figure, because `money(undefined)` renders as
`S$0.00` rather than throwing. That has happened once — four branches read a
field that did not exist. Every new metric now gets a test asserting against a
hand-computed sum.

## 7. Hard constraints

1. **The API key lives server-side only.** `OPENAI_API_KEY` is read in
   `backend/src/provider.js` and nowhere else; it is never logged, never
   returned, never sent to the browser. The repo is public and the frontend is a
   static bundle, and **Vite inlines every `VITE_`-prefixed variable into the
   client bundle** — so a key named `VITE_OPENAI_API_KEY` would be a published
   key. The one `VITE_` variable in the app is the backend URL, which is not a
   secret. CORS is an allowlist, which stops a hostile page using a visitor's
   browser but is **not** an access control — a direct caller ignores it, and
   today it is the `127.0.0.1` binding that actually protects the key (§3.1).
   Bodies are capped; the image MIME type is
   checked against an allowlist. With no key configured the routes refuse rather
   than calling out, and the refusal text carries no credential.
2. **No arithmetic in the model.** Non-negotiable; see §6.
3. **Nothing changes without confirmation**, and Assistant changes are undoable.
4. **The receipt scanner pre-fills and never submits.** A draft a person checks,
   never a row.
5. Phone is the design target; the laptop must be genuinely good, not stretched.
6. SGD only. Currency is reported, never converted.
7. The author is learning as they go and wants maximum learning value, not a
   finished block of code handed over.

## 8. Known weak points

- **The work is committed but never pushed.** Six commits sit on
  `wallpaper-redesign` locally; `origin` has no copy, so a disk failure still
  loses all of it. `main` is 23 commits behind, still holds the pre-Vite
  single-file build, and was deliberately left alone.
- **Three cosmetic defects seen on screen** and deferred to Stage 2: the
  "avg S$x" label on the 7-day chart overlaps a tall first bar; an Assistant
  answer reads "S$115.30 food this month" with the preposition missing; and a
  deprecated `apple-mobile-web-app-capable` meta tag logs a console warning on
  every load.
- **A documented bug that would not reproduce:** native number spinners in the
  Amount field. Chrome 153 renders none and `appearance: none` is in effect.
  Unverified on Safari and real iOS — do not "fix" it before checking there.
- **Nothing has been tested on real iPhone hardware.** Every "works on phone"
  claim means a 390×844 viewport in desktop Chrome.
- `src/App.jsx` owns most state and every handler. It is the natural place for
  the next feature and the worst place for it.
- No test framework and no CI. One bespoke script is the whole safety net.
- No router — view state is a string in `App.jsx`. No deep links, no back button.
- No error boundary; a render error blanks the screen.
- `storage.js` swallows write failures silently, so a full quota loses data with
  no signal.
- **Three UI issues a judge meets in the first thirty seconds:** native number
  spinners in the Amount field (`-webkit-appearance: none` does not remove them;
  `::-webkit-inner-spin-button` is absent), long category names truncating on
  the phone donut legend, and a sparse Assistant screen before any question is
  asked. Budget inputs also display raw floats (`166.66666666666666`).
- `SCENE_CSS` in `src/themes/scenes.js` is a template literal — a backtick in a
  comment inside it ends the string. This has bitten twice.

## 9. What I want from you

Solo, for a hackathon judged on **usefulness, business value, creativity and
uniqueness**. Demo on a laptop; judges may open the public URL on their own
phones — which, per §3.1, is Path A and shows less than the presentation.

**The deadline has not been reconfirmed.** Do not plan against a seven-day
countdown; give me sizes and a dependency order, and say what gets cut if the
window turns out to be three days.

The work that remains is **depth on what exists, not new pillars**: sample demo
data · the three UI issues in §8 · Assistant comparisons and source-row
explanations · charts inside answers · a qualified arithmetic budget forecast ·
an opt-in roaster · product-string rename · deploy and rehearse. The current
plan and its cut line are in `docs/ROADMAP.md`.

0. **Backend hosting: settled as Option B for this build** — no hosted
   backend, the public URL is Path A, the presentation is Path B from my
   laptop. Do not re-litigate it for the hackathon. If you think it is wrong
   for *after* the hackathon, say so in a line — but do not propose CORS, a
   bundled token, or an obscure URL as the abuse control; none of them stops a
   direct caller, and a provider spend *alert* is not a cap.
1. **Challenge the ordering next.** My position is that Stage 0 (commit, fix the
   failing smoke expectation, redeploy) outranks every feature, because the live
   URL today has no Assistant — and that source-row explanations beat comparisons
   per hour, because they reinforce the trust story in §6. Tell me where that is
   wrong.
2. **Attack the forecast.** It is run-rate arithmetic with heavy labelling and
   suppression below five elapsed days. Is the labelling sufficient, or is any
   month-end figure from a partial month misleading no matter how it is worded?
3. **Attack the trust boundary in §6.** Is it as defensible as I think, or is
   the `money(undefined)` → `S$0.00` behaviour a hole that labelling cannot
   close?
4. **Tell me what else to cut.** Cutting is the part I am bad at. The roaster is
   already marked as the cut line; say if something above it should go too.
5. **Flag anything in §8** that will block a later stage, versus what is merely
   untidy and can wait until after the hackathon. The uncommitted tree and the
   failing smoke check are the two I am least comfortable with.

Do **not** propose bank statement import, card syncing, reconciliation, a mascot
character, or accounts and login. Those are settled cuts (§5); re-proposing them
costs me time. If you think a cut was wrong, say so in one line and move on.

Assume I am competent but inexperienced at scoping. Give me concrete positions
to react to, not questions back. If you need a fact I have not supplied, state
the assumption and continue.

Output: a short verdict on the ordering · a ranked table of what remains · a
"cut these too" list · three lines on what to do first.
