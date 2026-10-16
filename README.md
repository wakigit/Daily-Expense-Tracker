# TallyAI

**Ask where your money went.** Every figure computed from your records, never
guessed by a model.

A mobile-first daily expense tracker for spending in Singapore dollars, with an
AI Assistant and three live wallpapers that react to your budget.

> **Naming:** the product is TallyAI and the assistant is simply **the AI
> Assistant** — a section of the app, not a character. The repository, the git
> remote and the deployed URL still say `Daily-Expense-Tracker`, and the UI still
> says "Expense Tracker". Renaming the product strings is planned; renaming the
> repository is deliberately not, because it breaks the public URL.

---

## Running it

```sh
npm install
npm run dev     # http://localhost:5173/Daily-Expense-Tracker/
npm run build
npm run smoke   # 518 render + logic checks
```

The Assistant and the receipt scanner need the backend as well — see
[`backend/README.md`](backend/README.md):

```sh
cd backend && npm install && npm start
```

**The app works without the backend, with one exception.** The Assistant falls
back to a local matcher that answers with the same arithmetic — that is also how
the deployed build runs, having no server. **Receipt scanning has no fallback**:
a vision model cannot be substituted locally, so the button says so rather than
failing silently.

### Two ways to run it, and they show different things

The frontend looks for the backend at `http://127.0.0.1:8787` unless
`VITE_ASSISTANT_URL` is set at build time. **`127.0.0.1` is whatever device the
page is open on** — so on your phone it is your phone, not someone else's
laptop. **No backend is hosted**, so the public URL has nothing to reach.

| | **Public URL** — no hosted backend | **Locally** — `backend && npm start` |
|---|---|---|
| Tracker: add, edit, delete, undo, categories, budgets | ✅ | ✅ |
| Charts, search, month navigation, drill-down | ✅ | ✅ |
| Three live wallpapers and the decay | ✅ | ✅ |
| Phone and laptop layouts | ✅ | ✅ |
| Voice entry into the Add form | ✅ — the browser's speech recognition, not the server's | ✅ |
| **Ask it a question** | ✅ **via the offline matcher** — same arithmetic, narrower language | ✅ model-backed: five intents, nine metrics |
| **Receipt scanning** | ❌ no offline substitute for a vision model. The button says *"Scanning is unavailable — the assistant is offline."* | ✅ |

The public URL is therefore a complete tracker with an offline assistant — and
not an AI demo. Both are honest descriptions of the same build; which one you
get depends only on whether a backend is reachable.

Run the local version from `http://localhost:5173/…`, not by opening the public
URL on a machine that happens to have the backend running: an HTTPS page calling
`http://127.0.0.1` is a mixed-content request and that combination has never
been tested.

> `npm run smoke` currently reports **517/518**. One check expects "yesterday"
> computed from UTC while the parser correctly uses the Asia/Singapore day, so it
> fails between 00:00 and 08:00 SGT. The product is right; the test's
> expectation is wrong, and it is not yet fixed.

---

## What works today

Everything in this section is in the code and verified working.

- **Log expenses** by typing, by speaking into the Add form, or by photographing
  a receipt. Description, amount, category, date, note. Edit, delete, undo.
- **Receipt scanning** fills the Add form from a photo — and **only** fills it.
  It produces a draft you check and never saves a row on its own. The total is
  taken as the figure *after* service charge and GST, anything unreadable comes
  back blank and is named rather than guessed, a photo that is not a receipt is
  refused, and a foreign-currency receipt clears the amount and says so rather
  than leaving an SGD figure sitting under the new receipt's name. Currency is
  reported, never converted.
- **Budgets** per category, with a shared five-state status model — *No budget
  set · On track · Close to limit · Budget reached · Over budget*.
- **See it** — month total, category donut, a last-7-days bar chart, searchable
  transaction list, month navigation, per-category drill-down.
- **Ask it** — type a question and get an answer computed from the real rows.
  Nine metrics over seven time windows, optionally scoped to one category. Ask it
  to add or delete and it shows a confirmation card first. Say "undo that" and it
  reverses its own last change. Every answer states how it was interpreted.
