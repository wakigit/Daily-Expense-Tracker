# Backend

The server-side half of **TallyAI** — the half that holds the API key.

> **Naming:** the product is TallyAI. `package.json` here still says "Daily
> Expense Tracker"; the rename is planned, not done.

## Status

| | |
|---|---|
| `GET /health` | **Built** |
| `POST /assistant/intent` | **Built**, verified against the live API |
| `POST /assistant/receipt` | **Built**, verified against the live API |
| OpenAI provider, Structured Outputs | **Built** |
| Accounts, sessions, database | **Not built.** See `docs/PRD.md` §6 — a solo-built account system holding real financial data, shipped in a week, would be irresponsible |
| Statement (CSV / PDF) ingestion endpoints | **Removed from the product**, not deferred. See `docs/PRD.md` §7 |
| Roaster endpoint | **Not built.** Planned as Stage 6 in `docs/ROADMAP.md`, which is also that roadmap's cut line |
| A hosted deployment of this server | **Not built, and undecided.** No provider has been chosen and nothing is deployed. See *If this is ever hosted* below, and the backend hosting decision in `docs/ROADMAP.md` |

The frontend works without this server **with one exception**: the Assistant
falls back to a local matcher, and receipt scanning has no fallback at all. The
deployed GitHub Pages build runs in exactly that mode. See *Running both halves*
below.

One dependency: the official `openai` SDK. Everything else is `node:http` — one
route does not need a framework.

## Requirements

**Node 20.12 or newer.** That is the version that added `--env-file-if-exists`,
which every script below uses to read `.env`. `--env-file` alone was not usable
here: it aborts when the file is absent, so `npm start` would fail on a machine
that has not set a key — and the app is meant to run perfectly well without one.

## Running it

From this directory:

```sh
npm install                  # once, for the openai SDK
npm start                    # serve on 127.0.0.1:8787
npm run dev                  # same, restarts on save
npm test                     # mocked. No key, no network, no cost.
npm run verify               # is the key accepted, is the model available?
npm run verify:live          # one real request. Costs a fraction of a cent.
```

**Every script except `npm test` loads `backend/.env` automatically.** There is
no separate `node --env-file=…` incantation to remember, and nothing breaks when
`.env` does not exist. `npm test` deliberately does *not* load it, so the mocked
tests stay deterministic and cannot start behaving differently just because a
key happens to be present.

It listens on **http://127.0.0.1:8787** by default. Check it with:

```sh
curl http://127.0.0.1:8787/health
```

```json
{
  "status": "ok",
  "service": "daily-expense-tracker-backend",
  "uptimeSeconds": 3,
  "timestamp": "2026-10-05T04:21:09.412Z"
}
```

### `POST /assistant/intent`

Takes a sentence, returns one validated intent — a *proposal*, never a change
and never a figure.

```sh
curl -X POST http://127.0.0.1:8787/assistant/intent \
  -H 'Content-Type: application/json' \
  -d '{"message":"how much did I spend this week","context":{"categories":[{"id":"food","label":"Food"}],"today":"2026-10-15"}}'
```

With no provider configured it answers `503 {"error":"provider_not_configured"}`,
which is the signal the app falls back on. It keeps working offline.

The request carries the category names and today's date. **It does not carry the
expense rows** — the model does not need them to work out which question is
being asked, and the figures are computed in the app afterwards.

### `POST /assistant/receipt`

Takes a photograph of a receipt, returns a validated **draft expense**. Like the
intent route it returns a proposal: the fields land in the Add form and a person
approves them before anything is written. Nothing here creates a row.

```sh
curl -X POST http://127.0.0.1:8787/assistant/receipt \
  -H 'Content-Type: application/json' \
  -d '{"image":{"base64":"<base64 jpeg>","mimeType":"image/jpeg"},
       "context":{"categories":[{"id":"food","label":"Food"}],"today":"2026-10-15"}}'
```

```json
{ "draft": { "description": "TOAST BOX", "amount": "19.06", "category": "food",
             "date": "2026-10-14", "currency": "SGD", "foreign": false,
             "missing": [] } }
```

A field the model could not read comes back `null` and is named in `missing`,
rather than being guessed. The client leaves those form fields alone, so a
partial scan adds to the form instead of blanking it.

