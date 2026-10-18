# TallyAI

A personal finance tracker made for students, by a student.

- Live app: https://ailodge-expensetracker.vercel.app
- GitHub: https://github.com/wakigit/Daily-Expense-Tracker
- Demo video: https://www.youtube.com/watch?v=JN2Ci5Oxj-Y

Built solo by Wei Kai (SMU Information Systems) for the SMU BIA AI Lodge Hackathon, Vampire Lodge.

---

## 1. Problem Statement

Students do not spend in big, memorable amounts. We spend in many small ones: a
$4.50 lunch, a $2.20 bus ride, a $12 Grab back to campus, 80 cents of printing
before a submission. Each is too small to think about, and together they are
most of the month's money, so you find out where it went only once it is gone.

The people who feel this are students on an allowance or a part-time income, who
have a real budget but no system for it. Most trackers are built for working
adults: they assume salaries, bills, categories like mortgage and insurance, and
that you will sit down and do data entry. Logging feels like a chore, so after a
week or two people stop, and a half-filled tracker is worse than none because it
quietly tells you the wrong number.

The problem worth solving is therefore not analysis. It is the cost of logging,
and the gap between a list of transactions and an answer about your own spending.

## 2. Solution Overview

TallyAI attacks the chore and the gap separately.

**Make logging cheap.** Three ways in: type it, speak it, or photograph the
receipt. Voice and receipt scanning both produce an editable draft in the Add
form rather than saving anything, so a wrong guess costs a tap to fix instead of
a wrong row in your history.

