# TallyAI — Product Requirements

**Owner:** Wei Kai (@wakii___)
**Status:** Active. Rewritten 2026-10-16 against the code; re-verified and
corrected 2026-10-17 against the code and the git state, including the two demo
paths in §9.1. **Stage 0 was executed and verified the same day**, so the
deployment and test figures below are current rather than aspirational.
**Repository:** `Daily-Expense-Tracker` (directory, git remote and deployed URL
still carry the old name; see *Naming*)

> **How to read this document.** Every status label below was checked against
> the source on 2026-10-16 and re-checked on 2026-10-17. Where an earlier draft of this PRD disagreed with
> the code, the code won and the document was corrected — in both directions:
> some things claimed as unbuilt are built, and some things implied as working
> are not.

---

## Naming

The product is **TallyAI**. The assistant is simply **the AI Assistant** — it is
a section of the app, not a character.

There is no mascot. The "Tally the cat" concept and the "Ask Tally" framing have
been **removed from the product**, not deferred. See §7.

Nothing in the code has been renamed. `index.html`, `src/App.jsx`,
`src/hooks/useAppData.js` and `backend/package.json` still say "Expense
Tracker", and the repository, remote and GitHub Pages URL still say
`Daily-Expense-Tracker`. Renaming the product strings is a scheduled task
(Stage 7); renaming the repository is deliberately *not* planned, because it
breaks the public URL for no judging benefit.

---

## 1. Problem

Most people who start tracking expenses stop within a week. Not because they
stop caring about money — because **logging is tedious** and **the payoff is a
dashboard they still have to read themselves**.

- **Capture.** A typical tracker asks for description, amount, category, date
  and note before it will record a $1.40 kopi. That friction is paid every
  time; the reward arrives much later, if at all.
- **Comprehension.** When the data exists, it answers in charts. People think
  in sentences — *"how much did I spend on food this week?"*, *"am I spending
  more than last month?"* — and are left to do the reading and the arithmetic.

## 2. Target user

A Singapore university student tracking day-to-day spending in SGD. Pays for
food, Grab rides, EZ-Link top-ups and the occasional impulse buy, mostly from a
phone. Has a rough monthly budget in their head and no idea whether they are on
track. Not an accountant, will not maintain a spreadsheet.

**Hackathon context, which is a real requirement and not a footnote:** the demo
is driven on a **laptop**, and judges may open the **public URL on their own
phones**. Both have to be good. A phone layout stretched wide fails the first;
a laptop layout squeezed down fails the second.

## 3. Value proposition

> Ask where your money went, in plain English, and get an answer the app can
> prove.

Three properties distinguish this from the many LLM-plus-spreadsheet demos:

1. **The model never produces a figure.** It chooses which question is being
   asked; application code computes the number from the real records and
   discards any number the model supplied. Enforced by a schema, not by a
   prompt. **True in the code today.**
2. **Nothing changes without confirmation.** Every assistant action that would
   alter data is shown as a card with the exact values, and is reversible.
   **True in the code today.**
3. **The wallpaper is a second reading of the budget.** Three live scenes decay
   as the month is spent, without ever being the only signal. **True in the code
   today.**

---

## 4. Status of every feature

| Label | Meaning |
|---|---|
| **BUILT** | In the code and verified working |
| **BUILT, UNVERIFIED ON DEVICE** | In the code; works in desktop Chrome; not yet exercised on real iPhone hardware |
| **PLANNED** | Committed for this build. `docs/ROADMAP.md` gives each stage a user benefit, frontend work, backend work, acceptance criteria, dependencies and a cut condition |
| **LATER** | Deliberately outside this build |
| **REMOVED** | Cut from the product; not a hidden later stage |

### 4.1 Tracker core — BUILT

- Record an expense: description, amount (SGD), category, date, optional note.
  Invalid input is rejected with the offending field highlighted **and a message
  naming the actual fault** ("The amount has to be more than zero."), not a
  generic line.
