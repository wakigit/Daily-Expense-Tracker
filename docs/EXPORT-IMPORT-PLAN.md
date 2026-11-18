# Export and import — plan only, nothing built

**No code has been written.** This is for review before anything is implemented. Claims are **ran** (I read the code or executed something), **inferred** (follows from something ran) or **unverified** (not measured — phone behaviour in particular).

Written 18 November 2026 on `dev`. Storage keys do not change anywhere in this plan.

## 0. The assumptions, after reading the code

A1–A6 all survive, and three of them turn out to have a working precedent in the repo already. One needs a correction, and it is the important one.

| | Verdict |
| --- | --- |
| **A1** full-backup JSON + expenses-only CSV | **keep** |
| **A2** JSON-only import in v1 | **keep**, §10 prices CSV import |
| **A3** dedupe by id only, never by content | **keep — and the code already argues for it**, §3 |
| **A4** preview then confirm, all-or-nothing | **keep**, and `sampleState.js` is the pattern to copy |
| **A5** two buttons in Settings | **keep**, it is one more `section.card` in a stack of seven |
| **A6** works across origins | **keep**, and nothing in the design is origin-dependent |

**The correction: an unknown category on import must not go through `validateExpense` the way the Add form does.** `validateExpense` falls back to `cats[0]` when a category is omitted, and only errors when one is *named but unknown* (`src/lib/actions.js:160-178`). Called carelessly during import, every row whose category does not exist locally would land silently in whichever category happens to be first. The import path must pass `requireCategory: true` **and** create missing categories before validating rows. **(ran.)**

## 1. Inventory — what has to be exported **(all ran)**

Every key, from `src/lib/storage.js:12-23`. The app never touches `localStorage` anywhere else, so this list is complete.

| Logical name | Key | Stored value |
| --- | --- | --- |
| expenses | `ww_exp` | array of expense objects (below) |
| budgets | `ww_bud` | object map `{ [categoryId]: numberInDollars }` |
| categories | `ww_cats` | array of `{ id, label, color }` |
| appName | `ww_name` | string, default `TallyAI` |
| theme | `ww_theme` | string theme id |
| motion | `ww_motion` | string, only `auto` or `on` |
| sampleMark | `ww_sample` | `null` or `{ version, loadedAt, todayYmd, months, rowCount, previousBudgets, appliedBudgets, introducedCategories }` |
| roastPreferences | `ww_roast_preferences` | `{ enabled, name, singapore, smu }` |
| roastCache | `ww_roast_cache` | opaque roast-session cache |

Values are a bare `JSON.stringify` of the value with no envelope or version (`storage.js:36`), and a parse failure or a missing key yields `null`, on which each caller keeps its default (`storage.js:27-31`).

**The expense row**, from `validateExpense` (`src/lib/actions.js:174-181`) plus the `id` added at insert (`:225`):

```
{ id, date, category, description, amount, notes }
```

- `date` — **`YYYY-MM-DD`**, and it must be a real calendar date; `2026-02-31` is rejected (`parseDate`, `actions.js:118-128`).
- `amount` — **decimal dollars, not cents**, snapped to a whole cent on entry (`gradeAmount`, `:108-115`), capped at `MAX_AMOUNT = 1_000_000` (`:24`). Totals are summed in integer cents elsewhere (`src/lib/money.js`), which is why export must not re-round.
- `description` — trimmed and whitespace-collapsed (`:136`).
- `notes` — `''` when absent.
- `category` — must equal some `cats[].id`.

**Ids, and why §3 matters:** new ids are `e<base36 ms>-<base36 seq>` (`newExpenseId`, `:59-62`), but the comment immediately above is load-bearing — *"Existing saved rows keep their numeric ids. Nothing migrates: ids are only ever compared for equality, so the two forms coexist indefinitely"* (`:55-57`). So an export can contain **string ids, numeric ids, or both**, and the importer must compare ids as values without assuming a format. Sample rows are additionally identifiable by an id prefix (`isSampleRow`, `src/lib/sampleData.js:27`).