| Response | When |
|---|---|
| `200` | A draft, possibly with entries in `missing` |
| `400 image_required` | No image in the body |
| `413 image_too_large` | Over 2 MB decoded — the client downscales to a tenth of that |
| `413 body_too_large` | Over the wire limit, refused while streaming |
| `422 receipt_not_a_receipt` | The model reports the photo is not a receipt |
| `502 receipt_unknown_category` | The model named a category it was not offered |
| `503 provider_not_configured` | No key. **There is no offline fallback for this route** |

**This route is the one place user content leaves the device.** The image is
sent to the model provider because a photograph cannot be read without being
read. Nothing accompanies it but the category names and today's date; it is
never written to disk, never logged, and is opt-in per photo. The expense rows
still never leave. See `docs/PRD.md` §4.6.

The amount is the figure **after** service charge and GST — the prompt is
explicit about not taking the subtotal or the cash tendered, which is the most
common way a receipt scanner records the wrong number. Foreign currency is
reported, never converted: this app holds no exchange rates, and inventing one
would put a wrong figure in the ledger.

Anything else returns `404` as JSON; a non-`GET` to `/health` returns `405`.

### Running both halves

Two terminals, from the repository root:

```sh
npm run dev                  # frontend — http://localhost:5173/Daily-Expense-Tracker/
cd backend && npm start      # backend  — http://127.0.0.1:8787
```

**The frontend calls this server.** That sentence used to say it did not — that
was true when this file was written and has been false since the typed Assistant
landed. `src/lib/assistantClient.js` calls `POST /assistant/intent` and
`src/lib/receiptClient.js` calls `POST /assistant/receipt`.

Expenses still live in `localStorage` and nothing here persists anything.

**Where the frontend looks for this server:** `http://127.0.0.1:8787`, unless
`VITE_ASSISTANT_URL` is set at **build** time
(`src/lib/assistantClient.js:23`). That default is the right one for local
development and is meaningless anywhere else — **`127.0.0.1` is whatever device
the page is open on**, so on a visitor's phone it is the visitor's phone, not
the developer's laptop. Because Vite inlines the value at build time, pointing
the frontend at a hosted backend requires rebuilding the frontend, not just
starting a server.

**With the backend switched off:** the Assistant falls back to the local matcher
in `src/lib/ask.js` and the app works. **Receipt scanning does not** — there is
no offline substitute for a vision model, so the button reports *"Scanning is
unavailable — the assistant is offline."* rather than failing silently. The
deployed GitHub Pages build has no backend to call and therefore runs in exactly
this state. See the two demo paths in `docs/ROADMAP.md`.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Port to listen on |
| `HOST` | `127.0.0.1` | Interface to bind |
| `ALLOWED_ORIGINS` | the two localhost dev origins and the GitHub Pages site | Comma-separated browser origins allowed to call this server. No wildcard: one would let any page on the internet drive this server through a visitor's browser. **This is not an access control** — see below. |

> **What `ALLOWED_ORIGINS` does and does not do.** CORS is enforced by
> *browsers*. It decides which web pages may read a response, and that is a real
> protection against a hostile page driving this server through a visitor's
> session. It does **nothing** against a direct caller: `curl`, a script or a bot
> ignores CORS entirely, and the endpoint URL is in the public client bundle by
> necessity. **While this server binds `127.0.0.1` that is harmless**, because
> nothing off the machine can reach it. The moment it is hosted, CORS stops being
> sufficient and real usage controls are required — see below.

`127.0.0.1` means local-only. Binding `0.0.0.0` would expose it to your network;
don't, until there is a reason to.

## If this is ever hosted

**It is not hosted, and whether to host it is undecided.** No provider has been
chosen and nothing has been deployed. `docs/ROADMAP.md` carries the decision with
both options; this section is the part that belongs with the server.

Binding this to a public address changes the threat model completely. Today the
key sits behind `127.0.0.1`, which is a stronger protection than any code in
here. Hosted, the following are **prerequisites, not follow-ups**:

1. **HTTPS.** The Pages site is HTTPS and an HTTP endpoint is blocked as mixed
   content.
2. **The key in the host's secret store**, never in the image or the repo.
3. **`ALLOWED_ORIGINS` narrowed to the Pages origin**, `HOST=0.0.0.0`, and the
   platform's injected `PORT`. All three are already configurable; no code
   change needed.
4. **A hard spend cap at the provider.** Set this before the first request. It is
   the only control that still holds when something else here has a bug.