- Edit and delete any expense. Delete is instant with an Undo toast; swipe to
  act on a row.
- Custom categories with colours. Deleting one warns that its expenses go too.
- Monthly budget per category. Five-state status model — *No budget set · On
  track · Close to limit (≥75%) · Budget reached (=100%) · Over budget (>100%)*
  — defined once in `src/lib/status.js` and shared by every screen, so they
  cannot disagree.
- Month total, per-category donut, last-7-days bar chart, full transaction list
  with search and sort, month navigation, per-category drill-down.
- All money arithmetic in integer cents; stored amounts stay decimal.
- Dates follow the **Asia/Singapore** calendar day, not UTC and not device
  local, so a 1 a.m. supper is dated today.

### 4.2 Live wallpapers — BUILT

Three scenes (Moonlit Forest, Sunset Beach, Rainy City), each drawn in **two
compositions** — 390×844 for the phone and 1440×900 for the laptop — sharing one
set of class names so a single stylesheet drives both.

They **decay in three steps** as the month is spent — *healthy* under 75%,
*strained* 75–100%, *run down* past it — from `decayLevel()` in
`src/lib/status.js`, which is a projection of `budgetStatus()` rather than a
second set of thresholds. Decay is fully reversible; loops never restart
visibly. Loops pause off the Home tab and when the page is hidden.
`prefers-reduced-motion` is honoured with an in-app override.

Travel distances come from `travel()` in `src/themes/scenes.js` and are unit
tested, because hard-coded phone user-units made cars re-enter mid-screen in the
wide composition.

### 4.3 Laptop layout — BUILT

Below 1024px the phone column is untouched. At 1024px and up: a left navigation
rail, a centre overview column and a right-hand transaction ledger. One
component set, one state model — `BottomNav` becomes a vertical rail purely in
CSS; the columns are `display: contents` on phone, so the phone renders the
identical box tree it did before the laptop work existed.

There is exactly one layout breakpoint, at 1024px: the 768–1023px band
deliberately gets no layout of its own, and the phone column therefore runs up
to 1024px rather than stopping at 768px.

### 4.4 AI Assistant (typed) — BUILT

A normal section of the app, reached from the nav. Not a character, not a docked
side panel.

- Backend endpoint `POST /assistant/intent`. OpenAI Responses API with
  **Structured Outputs**, `strict: true`. The category enum is rebuilt from the
  user's real category ids on every request, so an invented category is not
  something the model is able to emit.
- **Five intents:** `answer`, `propose_add`, `find_delete_candidates`, `undo`,
  `clarify`. Validated by a shared schema on the server **and again** on the
  client.
- **Nine metrics** (`total`, `count`, `top_day/week/month/category`,
  `average_per_day/week/month`) over **seven periods** (`today`, `yesterday`,
  `week`, `lastweek`, `month`, `lastmonth`, `all`), optionally scoped to one
  category.
- Add and delete arrive as confirmation cards; deletion targets are resolved
  from the model's *description* against real rows, never from a model-supplied
  id. "Undo that" reverses the assistant's own last change.
- Every answer states how it was interpreted — *"Read as: Food · this month"*.
- **Offline fallback:** if the backend is unreachable or has no key configured,
  a local regex matcher answers with the same arithmetic. The deployed GitHub
  Pages build runs in exactly this mode, having no server.

### 4.5 Voice entry — BUILT (Add form only)

A microphone button on the **Add form** fills expense fields from speech
(`src/lib/speech.js`, `src/lib/parseUtterance.js`), including a
Singapore-correct "yesterday". It pre-fills and never submits.

Speaking a *question* to the Assistant does not exist and is **LATER** — it is a
nice-to-have that competes with capabilities judges can actually see.

Degradation is verified: with no microphone permission the button reports
"Microphone permission denied" rather than failing silently or crashing.