- **Three live wallpapers** — Moonlit Forest, Sunset Beach, Rainy City — that
  **run down as you spend**. Three states, driven by the same thresholds as the
  status pill: *healthy* under 75%, *strained* from 75 to 100, *run down* past
  it. The forest fogs over, loses its fish and its deer and the moon wanes to a
  crescent; the beach cools to night, the surfer and crab leave and litter
  arrives; the city's windows go cold, the rain thickens and the building stops
  smiling. Delete the expense and the world recovers — it is the same transition
  backwards. Reduced motion is honoured, with an in-app override.
- **A phone layout and a laptop layout** — below 1024px the phone column,
  unchanged; at 1024px and up a navigation rail, a centre overview and a
  transaction ledger, with each scene swapping to a composition drawn for the
  wider screen.

Money is summed in integer cents. Dates follow the Asia/Singapore calendar day,
so a 1 a.m. supper is dated today, not yesterday.

## What does not work yet

- **No accounts, no login, no sync, no server storage.** Everything is in
  `localStorage` on one device. Clearing site data loses it, and there is no
  export yet. Nothing in the app presents accounts as existing.
- **No sample data yet** — a first-time opener sees an empty shell. Planned.
- **No spending comparisons** ("more than last month?"), **no source-row
  explanations** ("which transactions make that up?"), **no charts inside
  Assistant answers**, and **no budget forecast**. All planned; see the roadmap.
- **No roaster.** Planned, opt-in, off by default.
- **No voice in the Assistant.** Speech fills the Add *form* only; you cannot
  speak a question.
- **Reduce Motion stops the wallpapers entirely**, by design. The decay still
  reads — it is colour and opacity — but nothing loops.

### Three caveats worth reading before you judge it

**The deployed build is 31 commits behind the working branch** and predates both
the Assistant and the receipt scanner. Fixing that is the first item on the
roadmap.

**Whether to host a backend for the public URL is undecided** — no provider has
been chosen and nothing is deployed. See the decision in
[`docs/ROADMAP.md`](docs/ROADMAP.md).

**Nothing has been tested on real iPhone hardware.** Every "works on phone"
claim here means a 390×844 viewport in desktop Chrome.

See [`docs/PRD.md`](docs/PRD.md) for the full built / planned / removed breakdown
and [`docs/ROADMAP.md`](docs/ROADMAP.md) for what is being built this week and
what has been cut.

---

## Not in this product

Cut deliberately, and not hidden later stages: **a cat mascot and the "Ask
Tally" framing** — the Assistant is a normal section of the app and the
animation budget belongs to the wallpapers; and **bank statement import, card
syncing, and transaction reconciliation** — PDF layouts differ per bank, CSV
import without reconciliation is a half-feature, and with it, it was the largest
item on the old plan. Receipt scanning stays: it is the good half of ingestion
and it needs none of that.

The hackathon demo uses **sample financial data generated for it**. No real bank
statement, card or account is involved.

---

## How it is put together

React 19 + Vite 8, no UI framework, CSS driven entirely by custom properties —
which is what makes a theme swap cost nothing.

```
src/
  views/       one file per screen
  components/  shared pieces
  lib/         the logic — all pure, all testable in Node
    status.js     the budget thresholds, and the wallpaper's decay level
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

**The API key never reaches the browser.** `OPENAI_API_KEY` is read server-side
only, in `backend/src/provider.js`, and is never logged or returned. Vite inlines
every `VITE_`-prefixed variable into the client bundle, so the name matters: a
`VITE_OPENAI_API_KEY` would be a published key. See
[`backend/README.md`](backend/README.md).

---

## Docs

| | |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements, feature status, planned capability detail |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Stages, cut line, risk register |
| [`docs/RESUME.md`](docs/RESUME.md) | State of the working tree — read this first when picking the work back up |
| [`docs/PLANNING-BRIEF.md`](docs/PLANNING-BRIEF.md) | Self-contained brief for getting planning help from another model |
| [`docs/CLAUDE-CODE-PROMPTS.md`](docs/CLAUDE-CODE-PROMPTS.md) | Prompt index per stage, and the rules every prompt must restate |
| [`docs/WALLPAPER-REDESIGN.md`](docs/WALLPAPER-REDESIGN.md) | Wallpaper spec |
| [`docs/design-canvas/`](docs/design-canvas/) | Source artwork for the scenes |
| [`backend/README.md`](backend/README.md) | Server, API key handling, verification |
