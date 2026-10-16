# Claude Code prompt index — TallyAI

**Rewritten:** 2026-10-17. **Stage numbers match `docs/ROADMAP.md`.**

> **This file is now an index, not a batch of prompts.** The previous version
> held eight pre-written prompts, including ones for a cat mascot state machine
> ("Stage 2 — Tally"), "Ask Tally" upgrades and CSV bank import with a
> reconciliation queue. Those features are **removed from the product**
> (`docs/PRD.md` §7), and their prompts are deleted rather than archived — a
> pre-written prompt for a cut feature is the single easiest way for a cut
> feature to come back at 1 a.m.
>
> **Prompts are written one at a time, when the stage starts.** Writing a week
> of prompts in advance encodes the plan as it was on the day it was written,
> which is exactly how the mascot and the importer survived three revisions of
> this document after they stopped being the plan.

---

## How to run a stage

1. **Plan mode first** (Shift+Tab). Read the plan. Approve or redirect.
2. One stage per session. Paste the stage's prompt, written fresh from the
   roadmap entry.
3. Hit the **verification gate** before accepting anything.
4. Commit, then `/clear` before the next stage.

---

## Two rules every prompt must carry

**Documentation is not instruction.** If `docs/` disagrees with the code, the
code wins and the doc gets fixed. Every one of these documents has been wrong
about the code at least once.

**Every prompt ends in a verification gate**, and the gate must distinguish what
was *loaded in a browser* from what was only *checked locally*. The minimum
gate, for any stage that touches code:

```
npm run build          clean
npm run smoke          passes — see the known failure below
cd backend && npm test passes
```

Plus, per stage, whatever the roadmap entry's **acceptance** section names.

> **Known failure, as of 2026-10-17:** the smoke suite reads **517/518**, not
> 518/518. `scripts/smoke.jsx:1196` computes the expected "yesterday" from UTC
> while the parser correctly uses the Asia/Singapore day, so the check fails
> between 00:00 and 08:00 SGT. **The product is right; the test's expectation is
> wrong, and it is not yet fixed** — the passes that found it were docs-only.
>
> **Fixing it is code work inside Stage 0**, before the suite is used as a
> release gate. Until then, any gate that says "smoke passes" must name this one
> check — a suite expected to fail by one is a suite in which the next real
> failure is invisible. From Stage 1 onward the gate is **518/518**.

---

## Rules a prompt must restate when it touches these areas

Copy these into the relevant prompt verbatim. Each exists because something went
wrong once.

| Area | The rule to restate |
|---|---|
| **Anything demo-related** | There are **two demo paths** and they show different things (`docs/PRD.md` §9.1). The public URL has no hosted backend: the Assistant falls back to the local matcher and **receipt scanning does not work at all**. `127.0.0.1` is the viewer's own device, never the presenter's laptop, and `VITE_ASSISTANT_URL` is inlined at **build** time. |
| **A hosted backend** | **CORS is not an access control.** It is browser-enforced and governs which pages may read a response; `curl` or any script ignores it, and the endpoint URL ships in the public bundle. A hosted endpoint needs provider-side spend caps and real rate limiting — neither of which exists in the code today. |
| **Any new Assistant metric** | Assert the **number** against a hand-computed sum, never that a string was produced. `money(undefined)` renders as `S$0.00` rather than throwing, so a missing field looks like a real answer. This has already produced a confident wrong figure once. |
| **The model contract** | `METRICS` in `src/lib/intent.js` and the Structured Outputs schema in `backend/src/provider.js` are extended **in the same change**. `intent.js` is imported by both sides precisely so the schema cannot drift. |
| **The receipt scanner** | It **pre-fills and never submits.** A draft a person checks, never a row. Unread fields come back `null` and are named, never guessed. Currency is reported, never converted, and a foreign-currency scan **clears** the amount field. Test on **merged form state**, not only on the field patch. |
| **The API key** | `OPENAI_API_KEY` is read server-side only, in `backend/src/provider.js`. Never logged, never returned, never sent to the browser. **Vite inlines every `VITE_`-prefixed variable into the client bundle**, so a `VITE_OPENAI_API_KEY` would be a published key. |
| **The wallpaper engine** | Never let JavaScript touch the SVG after build. The build effect in `useTheme.js` depends on `[themeId, wide]` and nothing else — adding anything budget-related restarts every animation on screen. `SCENE_CSS` in `scenes.js` is a template literal: a backtick in a comment inside it ends the string. |
| **The forecast** | A projection *at the current rate*, never a prediction. Suppressed below the minimum elapsed days and with no budget set. **Never drives the wallpaper decay or the status chip**, which stay on actual spend. |
| **Phone verification** | A 390×844 viewport in desktop Chrome is **not** a phone. Verify via an iframe at exactly 390×844 served from the same origin — window resizing does not go below ~1512px in this environment — and say which you did. |

---

## Stage index

Each row names what the stage's prompt must cover. The full entry — user
benefit, frontend work, backend work, acceptance, dependencies and cut
condition — is in `docs/ROADMAP.md`.