### 4.6 Receipt scanning — BUILT

`POST /assistant/receipt` takes a downscaled image and returns a **draft**;
`src/components/ReceiptButton.jsx` puts that draft into the Add form.

**It pre-fills and never submits.** This is the central rule and it is not a
detail — OCR reads the subtotal instead of the total, loses a decimal point and
misreads years, and does all of it confidently. A person sees every field before
it becomes a row.

Five guards against a confidently wrong scan:

- The total is specified as the figure **after** service charge and GST — not
  the subtotal, not the cash tendered. This is the most common failure, and it
  is verified: a test receipt with subtotal 20.60 and total 24.70 returns 24.70.
- The model is given an `isReceipt` flag to set, so a photo of a cat is refused
  rather than having plausible fields invented for it.
- Any field it cannot read comes back `null` and is named in the message, never
  guessed. Unread fields are omitted from the form patch, so a partial scan adds
  to what is already typed rather than blanking it.
- Currency is **reported, never converted** — this app holds no exchange rates.
- **A foreign-currency scan actively clears the amount field** and says so in a
  warning, rather than leaving a previously typed SGD figure sitting under the
  new receipt's name. Omitting the field was not enough: these fields are merged
  over the form, so omission silently kept a stale number one tap from being
  saved. The merge now has one definition (`mergeReceiptIntoForm`) and is
  regression-tested on the *merged form state*, not only on the field patch.

**Honest caveat, not retired:** testing used crisp rendered receipts, not
creased thermal paper photographed in bad light. What is proven is that a bad
read is *safe* — it produces a draft you check — not that every read is good.

**This is the only feature that sends user content off the device.** Nothing
accompanies the image but the category names and today's date, it is opt-in per
photo, and it is never stored — the server processes it in memory and persists
nothing. It is also the only feature with **no offline fallback**: a vision
model cannot be substituted locally, so the button says so on the Pages build
rather than failing silently.

### 4.7 Backend and API key handling — BUILT

`backend/`, Node ≥ 20.12, `node:http`, one dependency (`openai`). Three routes:
`GET /health`, `POST /assistant/intent`, `POST /assistant/receipt`.

**The key protection is the part to preserve verbatim when this document is
summarised:**

- `OPENAI_API_KEY` is read **server-side only**. It is never logged, never
  included in a response, and never sent to the browser.
- The repository is public and the frontend is a static bundle. **Vite inlines
  every `VITE_`-prefixed variable into the client bundle**, so a key named
  `VITE_OPENAI_API_KEY` would be a published key. The name matters.
- CORS is an **allowlist**, not a pass-through — which stops a hostile page
  driving this server through a visitor's browser, and is **not** an access
  control against a direct caller. `curl` and any script ignore CORS entirely.
  While the server binds `127.0.0.1` that gap is closed by the binding, not by
  the allowlist; see §9.1 for what hosting it would require. Request bodies are
  capped (8KB
  for intents; a larger, explicitly computed cap for the base64 image route).
  The image MIME type is checked against an allowlist before it is interpolated
  into the provider call.
- Error paths never print the key, the raw provider response, or free text from
  the model.
- `npm run verify` checks the key and model cheaply; `npm run verify:live` sends
  one real request.
- With no key configured the routes refuse rather than calling out, and the
  refusal text carries no credential. This is asserted in the backend tests.

### 4.8 Tests — BUILT

- **518 frontend checks** (`npm run smoke`): SSR render assertions plus pure
  logic, run in Node with no browser and no framework. **All 518 pass.** The
  one check that used to fail for eight hours of every day — it derived the
  expected "yesterday" from UTC while `parseUtterance` correctly uses the
  Asia/Singapore day — was fixed in Stage 0 by injecting a fixed clock and a
  literal date. The parser was not changed, because the parser was right.
  Verified identical under four timezones.
- **27 backend checks** (`cd backend && npm test`): mocked, no key and no
  network needed. All pass.