**Legacy shapes already handled on load** (`src/hooks/useAppData.js:31-42`) — export writes the *current* shape, so an import of an old backup inherits these same normalisations only if it goes through them. The plan's importer must apply them itself:

- `appName` `'Expense Tracker'` is rewritten to `'TallyAI'`.
- An unknown `theme` id falls back to the default — three themes were removed in the wallpaper redesign.
- `motion` is accepted only as `'on'` or `'auto'`.
- `sampleMark` is accepted only if it is an object.
- `roastPreferences` is run through `normaliseRoastPreferences`.

## 2. The export files

**`tallyai-backup-YYYY-MM-DD.json`** — a full backup, one envelope:

```json
{
  "format": "tallyai-backup",
  "schemaVersion": 1,
  "app": "TallyAI",
  "exportedAt": "2026-11-18T07:30:00.000Z",
  "data": { "expenses": [...], "categories": [...], "budgets": {...},
            "appName": "TallyAI", "theme": "...", "motion": "auto",
            "roastPreferences": {...} }
}
```

`sampleMark` and `roastCache` are **deliberately excluded**: the first describes a sample load on *that* device and restoring it elsewhere would let "remove the sample data" delete rows it never added, and the second is a disposable cache. Rows the sample added are still exported as ordinary expenses — they are real rows in `ww_exp` — and because they keep their `sample-` id prefix the receiving device will still recognise them. **(inferred** from `sampleState.planLoad` and `isSampleRow`.**)**

**`tallyai-expenses-YYYY-MM-DD.csv`** — expenses only, for a spreadsheet. Columns: `id,date,category_id,category_label,description,amount,notes`. The label is included because a spreadsheet reader needs it; the id is included so a CSV can be reconciled against a JSON backup by hand.

## 3. Duplicates: by id only — the code already made this decision

`findDuplicate` already exists and matches on **description + amount in cents + date**, and its comment says why it is advisory rather than enforced: *"Same thing, same money, same day. Two S$1.40 kopis on one day are perfectly real, which is why this is reported rather than enforced"* (`src/lib/actions.js`, Duplicates section). **(ran.)**

So content matching is already rejected inside the app for exactly A3's reason, and the importer must not reintroduce it. Rules:

- **Same id, identical content → duplicate, skipped.** Re-importing the same file is therefore a no-op, which is what makes the feature safe to retry.
- **Same id, different content → conflict. The local row wins and the imported one is dropped**, counted in the preview. Keeping local is the conservative choice: the device the user is standing at is the one they can see.
- **Content-identical rows with different ids are both kept.** Two kopis stay two kopis.
- Ids are compared as **strings after coercion**, so a numeric legacy id and its string form are treated as the same id. **(inferred** from `:55-57`; worth one test.**)**
- A row in the file with **no id, or an id that collides with nothing**, is imported with its id preserved if present and a fresh `newExpenseId()` if not.

## 4. Import safety — the file is untrusted input

1. **Size limit before parsing: 5 MB.** A full `JSON.parse` of an attacker-sized file is the cheapest way to hang the tab. 5 MB is far above a realistic ledger — the whole eval fixture is a few hundred rows — and far below what hurts. Reject with a plain message, never a crash.
2. **Row-count limit: 20,000 expenses.** Guards the preview render and the `localStorage` write.
3. **Envelope check**: `format` must be `tallyai-backup` and `schemaVersion` must be `1`. A higher version is refused with *"this backup was made by a newer version of TallyAI"* rather than parsed optimistically. A lower version is a future problem; v1 has no predecessor.
4. **Every row through the app's own validators** — `parseDate`, `gradeAmount`, `validateExpense` with `requireCategory: true` (§0). No separate import validator, so there is exactly one definition of a valid row.
5. **Descriptions and notes are data, never instructions.** They are already trimmed and whitespace-collapsed by `validateExpense`, they are rendered as text by React, and the Ask architecture already treats ledger descriptions as untrusted. Import adds no new rendering path, so it adds no new injection surface. **(inferred.)**
6. **Unknown fields are dropped**, not carried. The importer rebuilds each row from the validated shape rather than spreading the file's object, so a `__proto__` or an extra key cannot ride along.
7. **Invalid rows are rejected individually and counted**, never silently fixed. A file with 3 bad rows out of 200 imports 197 and says so.