| Stage | Prompt must cover | Extra rules to restate |
|---|---|---|
| **0 · Clear the decks** | Commit the working tree as **two** commits (the wallpaper/laptop redesign, and the receipt scanner). **Fix the Singapore "yesterday" expectation at `scripts/smoke.jsx:1196`** — the expectation, never the parser — so the suite is a clean 518/518 gate. Present options for `main`, 23 commits behind, **with a recommendation and no merge or force-push without approval**. Rebuild and redeploy `gh-pages`. Record the backend hosting decision even if the answer is "not yet". No feature work. | Gate must report what was **loaded in a browser at the live URL** versus checked locally, and must check the live URL against **Path A specifically**: tracker works, Assistant falls back, receipt button says scanning is unavailable. All three are correct behaviour, not bugs. Under Option A the frontend must be **rebuilt** with `VITE_ASSISTANT_URL` — a backend deployed after the build changes nothing. |
| **1 · Sample demo data** | A seeded dataset plus load **and clear** controls in Settings. Must make the donut, the 7-day chart, a *run down* wallpaper and an over-budget chip all legible in one pass. Obviously sample data. Never overwrites existing rows silently. | State plainly that this is **sample financial data generated for the demo** — no real statement, card or account. Do not add anything that presents accounts or login as existing. |
| **2 · UI polish** | The three known issues: native number spinners (`::-webkit-inner-spin-button` plus unprefixed `appearance`, in `AddView.jsx` and `SettingsView.jsx`), phone donut legend truncation, and the sparse Assistant empty state. Plus budget inputs showing raw floats. | Example questions on the Assistant screen must be asserted against the **real metric list**, so one cannot drift into an unsupported query and error in front of a judge. Phone verification rule. |
| **3 · Comparisons and source rows** | **Source rows first** — the plan from `src/lib/assistant.js` carries the ids it summed, surfaced in the Ask thread. Then a comparison metric: two windows and a delta. Explicitly **do not** add follow-up context, the `essential` flag, or multi-category questions. | New-metric rule. Model-contract rule. Must also say what the **offline fallback** does with the new shapes — the deployed build runs in that mode. Report what the live API actually returned. |
| **4 · Charts in answers** | One small chart **beneath** the sentence, never instead of it, reusing `Donut.jsx` and `WeekBars.jsx`. The model never chooses the chart. | One computed value behind both the sentence and the chart, with a test that fails if they diverge. Phone verification rule. |
| **5 · Budget forecast** | Run-rate arithmetic in `src/lib/stats.js`. Read `docs/PRD.md` §5.3 first — the labelling and the suppression rule are the feature. | The forecast rule. Gate must **prove** suppression at day 4 and with no budget set, and prove no decay or status-chip path reads the forecast. |
| **6 · Roaster** | Read `docs/PRD.md` §5.4 first; it **rejects** the exponential-severity idea and specifies `tier = min(userCeiling, bandOf(remaining))`, capped at 2 even when over budget. Off by default. Angle rotation. Local template bank as fallback. Content rules in the prompt **and** a post-filter. | Send only: description, amount, category label, time-of-day bucket, budget-remaining **band**, tier, angle. Never the ledger, exact balances or the user's name. The post-filter must demonstrably reject a planted **invented investment return**. |
| **7 · Rename product strings** | `index.html`, `src/App.jsx`, `src/hooks/useAppData.js`, the `SettingsView.jsx` placeholder, `backend/package.json`. | **Do not** rename the repository or the Pages URL — it breaks the deployed link. **Do not** rename the `ww_*` storage keys — that orphans existing data for a cosmetic gain. |
| **8 · Deploy, rehearse, freeze** | Rebuild and redeploy from the final tip. Rehearse **both paths separately**: Path A with the backend stopped (tracker, charts, wallpapers, Assistant fallback — **not** receipt scanning, which has no fallback and is a pass when it reports unavailable), and Path B from the **localhost dev server** with the backend running (model-backed Assistant, receipt scanning end to end). Sample data on a fresh profile. Two run-throughs on the actual laptop and network. No new code. | Say explicitly which steps ran against the **live URL** rather than localhost. Do not ask for "the full demo path with the backend stopped" — that is impossible and was an error in the earlier roadmap. If a phone is in the demo, open the live URL on **real iPhone hardware**. Under Option A, also verify the hosted endpoint over HTTPS from the Pages origin, that its usage controls were tested, and that **switching it off** degrades to Path A. |

---

## Prompts deliberately not written

- **Bank statement import (CSV or PDF), card syncing, reconciliation, duplicate
  detection, merge queues.** **Removed from the product**, not deferred —
  `docs/PRD.md` §7. There is no stage for these and no prompt will be written.
- **A cat mascot, a character state machine, a docked assistant panel.**
  Removed. The Assistant is a section of the app.
- **Accounts, login, sessions, database.** `docs/PRD.md` §6 sets the minimum bar
  for handling a stranger's financial data. Until that bar is met there is no
  safe prompt to write, and **a frontend-only login form is not an account
  system and will not be presented as one.**
- **Split payments, multiple cards, tip and discount tolerance matching,
  multi-currency conversion.** Non-goals (`docs/PRD.md` §8).
- **Voice into the Assistant.** LATER. The Add-form path exists and is the
  foundation; this competes with capabilities judges can actually see.
- **A refactor of `src/App.jsx`.** It is genuinely the wrong place for the next
  feature, and a mid-week refactor buys no judging points while risking
  everything that currently passes. Worth a prompt **after** the hackathon.