- `npm run build` is clean.
- No CI. The scripts are the whole safety net and must be run by hand.

### 4.9 Not built

| Feature | Status | Note |
|---|---|---|
| Spending comparisons ("vs last month") | **BUILT** | Matching elapsed month/week ranges, local cent arithmetic and separate evidence for each side. |
| "Which transactions make that up?" | **BUILT** | Immutable source rows, with out-of-date warnings after relevant ledger changes. |
| Charts inside Assistant answers | **PLANNED** | Stage 4. Reuses the existing chart components. |
| Budget forecast | **PLANNED** | Stage 5. Arithmetic projection, explicitly qualified — see §5.3. |
| AI roaster | **BUILT** | Default on; Settings off switch and optional local personalisation. Runs after confirmed new saves, bounded intensity, cache, offline fallback. |
| Sample demo data | **PLANNED** | Stage 1. A first-time opener currently sees an empty shell. |
| Voice *into the Assistant* | **LATER** | The Add-form path exists and is the foundation. |
| Accounts, login, sync, server storage | **LATER** | See §6. Not presented as existing anywhere. |
| Data export | **LATER** | `localStorage` is the only copy; clearing site data loses it. |
| Follow-up context ("what about last month?") | **LATER** | Each message is independent today. |
| Per-category `essential` flag | **LATER** | A real data-model change for one question shape. |
| Multi-category questions | **LATER** | Schema supports one category; it clarifies rather than guessing. |
| Animated cat mascot | **REMOVED** | §7 |
| Bank statement / CSV import | **REMOVED** | §7 |
| Card syncing | **REMOVED** | §7 |
| Transaction reconciliation and dedup | **REMOVED** | §7 |

---

## 5. Capability detail

### 5.1 Spending comparisons

Today every metric reports one window. A comparison returns **two windows and a
delta**, with the direction and the percentage computed in `src/lib/stats.js`
and asserted against hand-computed figures.

Shapes worth supporting, in priority order:

1. *This period vs the previous one* — "more than last month?"
2. *This period vs the user's own average* — "is this a heavy week?"
3. *One category across two periods* — "am I spending more on food?"

A comparison answer must still state its interpretation, and must say plainly
when one side has too little data to compare rather than reporting a meaningless
percentage against a near-zero base.

### 5.2 Charts in Assistant answers

The donut and the 7-day bar chart already exist as components. A comparison or a
breakdown answer should be able to render **one small chart beneath the
sentence**, not instead of it. The sentence remains the answer; the chart is
corroboration. Rules: no chart without the figure in words, no chart type the
phone column cannot carry, and the same computed numbers behind both.

### 5.3 Budget forecast — and exactly how it must be qualified

A projection of month-end spend from the month so far.

**Method.** Run rate: spend to date ÷ days elapsed × days in month, with the
current month's real calendar. This is arithmetic, not a model and not ML. No
seasonality, no learning, no per-category behaviour modelling.

**It must be presented as an estimate and never as a prediction.** Concretely:

- Labelled as a projection *at the current rate*, with the rate stated.
- Shown with the number of days it is based on, because a projection from three
  days is nearly meaningless and the user can see that for themselves.
- Suppressed entirely below a minimum number of elapsed days (proposed: 5) and
  when no budget is set, rather than printing a confident figure from noise.
- Never phrased as what the user *will* spend. "At this rate, about S$X by the
  31st" — not "You will spend S$X".
- Never used to drive the wallpaper decay or the status chip, which stay on
  actual spend. A forecast that darkened the world for money not yet spent would
  be the app lying about the present.

This is the one planned capability most likely to read as a fabricated number,
so it carries the heaviest labelling requirement in the product.

### 5.4 AI roaster

**Built, enabled by default.** A persistent Settings switch stops requests and
dismisses the card. Preferred name starts blank. Singapore and SMU references
start disabled and are optional local preferences, not inferred identity.