**Categories in the file that do not exist locally.** This is already solved once: `sampleCategories` (`src/lib/sampleState.js`) returns `{ categories, mapping, introducedCategories }` — it adds what is missing, maps the incoming ids onto local ones, and reports what it introduced so the UI can say so. The importer should use the same approach: **create missing categories first, remap the rows, and list the introduced categories in the preview.** A category whose id exists locally with a *different label* keeps the local label; only the id is matched, because budgets are keyed on the id.

## 5. Budgets and settings on import

**The suggested rule is right, and the repo already encodes the same instinct.** `sampleLoadNeedsConfirmation` gates on `ownRows(expenses).length > 0 || Object.keys(budgets).length > 0` (`sampleState.js:9`) — the app already decides how invasive to be by asking "does this device have anything of its own". **(ran.)**

So:

- **Device has no expenses of its own** → restore everything in the envelope: expenses, categories, budgets, appName, theme, motion, roastPreferences. This is the "new phone" case and the user's intent is unambiguous.
- **Device has expenses** → import **expenses and missing categories only**. Local budgets, appName, theme, motion and roast preferences are left alone, and the preview says so in one line.
- Either way the user sees the preview and confirms first.

One refinement rather than a replacement: the emptiness test should be `ownRows(expenses).length === 0`, i.e. **ignore sample rows**, so a user who tapped "Try it with sample data" and then imports a backup still gets the full restore. **(inferred** from `ownRows`.**)**

## 6. CSV safety

- **Escaping.** Any cell containing a comma, a double quote, a newline or a carriage return is wrapped in double quotes, and inner quotes are doubled. `CRLF` line endings, since that is what Excel expects. Descriptions are free text and will contain commas, so this is not optional.
- **Formula injection.** A cell whose first character is `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with a single quote `'` before quoting, so a description like `=1+1` or `@SUM(A1)` lands in the sheet as text. This matters because the description is user-entered on one device and opened in Excel on another, which is the classic path for this. Amounts are written from the numeric value and never from user text, so they are not a vector.
- **UTF-8 BOM.** The file starts with the byte-order mark `U+FEFF` (`\uFEFF`) so Excel on Windows reads it as UTF-8 and Singlish, emoji and non-English descriptions survive. Without it Excel guesses a legacy codepage and mangles them.
- **No CSV *parser* is written in v1**, which is most of why A2 holds — see §10.

## 7. Phone behaviour — the biggest unknown

**All of this is `unverified` and needs a real device. It is the main reason to keep the UI dumb.**

