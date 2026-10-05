# Backend

The server-side half of the Daily Expense Tracker. Right now it does exactly one
thing — answer `GET /health` — so that the frontend has something to talk to and
the deployment story is settled before the interesting part arrives.

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

Anything else returns `404` as JSON; a non-`GET` to `/health` returns `405`.

### Running both halves

Two terminals, from the repository root:

```sh
npm run dev                  # frontend — http://localhost:5173/Daily-Expense-Tracker/
cd backend && npm start      # backend  — http://127.0.0.1:8787
```

The frontend is unchanged and does not call this server yet. It still keeps
everything in `localStorage`, and it still runs perfectly well with the backend
switched off.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Port to listen on |
| `HOST` | `127.0.0.1` | Interface to bind |
| `ALLOWED_ORIGINS` | the two localhost dev origins and the GitHub Pages site | Comma-separated browser origins allowed to call this server. No wildcard: one would let any page on the internet drive this server through a visitor's browser. |

`127.0.0.1` means local-only. Binding `0.0.0.0` would expose it to your network;
don't, until there is a reason to.

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
(docs/PRD.md §8).

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