**Triggers:** only successful new form saves (manual, voice-filled and confirmed
receipt drafts) and confirmed assistant adds. The ledger is flushed first. Never
on edit, sample loading, reload, delete or undo. Roasting has no mutation path
back to the ledger. A loading card confirms that saving has already completed.

**Verified facts:** exact normalised description plus category for weekly/monthly
repeats, their integer-cent totals, and category month spending. Facts include
inclusive date ranges and the new expense exactly once by ID. Distinct saved IDs
count separately even if they look identical. Similar names and all Food expenses
are never merged into a merchant habit. Future dates are excluded.

**Bounded budget tone:** current-day purchases use overall current month spending
after saving: below 75% is light (0), 75% through 100% is sharper (1), above
100% is dramatic absurdity (2), never cruelty. No budget is neutral (0).
Backdated purchases use a historical/unavailable band (0), with no category
budget percentage or implied historical budget setting.

**Rotation:** dramatic narration, absurd accounting, mock corporate reporting,
and Singapore/SMU angles only when enabled. The preferred name is supplied only
occasionally. One short sentence (preferably 8–18 words) targets the purchase or supported habit,
never identity, worth, hardship, family, academic results or invented motives.
No made-up offers, prices, investment returns or personal circumstances.

**Privacy and model boundary:** only current purchase description, SGD cents and
category label, up to three aggregate facts with ranges, band/intensity, angle,
and enabled preferences are sent. No full ledger, notes, receipt or IDs. Name and
description are untrusted data, never instructions. Model output is prose only;
all factual inputs are calculated locally. Semantic grounding remains a model
limitation, not something syntactic validation can guarantee.

**Reliability:** shared local/Vercel `/assistant/roast` validation, 4-KiB input,
120-character/single-sentence output, 100 output tokens, 8-second provider deadline
without retries, 10-second browser deadline and 2-KiB response cap. Fixed safe
errors produce a labelled offline quip. Cache by transaction ID survives reload,
including interrupted attempts without retry. Late responses cannot replace a
newer purchase. Edit, delete or undo of the purchase clears obsolete content.

**Public demo limitation:** per-instance Vercel IP throttling is best-effort,
10 calls per minute, with no authentication or distributed spending quota.
Account billing controls and platform protection are separate release checks.

### 5.5 Sample demo data

A seeded dataset that makes every feature visible in under two minutes:
budgets set, enough history for month-over-month comparison, at least one
category over budget so the decay and the status model are both legible, and
rows recent enough that the 7-day chart is populated.

It must be **explicitly loadable and clearable from Settings**, must never
overwrite real rows without saying so, and must be obviously sample data rather
than something a judge could mistake for a real ledger.

**It is sample financial data generated for the demo.** No real bank statement,
card or account is involved in producing it, and loading it does not imply any
account, login or sync exists — none does (§6).

---

## 6. Accounts — what they would actually require

**Not built, not planned for this build, and not presented anywhere in the
product as existing.** There is no user, no session, no database and no
authorization. Everything lives in `localStorage` under six keys behind
`src/lib/storage.js`, whose functions are already `async` precisely so that a
later swap to a remote API is a change to that one file.

If accounts are built in a later version, this is the minimum bar before *any*
real financial data is accepted from a stranger:

- Server-side auth with passwords hashed using a memory-hard function (Argon2id
  or bcrypt), never a bare hash.
- Session cookies `HttpOnly`, `Secure`, `SameSite=Lax`, with server-side expiry,
  rotation on privilege change, and logout that invalidates server-side.
- Per-user authorization enforced **in the data layer**, so no query can return
  another user's rows even if a handler forgets a check.
- Account recovery that does not become an account-takeover path.
- Data export and hard deletion that actually removes rows and files.
- A real database with per-user isolation and backups — not a JSON file.
- HTTPS everywhere, a real host, secrets in the host's secret store.
- A privacy statement saying what is stored, where, and for how long.

