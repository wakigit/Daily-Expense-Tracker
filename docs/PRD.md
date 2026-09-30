# Product Requirements Document — Daily Expense Tracker

**Owner:** Wei Kai (@wakii___)
**Status:** Draft
**Last updated:** 2026-09-30

---

## 1. Problem

Most people who start tracking expenses stop within a week. Not because they
stop caring about money — because **logging is tedious**. A typical tracker asks
for a description, an amount, a category, a date and a note before it will
record a $1.40 kopi. That friction is paid every single time, and the reward
arrives much later.

And when the data does exist, it rarely answers the question actually being
asked. Users think in sentences — *"how much did I spend on food this week?"*,
*"which day did I overspend?"* — but the app answers in dashboards, leaving the
user to do the reading and the arithmetic themselves.

## 2. Target user

A Singapore university student tracking day-to-day spending in SGD. They pay for
food, Grab rides, EZ-Link top-ups and the occasional impulse buy, mostly from a
phone, often while walking. They have a rough monthly budget in their head and
no idea whether they're on track. They are not an accountant and will not
maintain a spreadsheet.

## 3. Goals

- **G1** — Logging an expense is fast enough that it becomes a habit.
- **G2** — The user can ask a question in plain English and get a correct answer.
- **G3** — The app looks and feels like something worth having on a home screen.
- **G4** — Another person can use it from their own phone without setup help.

## 4. Non-goals

Explicitly **not** building these. Listing them is a commitment, not an oversight.

- **Multi-currency / FX conversion.** SGD only.
- **Bank or card account syncing.** Manual entry only. Bank integration needs
  regulated API access and would consume the entire build.
- **Splitting expenses between people / social features.** Meaningless without
  multi-user accounts, and doubles the data model.
- **Income, savings goals, investments, net worth.** This is a spending tracker.
- **Desktop-first layout.** Desktop must not be broken, but the phone is the
  design target.
- **Data analysis beyond the current month and per-category totals.** No
  forecasting, no ML categorisation.

## 5. User stories

| # | Story |
|---|---|
| US1 | As a student, I want to log an expense in a few taps, so that I actually do it instead of putting it off. |
| US2 | As a student, I want to ask "how much did I spend on food this week?" and get a correct number, so I don't have to read a chart. |
| US3 | As a student, I want to say "add $4.50 chicken rice" and have it recorded, so logging is as fast as thinking. |
| US4 | As a student, I want to set a budget per category and see how close I am, so I can change behaviour before the month ends. |
| US5 | As a student, I want my data to still be there on a different device, so I don't lose months of history. |
| US6 | As a student, I want the app to look good, so I'm not embarrassed to open it in front of people. |

## 6. Functional requirements

Priority: **P0** = the demo is broken without it. **P1** = materially incomplete
without it. **P2** = valuable, cut first under time pressure.

### P0 — Core tracker *(built)*

- **R1** Record an expense with description, amount (SGD), category, date and
  optional note. Description and amount are required; invalid submissions are
  rejected with the offending fields highlighted.
- **R2** Edit and delete any existing expense. Deletion is immediately
  reversible via an Undo affordance.
- **R3** Create and delete custom categories, each with a colour. Deleting a
  category warns that its expenses are deleted too.
- **R4** Set a monthly budget per category; show spent-vs-budget with a visual
  indicator and a distinct over-budget state.
- **R5** View the current month's total, remaining budget, per-category
  breakdown, and full transaction list.
- **R6** Navigate to any previous month and view its totals and transactions.
- **R7** Drill into a single category to see its all-time total and history.
- **R8** Search and sort the transaction list once it exceeds 6 entries.
- **R9** Choose between visual themes; the choice persists across sessions.
- **R10** Data persists locally between sessions with no account required.

### P0 — Natural-language chat *(not built — the differentiator)*

- **R11** The user can ask a spending question in plain English and receive a
  correct answer. At minimum: totals by time period, totals by category, and
  "which day/category was highest".
- **R12** The user can add an expense by describing it in plain English. If the
  amount is missing or ambiguous, the assistant must ask rather than guess.
- **R13** Every number in an answer is computed by application code, never by
  the language model. See §8.
- **R14** The assistant is aware of the user's actual categories, including
  custom ones created at runtime.