| | Risk |
| --- | --- |
| **iPhone Safari, normal tab** | A `Blob` + `URL.createObjectURL` + `<a download>` download is supported in modern iOS Safari, but the file lands in Files/Downloads with a system sheet rather than a visible "saved" confirmation. The `download` attribute's filename has historically been ignored on iOS, so the backup may arrive with a generated name. **Test on a real iPhone.** |
| **iPhone, home-screen web app (standalone)** | This is the one I would expect to break. A standalone PWA has no browser chrome, and historically an object-URL download in standalone mode either opened the JSON as text in a new view or did nothing at all. If it fails, the fallback is a "copy to clipboard" or an on-screen `<textarea>` the user can select — which is why export must not assume the download succeeded. **Must be tested in standalone mode specifically.** |
| **Android Chrome** | Download and `<input type="file">` both expected to work normally. Lower risk. |
| **File picker, both platforms** | `<input type="file" accept="application/json,.json">`. iOS presents Files, iCloud and third-party providers; `accept` filtering on iOS is advisory, so the importer must handle "user picked a photo" gracefully rather than assuming JSON. |
| **Quota** | `storage.save` already swallows a quota failure and returns `false` rather than crashing (`storage.js:38-44`). A bulk import is exactly when quota is hit, so the importer must **check the return value of the write** and tell the user it failed, instead of showing a success count for data that was not saved. **(ran** for the swallow; the plan's requirement is new.**)** |

**Nothing here needs a new dependency.** `<input type="file">`, `FileReader`, `Blob`, `URL.createObjectURL`. The repo already uses the same family of APIs for receipts (`src/components/ReceiptButton.jsx`, `src/lib/receiptImage.js`), so the patterns are in the codebase. **(ran.)**

## 8. UI — one card, two buttons, one dialog

`SettingsView.jsx` is already a stack of `section.card.set--*` blocks with an `--i` ordering variable (`set--theme`, `set--motion`, `set--roast`, `set--name`, `set--budgets`, `set--cats`, `set--sample`). A new **`set--data`** card with **Export** and **Import** sits in that stack with no layout work, next to `set--sample`, which is the other card that moves bulk data. **(ran.)**

The preview dialog states, in plain words:

> **N new**, N duplicates skipped, N conflicts kept local, N invalid rows rejected.
> *Also creating 2 categories: Bubble Tea, Private Hire.*
> *Your budgets, theme and name are not changed.*

Then **Import** / **Cancel**. Nothing is written until Import is pressed, and the write is one `setExpenses` with the whole merged array, so it either all lands or none of it does. Reusing the shape of `sampleState.planLoad` — a pure function from current state to next state plus counts — means the preview and the write are computed by the same call, so the numbers shown cannot drift from what is written. **(ran** for `planLoad`'s shape, `sampleState.js:40-60`.**)**

## 9. Effect on Ask — it already works, with one wrinkle

**Imported rows mark prior answers out of date, correctly and automatically.** `App.jsx:96-98` runs `markOutdatedAnswers(messages, expenses, cats, budgets)` in an effect keyed on `[expenses, cats, budgets, chat]`, so any change to the expenses array triggers it. `evidenceIsOutdated` (`src/lib/answerEvidence.js`) then **re-applies each answer's own scope to the current ledger** and compares the row count and every row's snapshot — so an import that adds rows inside an answer's date window flips it to "Out of date", and an import outside that window correctly leaves it alone. Its `historyStart` check also catches an all-time answer when a row older than the previous earliest row arrives. **(ran.)**

Three consequences worth stating:

1. A bulk import may mark **many** answers outdated at once. That is correct, and the banners already exist (`AnswerEvidence.jsx:11`, `PlanAnswer.jsx:13`, `ComparisonEvidence.jsx:8`).
2. The follow-up context (`createAssistantSession().noteLedger`) is told about the new ledger in the same effect, so a follow-up after an import will not answer against the pre-import rows. **(ran.)**
3. **Undo.** `actionLog` records expense changes so they can be reversed, and is deliberately session-only (`App.jsx:100-102`). A 200-row import should be **one** entry in that log, not 200, or "undo" becomes unusable. This is a design requirement, not an observation.

## 10. CSV import, if it is ever wanted

Not in v1. What it would cost, so the decision is informed:

- A real CSV **parser**, not a `split(',')` — quoted fields, embedded commas and newlines, `CRLF`, a BOM to strip, and Excel's habit of re-quoting. This is the single largest piece of work in the whole feature and it is all edge cases.
- **Column mapping UI**, because a user will bring a bank export or a sheet they made, not ours.
- **Ambiguous amounts**: `1.234,56`, `S$12.30`, `(12.30)` for negative, thousands separators.
- **No ids**, so every row is new and re-importing the same CSV duplicates the whole file — which breaks the one property that makes JSON import safe to retry.
- Dates in a dozen formats, including Excel serial numbers.

**Estimate: as much work as the rest of this plan combined, with a worse safety story.** My recommendation is to leave CSV as export-only and revisit only if a real user asks to bring data *in* from a bank or another app.

## 11. Tests, fictional data only

No real ledger, no personal data, following the standing rule that regression tests use new fictional data rather than the eval fixture.

1. **Round trip** — export a known fictional ledger, import it into an empty device, and assert the resulting `expenses`, `categories` and `budgets` are deep-equal to the originals, with amounts compared in integer cents.
2. **Re-import adds nothing** — import the same file twice; the second import reports `0 new` and leaves the array identical.
3. **Conflict** — same id, different amount: local row kept, counted as a conflict, nothing written.
4. **Legacy numeric id** — a row whose id is `17` matches a local row whose id is `'17'`.
5. **Unknown category** — a row naming a category the device lacks: the category is created, the row is imported into it, and the preview lists it. A second row naming an id that exists locally with a different label keeps the local label.
6. **Malformed input** — not JSON; valid JSON that is not an object; missing envelope; `schemaVersion: 2`; `expenses` not an array; a row missing `date`; `2026-02-31`; amount `0`, negative, `1e9`, `"12.30"` as a string, and `NaN`.
7. **Oversized** — a 6 MB file is rejected before parsing; a 20,001-row file is rejected with a count.
8. **Prototype pollution** — a row carrying `__proto__`, `constructor` and an extra unknown key; the stored row has exactly the six known fields.
9. **CSV escaping** — descriptions containing a comma, a double quote, a newline, a `CRLF`, a leading space, an emoji and Chinese characters; assert the exact bytes including the BOM.
10. **CSV injection** — descriptions `=1+1`, `+1`, `-1`, `@SUM(A1)`, and a tab-prefixed one; assert each cell is prefixed so a spreadsheet treats it as text.
11. **Large ledger** — 20,000 rows: assert the preview computes without blocking long enough to feel broken, and that a simulated quota failure surfaces as an error rather than a false success.
12. **Ask integration** — ask a question, import rows inside the answer's window, assert the answer is marked outdated; import rows outside it, assert it is not.

All of these are pure-function tests against the planner and the serialisers, which is the reason §8 puts the logic in a `planLoad`-shaped function rather than in a component.

## 12. Commits

1. `feat(data): export every ww_* key as a versioned JSON backup` — serialiser + the Settings card's Export button, with round-trip and shape tests.
2. `feat(data): expenses CSV export, escaped and injection-safe` — CSV writer with the escaping, BOM and injection tests.
3. `feat(data): import planner, id-only duplicate rules` — the pure planner plus tests 2-8; no UI.
4. `feat(data): import preview and confirm` — dialog, file input, the all-or-nothing write, the quota-failure path.
5. `test(data): large ledger and Ask outdated-answer integration` — tests 11-12.
6. `docs: export/import` — README and PRD wording.

Each is one logical change and each runs the full gate. **Estimate: 4-6 hours of focused work across two or three sessions**, with the CSV escaping and the import planner taking most of it, plus one session on a real phone. **(inferred.)**

## 13. Decisions I need from you

1. **Filename pattern** — `tallyai-backup-2026-11-18.json`, or include the time for multiple exports in one day?
2. **Does export include sample rows?** My plan says yes, because they are real rows in `ww_exp`, but it excludes `sampleMark`, so on the receiving device they are permanent rows the sample card can no longer remove. The alternative is to exclude `sample-` prefixed rows entirely.
3. **Conflict direction.** Local wins, always, in my plan. The alternative is to ask per conflict, which gets unusable past a handful.
4. **Size and row limits** — 5 MB and 20,000 rows, or different numbers?
5. **The empty-device test** — `ownRows(expenses).length === 0` as proposed, so sample data does not block a full restore; or strict `expenses.length === 0`?
6. **Is the standalone-PWA download failure acceptable in v1** with a copy-to-clipboard fallback, or must it be solved before shipping?
7. **CSV import** — confirm it stays out of v1 on §10's evidence.
8. **Where the buttons live** — a new `set--data` card as proposed, or inside the existing `set--sample` card since both move bulk data?