That is 16–30+ hours of work done carefully, and the failure modes — a session
bug exposing another user's ledger, a weak password store, no deletion path —
harm real people and cannot be undone by a patch. **A frontend-only login form
is not an account system and will not be described as one.** The hackathon build
keeps data local, which is also its own mitigation.

---

## 7. Removed from the product

These are **cut, not deferred**. They are not hidden later stages and should not
reappear as "stretch goals".

- **The animated cat mascot ("Tally the cat").** The assistant is a normal
  section of the app. There is no character, no mascot state machine, and no
  docked assistant side panel. The animation budget belongs to the wallpapers,
  which already work.
- **The "Ask Tally" framing.** The feature is the **AI Assistant**.
- **Bank statement import (CSV or PDF).** Removed. PDF layouts differ per bank;
  CSV import without reconciliation is a half-feature; with reconciliation it is
  the largest single item on the old plan.
- **Card syncing.** Removed. Requires accounts, a provider integration and a
  trust posture this project does not have.
- **Transaction reconciliation, duplicate detection and merge queues.**
  Removed along with import, since they exist only to serve it.

Receipt scanning stays — it is built, it is the good half of ingestion, and it
needs none of the above.

## 8. Non-goals

Unchanged: multi-currency and FX · direct bank API integration · expense
splitting and social features · income, savings goals, investments, net worth ·
desktop-first layout at the expense of the phone · ML categorisation.

Forecasting is no longer a blanket non-goal: a **qualified arithmetic
projection** is in scope under the constraints in §5.3. Model-driven or learned
forecasting remains out.

---

## 9. Architecture as built

**Frontend.** React 19 + Vite 8, no UI framework, ~7,100 lines across `src/`.
Hand-rolled CSS driven entirely by custom properties — which is what makes a
theme swap cost nothing. State in hooks; persistence behind
`src/lib/storage.js`.

```
src/
  views/       one file per screen
  components/  shared pieces
  lib/         the logic — all pure, all testable in Node
    status.js     budget thresholds, and the wallpaper's decay level
    stats.js      every number the assistant can report
    actions.js    add / delete / undo, shared by the UI and the assistant
    money.js      integer-cent arithmetic
    intent.js     the model contract — imported by the backend too
    receipt.js    the receipt contract — imported by the backend too
    assistant.js  turns a validated intent into a plan, never into a change
    storage.js    the only place that touches persistence
  themes/      design tokens and the wallpaper engine
                 scenes.js holds two compositions per scene, phone and laptop
backend/       the assistant and receipt endpoints, and the API key
```

**The rule that shapes the architecture:** the model interprets language,
application code does arithmetic. `src/lib/intent.js` constrains what the model
may say; `src/lib/stats.js` computes every figure from the real rows. A number
the model produced is discarded. Anything that changes data is parked as a
proposal until a person confirms it.

This is fragile in one specific way: a bug in a *caller* can render a
correct-looking wrong figure, because `money(undefined)` renders as `S$0.00`
rather than throwing. That has happened once. Every new metric therefore gets a
test asserting against a hand-computed sum.

**Deployment.** GitHub Pages, `gh-pages` branch, at
`https://wakigit.github.io/Daily-Expense-Tracker/`. **The live build is
current as of 2026-10-17** (`29fc463`, built from `717d6f2`) and was verified
in a browser: assets load, all five tabs navigate, expense entry works, the
Assistant answers from its offline matcher and says so, and receipt scanning
reports that it is unavailable. It still runs in offline-fallback mode, which
is Path A and intended under Option B — **not** a stale build.

`main` is **23 commits behind** and still holds the pre-Vite single-file
build. It was deliberately left untouched in Stage 0; what to do with it is
still open. The deploy points at the working branch instead.