### P1 — Accounts and sync *(not built)*

- **R15** A user can create an account and sign in.
- **R16** Expenses, budgets and categories persist server-side and are available
  on any device the user signs in from.
- **R17** One user can never read or modify another user's data.

### P2 — Cut first

- **R18** Installable to the phone home screen and usable offline (PWA).
- **R19** Export all data to CSV; import it back.
- **R20** Photograph a receipt and have the expense fields pre-filled.

## 7. Success metrics

Checkable on demo day, by someone who is not the author:

- **M1** A judge opens a public URL on their own phone and records an expense
  **without being told how**.
- **M2** Logging a typical expense takes **≤ 5 taps** end to end.
- **M3** The assistant answers these three questions correctly against seeded
  data: *"how much did I spend this week"*, *"which day did I spend the most"*,
  *"add an expenditure for chicken rice"*.
- **M4** Every figure the assistant reports matches the figure shown in the UI.
  **Zero tolerance** — one wrong number destroys trust in the whole feature.
- **M5** No console errors on load, on any theme, on phone or laptop width.

## 8. Key design decision: language vs arithmetic

**The language model does language. Application code does arithmetic.**

The assistant is given two tools and no raw data dump:

- `query_expenses(start_date, end_date, category?, group_by)`
- `add_expense(date, category, description, amount, notes)`

The model's job is to turn *"how much on food this week"* into a tool call with
the right date range and category. JavaScript then filters and sums the rows and
returns a computed result, which the model puts into a sentence.

**Why this matters:** the common failure mode is passing hundreds of rows into
the prompt and asking the model to total them. It will be right most of the
time, which is worse than being wrong all of the time — the errors are silent
and arrive exactly when a judge is watching. Requirement **M4** is only
achievable with this split.

Supporting constraints: the `category` parameter is an enum built from live app
state so custom categories work; `amount` is a required parameter so the model
asks instead of inventing a figure; today's date goes last in the system prompt
so it doesn't invalidate the cached prefix.

## 9. Technical architecture

**Current (built).** React 19 + Vite, no UI framework. State in React hooks;
persistence to `localStorage` behind a single module, `src/lib/storage.js`.
Deployed as a static build. No backend, no accounts, no network calls.

`src/lib/storage.js` is deliberately the **only** place the app touches
persistence, and its functions are already `async`. Swapping local storage for a
remote API is intended to be a change to that one file.

**Planned.** A small backend service holding a database and the chat endpoint.

**Hard constraint:** the Anthropic API key **must** live server-side. This
repository is public and the frontend is a static bundle, so any key shipped to
the browser is compromised on first push. The browser calls our own endpoint;
only that endpoint holds the key.

## 10. Milestones

1. **M-1** React frontend — *complete*.
2. **M-2** Backend service with the chat endpoint holding the API key.
3. **M-3** Chat feature with both tools wired to real data (**R11–R14**).
4. **M-4** Deploy to a public URL and verify on a real phone (**M1**).
   — **cut line: everything above must ship** —
5. **M-5** Accounts and server-side persistence (**R15–R17**).
6. **M-6** P2 items, time permitting.

If time runs short, **M-5 is cut before M-3**. A polished single-user app with a
working assistant demos far better than a multi-user app with a broken one.

## 11. Risks

| Risk | Mitigation |
|---|---|
| The assistant reports a wrong number in front of judges | Arithmetic in code, never in the model (§8); verify every answer against the UI before demoing |
| Deployment left to the last hour and fails | Deploy at **M-4**, before accounts; a live URL is a P0 deliverable, not a final step |
| Scope creep into accounts/PWA before the chat works | The cut line in §10 is binding |
| API key leaked in the public repo | Key server-side only; `.env` is git-ignored |
| Judge opens the app and sees an empty shell | Seed demo data so the charts are populated on first open |

## 12. Open questions

- **Q1** Hackathon date and duration — **TBD**.
- **Q2** Do the rules permit pre-existing code? Some hackathons require all code
  be written during the event. **TBD — must be confirmed before relying on the
  existing frontend.**
- **Q3** Solo or team, and who owns which layer — **TBD**.
- **Q4** Is an Anthropic API key available, and who pays for usage — **TBD**.