**Make the budget a daily question.** Rather than only showing a month total
against a month budget, the home screen turns what is left into a daily
allowance for the rest of the month ("about $9.80 a day for the 14 days left in
October"), which is the number that changes a decision at a food court.

**Make answers checkable.** Ask in plain English: every figure is calculated
locally from your own rows in integer cents and shown with the transactions it
came from, so you can verify it instead of trusting it.

**Make logging slightly fun.** After a purchase saves, a short roast appears for
a few seconds, written from facts taken from your own ledger rows. One sentence,
optional, and there because the main reason trackers fail is that nobody opens
them.

## 3. Key Features

- Add, edit, delete and undo expenses (description, amount, category, date,
  note).
- Month filtering and month-to-month navigation.
- A total monthly budget and per-category budgets, with status labels through to
  "Over budget" and explicit overspend amounts per category.
- Charts: a cumulative month graph on laptop, seven-day bars on phone (with
  read-only daily detail), and a category donut.
- Date search, with strict date matching.
- Voice entry into an editable draft. Monetary amounts are identified in the
  transcript, numbers that are part of a name stay in the description, and an
  unresolved amount is left blank for review rather than guessed.
- Receipt scan into an editable draft: merchant, total, currency, date and
  category. Receipt-level, not line-item level, so individual items are not
  extracted.
- Ask: plain-English questions about recorded spending, answered with evidence
  transactions.
- Roast: one short line after a save, with a persistent off switch in Settings.
- Three animated backgrounds (Moonlit Forest, Sunset Beach, Rainy City) that
  react to how much of the budget is used. Reduced motion is honoured, with an
  in-app override.
- Separate laptop and phone layouts, not one layout stretched.
- A sample data loader in Settings, so the app can be understood without typing
  anything first.
- A separate local ChromaDB tool (`tools/chroma-demo/`) that searches the sample
  transactions by meaning, so "late night supper" finds `Supper prata`. It is a
  prototype run from the command line, not part of the app.

## 4. AI Integration

I tried to be exact about where a model is involved, because "AI tracker"
usually hides the part that matters.

**Ask: the model interprets, the app calculates.** A question goes to the OpenAI
Responses API (gpt-4.1-mini by default, set via `OPENAI_MODEL`) and the model's
only job is to turn the sentence into a structured query: a period or date
range, one real category, a description substring, an amount condition, a
weekday filter. That output is validated against a strict closed contract
(`src/lib/intent.js`, `src/lib/queryContract.js`) on the server and again in the
browser. The answer is then computed locally from the stored rows in integer
cents (`src/lib/queryEngine.js`, `src/lib/stats.js`) and shown with its evidence
transactions. The model never does the arithmetic, any number it emits is
discarded, and ambiguous or out-of-contract questions get a clarification prompt
instead of a guess.

**Receipt scanning: extraction only.** The model reads the photo and returns
draft fields, saving nothing. The draft lands in the Add form and I review it
before it becomes a row; anything unreadable comes back blank and is named
rather than invented.

**Roast: one sentence, from supplied facts.** The model gets only that
purchase's description, amount in cents, category label, up to two locally
calculated exact-repeat facts and a bounded budget band. It writes at most 120
characters and exactly one complete sentence, and the output is checked before
display: unsupported counts or history claims are rejected and a labelled
offline quip is shown instead.

**Voice entry is not OpenAI.** It uses the browser's Web Speech API
(`src/lib/speech.js`), on the device.

**Vector database (local prototype).** ChromaDB indexes the sample
transactions' descriptions for meaning-based search, embedded with Chroma's
default local model (`all-MiniLM-L6-v2` under onnxruntime), so it needs no API
key and makes no paid call. It finds rows that share no words with the query,
which the exact structured queries above cannot do. This is a command-line
prototype in [tools/chroma-demo/](tools/chroma-demo/) and is not wired into the
deployed app. The app's own data is still stored only in the browser, never in
Chroma: the index holds the invented sample rows and nothing else.

**Every OpenAI call is server-side**, through Vercel Functions in `api/` in
production or a local Node server in `backend/` in development.
`OPENAI_API_KEY` is read only through `process.env` in `backend/src/provider.js`
and is never returned or logged. It is deliberately not prefixed with `VITE_`,
because Vite inlines every `VITE_*` variable into the public client bundle. The
key never reaches the browser.

**How this was developed.** I built TallyAI with AI coding agents, OpenAI Codex
and Claude Code, directing the work, reviewing the diffs and testing the result
myself. The rule that the model interprets language and application code does
arithmetic is the one I held to throughout, and most of my review time went into
enforcing it.

## 5. External Tools & Datasets

| What | Used for |
|---|---|
| OpenAI API (gpt-4.1-mini) | Ask interpretation, receipt extraction, roast text |
| `openai` Node SDK v7 (official) | The only runtime dependency on both sides |
| React 19 and `react-dom` | UI |
| Vite 8 with `@vitejs/plugin-react` | Dev server, build, and the smoke test runner |
| Node.js 20.19+ | Local backend (`node:http`, no framework) and build tooling |
| Vercel | Hosting for the static build and the serverless API routes |
| Browser Web Speech API | Voice entry |
| `localStorage` | All persistence for the app itself |
| ChromaDB 1.5.9 (Python) | Local vector store for the semantic search prototype |
| `all-MiniLM-L6-v2` via onnxruntime | Chroma's default embedding model, running locally |

There is no UI framework, no CSS library, no state library and no test
framework: the frontend checks run as a server-side Vite build in
`scripts/smoke.jsx`, and the backend uses the built-in `node:test` runner.

**Datasets: none.** No real financial data is used anywhere. The demo data is
invented in code, in `src/lib/sampleData.js`, generated relative to today's date
so the charts are never empty, and labelled as sample data in the app wherever
it appears. No bank statement, card or account is involved.

## 6. Installation & Setup

**Prerequisites:** Node.js 20.19+ or 22.12+ (Vite 8 requires this; the backend
declares `>=20.12`), and npm.

```sh
# 1. Clone and install both halves
git clone https://github.com/wakigit/Daily-Expense-Tracker.git
cd Daily-Expense-Tracker
npm install
cd backend && npm install && cd ..

# 2. Add a key for the AI features
cp backend/.env.example backend/.env
#    then edit backend/.env and set OPENAI_API_KEY=sk-...

# 3. Start the backend (port 8787 on 127.0.0.1; it loads .env itself)
cd backend && npm start

# 4. In another terminal, start the frontend from the repository root
npm run dev
```

Open **http://localhost:5173/Daily-Expense-Tracker/**. The base path is not
optional locally: `vite.config.js` serves from `/Daily-Expense-Tracker/` unless
the build is on Vercel or `VITE_BASE` is set, so the bare root URL will not
load.

```sh
npm run smoke            # frontend render and logic checks
cd backend && npm test   # backend contract, transport and roast checks
```

The backend also has `npm run verify` (is the key accepted, is the model
available) and `npm run verify:live` (one real request end to end).

### Optional: the local ChromaDB search tool

The semantic search prototype is separate from the app and has its own Python
setup, in [tools/chroma-demo/README.md](tools/chroma-demo/README.md). It is not
needed to run TallyAI, and skipping it changes nothing about the app.

**A key is optional.** The tracker itself (adding, editing, budgets, charts,
search, backgrounds, voice entry) works with no key and no backend. The AI paths
fall back: Ask answers through a local offline matcher with the same arithmetic
over a narrower range of phrasings, labelled "Answered offline", and roasts show
a labelled offline quip. Receipt scanning has no offline substitute, because a
vision model cannot be replaced locally, and the button says so rather than
failing quietly.

## 7. AI Safety & Limitations

### Risks and limitations

- **Data lives only in your browser.** No accounts, no login, no sync, no server
  storage. Clearing the browser clears the data, and there is no export yet.
- **Not built for sensitive financial data.** It is a hackathon project with
  unencrypted `localStorage` and no authentication, so it should not hold
  anything you would mind losing or leaving on a shared device.
- **Answers describe recorded spending only.** A purchase that was never logged
  is in no answer, and the app cannot know it is missing.
- **Receipt extraction can be wrong**, which is why it is always a reviewed
  draft and never a saved row.
- **The roast grounding check is heuristic.** It validates structure and rejects
  unsupported counts and history claims, but syntactic validation cannot prove
  every personal claim true: it can miss a bad line and over-reject a fine one.
- **Budget pace figures are conditional, not predictions.** They extrapolate
  past recorded pace and say so; future spending can differ, and they go stale
  when a budget changes.
- **Some question combinations are unsupported.** The query contract is closed,
  so complex or ambiguous questions get a clarification prompt rather than a
  confident wrong answer.
- **The Chroma search is local only, and semantic matches can be loose.** It
  runs from the command line over the sample data, not in the app, and a
  nearest-neighbour search always returns five rows even when none is a good
  match. The distances are similarity scores, not a judgement that a row answers
  the question.
- **Public AI endpoints have best-effort rate limits, not a cost cap.** The
  per-IP limiter is per serverless instance with no shared memory, so cold
  starts and changing IPs can slip through. A hard spending ceiling has to be set
  at the provider, which is account configuration and not code.

### Guardrails implemented

Each of these is in the code, in `api/_shared.js`, `backend/src/routes.js`,
`backend/src/provider.js` and `src/lib/`:

- The API key is read server-side only, never logged or returned, and never
  given a `VITE_` prefix.
- Model output is validated against a strict closed schema that forbids extra
  properties and requires every field, on the server and again in the browser.
  An invalid intent returns a diagnostic code, never a guess.
- All money arithmetic is in integer cents (`src/lib/money.js`), computed
  locally from the ledger, and answers ship with their evidence transactions.
- AI failures degrade to a visibly labelled offline path, not a silent one.
- Foreign-currency receipts clear the amount and say so instead of leaving a
  foreign figure in an SGD field. Currency is reported, never converted.
- Uploads are capped by decoded size and restricted to an explicit MIME
  allowlist (`image/jpeg`, `image/png`, `image/webp`); other request bodies are
  capped at 8 KiB, and roast inputs at 4 KiB.
- Per-IP rate limits per route: 20/min for Ask, 6/min for receipts, 10/min for
  roasts.
- Roast output is checked for length (120 characters), exactly one complete
  sentence, and unsupported factual claims.
- No automatic paid retries: the provider client uses `maxRetries: 0` and
  bounded timeouts (10s for intents, 8s for roasts).
- Anything that would change data is parked as a proposal until a person
  confirms it.

### Testing done

Automated suites, run on this branch on 18 Oct 2026:

- `npm run smoke`: **1137/1137 passed.**
- `cd backend && npm test`: **120 passed, 0 failed** (28 from
  `provider.test.mjs`, plus 92 under `node --test` across the assistant,
  transport, provider-error, roast and roast-diagnostics suites).

The ChromaDB searches were run locally on 18 Oct 2026 over 68 invented sample
transactions, and the real output is saved in
[tools/chroma-demo/RESULTS.md](tools/chroma-demo/RESULTS.md).

Checked live against the production URL on 18 Oct 2026, against the hosted
serverless routes: "How does this month compare to last month?" returned HTTP
200 with a structured `compare` query over the month period, "Which weekday do I
usually spend the most on?" returned HTTP 200 with a structured `highest` query
grouped by weekday, and `GET /api/health` returned HTTP 200.

**Not yet verified on physical hardware.** Voice entry and receipt capture on a
real phone are still pending: every "works on phone" claim here means a 390x844
viewport in desktop Chrome, not an actual device. The steps for that check are
in [docs/HARDWARE-CHECKLIST.md](docs/HARDWARE-CHECKLIST.md).

---

## Documentation

| Document | Contents |
|---|---|
| [docs/DEVELOPER-NOTES.md](docs/DEVELOPER-NOTES.md) | The previous README: architecture, the local-versus-hosted difference, full feature and caveat detail |
| [docs/PRD.md](docs/PRD.md) | Product requirements, built / planned / removed breakdown |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Stages, cut line, risk register |
| [docs/RESUME.md](docs/RESUME.md) | State of the working tree |
| [docs/CAPABILITY-VERIFICATION.md](docs/CAPABILITY-VERIFICATION.md) | What was verified for each capability, and how |
| [docs/ASSISTANT-RELIABILITY-REVIEW.md](docs/ASSISTANT-RELIABILITY-REVIEW.md) | Review of Ask failure modes |
| [docs/ROAST-QUALITY-REVIEW.md](docs/ROAST-QUALITY-REVIEW.md) | Review of roast grounding and tone |
| [docs/WALLPAPER-REDESIGN.md](docs/WALLPAPER-REDESIGN.md) | Background and scene spec |
| [docs/HARDWARE-CHECKLIST.md](docs/HARDWARE-CHECKLIST.md) | Physical microphone and camera checks |
| [docs/PLANNING-BRIEF.md](docs/PLANNING-BRIEF.md) | Self-contained planning brief |
| [docs/CLAUDE-CODE-PROMPTS.md](docs/CLAUDE-CODE-PROMPTS.md) | Prompt index per stage |
| [docs/design-canvas/](docs/design-canvas/) | Source artwork for the scenes |
| [backend/README.md](backend/README.md) | Server, API key handling, verification |