5. **Per-IP rate limits on both routes and a global ceiling**, with
   `/assistant/receipt` limited far more tightly than `/assistant/intent` — it
   forwards an image to a paid vision model and is the expensive one.
   **Neither limiter exists today. This is new code.**
6. **Request-count logging**, so abuse is noticed rather than found on an
   invoice.
7. **A kill switch.** The frontend degrades to its offline matcher when this
   server disappears, so switching it off is a safe, instant mitigation. Receipt
   scanning stops working, which is the intended behaviour and not a regression.

**What will not do the job:** CORS alone (see above); a shared token baked into
the frontend build, which ships in the public bundle and can be copied in
seconds; or obscurity about the URL, which is published in the bundle too. These
raise the cost of casual abuse and are not a substitute for items 4 and 5.

An unprotected hosted instance of this server is a free OCR and LLM service with
the owner's billing attached. That is the whole risk, stated once.

## Secrets belong here, in the environment — never in the repo

This repository is **public**. The frontend is a static bundle: everything in it
is readable by anyone who opens the site, and anything committed to git stays in
the history forever, even after it is deleted.

`OPENAI_API_KEY` — and any key after it — follows these rules:

1. **It lives in this process's environment**, read via `process.env` in
   `src/provider.js` and nowhere else. Never in a source file, never in the
   frontend, never in `vite.config.js`, never in anything Vite bundles. Vite
   inlines every `VITE_`-prefixed variable straight into the client bundle, so a
   key named `VITE_OPENAI_API_KEY` is a published key.
2. **Locally it goes in `backend/.env`**, which is already git-ignored:
   ```sh
   cp .env.example .env     # then put OPENAI_API_KEY in it
   npm run verify
   ```
   The scripts load that file themselves — no dotenv dependency, and no flag to
   remember. Do not paste the key into a terminal that is being recorded, into a
   chat, or into any file that is not `.env`.
3. **In production it goes in the host's secret store** — the environment
   variable settings of whatever runs this, not a file in the image.
4. **The browser never sees it.** The browser calls this server; this server
   calls OpenAI and returns only a validated intent. That is the whole reason
   this folder exists.

If a key is ever committed by accident, rotate it. Removing the commit is not
enough — assume anything pushed to a public repo was scraped within minutes.

## The model

OpenAI's direct API, official Node SDK, **Responses API** with **Structured
Outputs**. All of it lives in `src/provider.js` — the only file that knows which
provider is in use.

Structured Outputs rather than asking for JSON politely: with `strict: true` the
model cannot emit a field the schema does not describe, and **the category enum
is rebuilt from the caller's real category ids on every request**, so an invented
category is not something the model is able to say. `src/lib/intent.js` still
validates the reply afterwards — a schema the API enforces is not the same as a
schema this application has checked.

The model is never asked for a figure. It picks a metric and a period from
closed lists, and `src/lib/assistant.js` computes the number from the real rows
(`docs/PRD.md` §9).

### Choosing a model, and checking it works

`OPENAI_MODEL` selects it; the default is `gpt-4.1-mini`.

```sh
npm run verify        # cheap: can the key retrieve that model?
npm run verify:live   # real: send one request and validate the reply
```

`verify` is a lookup. It is enough to catch a wrong model id or a bad key, and
it costs nothing — but it still passes with a key that has no quota or no access
to the Responses API, so it is not proof the assistant works.

`verify:live` is that proof. It sends one harmless, read-only sample question
through the same `requestIntent` the server uses, with two invented categories
and no personal data, then validates the reply with the same `validateIntent`
the app uses.

Both distinguish the failures that otherwise look identical, and each says what
to do about it rather than offering the same advice every time:

| | Means | What to change |
|---|---|---|
| 401 | Key rejected | `OPENAI_API_KEY` in `.env` |
| 403 | Not permitted for that model | `OPENAI_MODEL`, or project model permissions |
| 404 | Model not available to this project | `OPENAI_MODEL` |
| 429 | Rate limited or out of quota | Billing and usage limits |

Neither ever prints the key, the raw provider response, or any free text the
model produced. `verify:live` reports only fields that come from closed enums —
the intent type, and an answer's metric, period and category — which cannot
carry arbitrary text.

If any of this fails, nothing else breaks: the endpoint returns 503 and the app
falls back to its offline matcher.

## What is deliberately not here yet

No database, no accounts, no auth. Each arrives when something needs it.