**Everything described as BUILT above is committed** as of Stage 0, as six
commits on `wallpaper-redesign` (`0b4c8db` … `717d6f2`). **The branch has not
been pushed**, so `origin` still has no copy of any of it — the only remaining
exposure from what used to be an uncommitted tree.

### 9.1 Two demo paths — what the public URL can and cannot do

Every **BUILT** label in §4 is a claim about the code, not about what a stranger
can reach. Two of them are only reachable with a backend running, and that
distinction decides what can be promised to a judge.

`src/lib/assistantClient.js:23` sets the endpoint to `http://127.0.0.1:8787`
unless `VITE_ASSISTANT_URL` is set at **build** time;
`src/lib/receiptClient.js` reuses it. **`127.0.0.1` is whichever device the page
is open on** — on a judge's phone it is the judge's phone, where nothing is
listening. It is not the presenter's laptop and cannot be made into it by
running a server. And because Vite inlines the value at build time, pointing the
frontend at a hosted backend means **rebuilding the frontend**, not just
starting one.

**No backend is deployed**, so today the public URL has nothing to reach.

**Path A — the public GitHub Pages URL, no hosted backend.** Everything in §4.1
(tracker core), §4.2 (wallpapers), §4.3 (laptop layout) and §4.5 (voice into the
Add form) works, because none of it needs a server — speech recognition is the
browser's. §4.4's Assistant works **in offline-fallback mode**: the local regex
matcher in `src/lib/ask.js` answers with the same arithmetic. **§4.6, receipt
scanning, does not work at all** — a vision model has no local substitute, and
the button reports *"Scanning is unavailable — the assistant is offline."*
(`src/lib/receiptClient.js:76`). This is a complete and honest product: a
tracker with an offline assistant. It is not an AI demo.

**Path B — the presenter's laptop with the local backend running.** All of Path
A plus the model-backed Assistant and receipt scanning end to end.

> Path B should be driven from the local dev server, not from the Pages URL. An
> HTTPS page calling `http://127.0.0.1` is a mixed-content request, and
> private-network-access rules may require a preflight this server does not
> implement. `ALLOWED_ORIGINS` already lists the Pages origin, so the
> combination looks like it should work — but **it has never been tested**, and
> a presentation is the wrong place to find out.

**Consequence for rehearsal.** A rehearsal with the backend stopped exercises
Path A — the Assistant fallback and the tracker — and **cannot include receipt
scanning**, which has no fallback by design. Receipt scanning is rehearsed
separately on Path B. `docs/ROADMAP.md` Stage 8 carries both as separate
acceptance lists.

**Whether to host a backend is undecided**, and no provider has been chosen.
`docs/ROADMAP.md` holds the options. One point belongs here because it is a
security property and not a scheduling one: **CORS does not protect a hosted
endpoint from abuse.** It is enforced by browsers and governs which pages may
read a response; a direct caller ignores it, and the endpoint URL necessarily
ships in the public bundle. A hosted backend needs provider-side spend caps and
real rate limiting, not an origin allowlist. While the server binds `127.0.0.1`
this is moot, and that binding is currently the strongest protection the key
has.

## 10. Known weak points

- `src/App.jsx` owns most state and every handler. It is the natural place for
  the next feature and the worst place for it.
- No test framework and no CI; one bespoke script is the safety net.
- No router — view state is a string in `App.jsx`. No deep links, no back
  button.
- No error boundary; a render error blanks the screen.
- `storage.js` swallows write failures silently, so a full quota loses data with
  no signal.
- **Native number spinners in the Amount field — could not be reproduced**
  (Stage 2). Checked in Chrome 153 on 2026-10-17: computed `appearance` and
  `-webkit-appearance` on the input both resolve to `none` and no spin arrows
  render at either width. Modern Chrome suppresses them without a
  `::-webkit-inner-spin-button` rule. **Unverified on Safari and on real
  iOS**, which is where the original report may have come from. Confirm there
  before changing anything. Fields: `src/views/AddView.jsx:84`,
  `src/views/SettingsView.jsx:106`.
- **Long category names truncate on the phone donut legend** (Stage 2).
  `.legend-row` ellipsises deliberately — the fix is more room at phone width,
  not removing the truncation, which would make the name and the amount read as
  one string.
- **The Assistant screen is sparse before a question is asked** (Stage 2). The
  empty state in `src/views/AskView.jsx` is a single sentence, with no example
  questions to tap.
- Budget inputs display raw floats (e.g. `166.66666666666666`) with no rounding.
- The "avg S$x" label on the 7-day chart **overlaps the first bar** when that
  bar is tall — seen on both viewports and all three themes (Stage 2).
- An Assistant answer reads **"You spent S$115.30 food this month"**, missing
  the preposition before the category label (Stage 2).
- `<meta name="apple-mobile-web-app-capable">` is deprecated and logs a console
  warning on every load; it is the only console output the app produces.
- **Fixed in Stage 0:** the time-dependent smoke check. The suite is 518/518.
- **Nothing has been tested on real iPhone hardware.** Every "works on phone"
  claim here means a 390×844 viewport in desktop Chrome — including Stage 0's
  verification, which drove Chrome 153 at exactly 390×844 over the DevTools
  protocol with real layout and real input events. That is a real browser at
  the right size. It is still not a phone: no touch, no iOS Safari, no notch,
  no on-screen keyboard.

## 11. Open questions

1. Hackathon date, duration and judging format are still unknown and **have not
   been reconfirmed**. No plan here assumes a particular countdown;
   `docs/ROADMAP.md` gives sizes and a dependency order instead. Pre-existing
   code is permitted (confirmed 2026-10-02).
2. **Whether to host a backend for the public URL.** **Settled for this build
   in Stage 0: Option B — no hosted backend.** The question stays open for
   anything after the hackathon. No provider has been chosen and nothing is
   deployed, so the public URL is Path A
   (§9.1): the tracker, the wallpapers, both layouts, manual and voice entry,
   and the Assistant's offline fallback. The model-backed Assistant and receipt
   scanning are Path B only. Hosting one would converge the two paths and
   requires HTTPS, the key in a host secret store, a frontend rebuild, and —
   non-negotiably — provider-side spend caps and rate limiting, because CORS
   does not stop a direct caller. `docs/ROADMAP.md` states both options, their
   risks and a recommendation; the decision has not been made.
3. Whether to rename the product strings before judging (Stage 7) or leave
   "Expense Tracker" in the UI.

### Capability stage, 18 October 2026

The active read-intent contract is now the shared `queryContract.js` schema, operation `analyze`. New model interpretations and the conservative offline grammar run through `queryEngine.js`: combined date/category/description/amount/day filters, totals/counts/averages/lists, highest groups, weekday/weekend calendar-day analysis, matched-elapsed comparisons and category budget pace estimates. Legacy `answer` intents remain validated for compatibility; the provider emits canonical reads. Queries do not accept ledger IDs, calculated totals, SQL or code. Multi-category aggregation and arbitrary comparison periods remain unsupported and require clarification.

Each new read displays the interpreted scope and date range with immutable evidence. Relevant additions, edits and deletions invalidate snapshots. Category budget changes invalidate projections without rewriting their displayed figures. The clarification control edits the complete original question, rather than sending a contextless category reply.

Home has independent desktop stacks: Recent on the left, Budget and immediately below it Where it went on the right. Category excess is displayed explicitly in cents. The phone retains a five-row preview, and daily buttons open a read-only panel, including empty dates. Search accepts validated ISO, day/month/year and named-month dates, scoped to the selected month/category.

Hardware verification is not automated verification. Follow `HARDWARE-CHECKLIST.md`; do not count parsed transcripts or a 390px browser viewport as a physical microphone test. Receipt extraction remains receipt-level. No item-level extraction is claimed.
