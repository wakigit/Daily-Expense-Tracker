# Capability upgrade verification, 18 October 2026

## Scope and data handling

Inspected the existing dirty `wallpaper-redesign` tree first. Existing changes were retained. No commit, push or deployment was made. Browser QA used `127.0.0.1:5185`, initially an empty ledger. The original app origin was not modified. All added fictional transactions, sample data and the long-label test category were removed afterward. The isolated ledger was verified as S$0.00 and zero transactions, with its original default preferences restored.

The backend was intentionally stopped for offline assistant and failed-roast tests. A separate Codex chat subsequently started a backend and reported its own successful HTTP 200 live total request and second `analyze` validation. That is separately reported user-supplied verification. Its process predated our last validator edit, so it was restarted with the current code. The refreshed backend is left on `127.0.0.1:8787`, with allowed local frontend origins on 5185, 5175 and 5173. A final health check returned `status: ok`. Local health is a liveness check, not proof of provider access.

## Implemented

- Shared strict query contract and local filtering/calculation/evidence pipeline for totals, counts, averages, lists, highest groups, comparisons, weekday/weekend analysis and category budget pace estimates.
- Combined inclusive date ranges/relative periods, real category IDs, literal description substring, integer-cent amount conditions and applicable weekday filters. Future rows excluded from analysis. No ledger rows, calculated totals, expense IDs, code or SQL sent to the interpretation model.
- Backend Structured Outputs schema and both validators agree. Legacy read intents remain compatibility-only; new model reads use `analyze`. Known multiple category names are independently checked against the original question as well as reported category terms.
- Specific clarification with an editable complete original question. Offline matching uses the same engine or gives a limitation, including incomplete thresholds and unsupported periods.
- Independent desktop columns: Recent on the left; Budget then Where it went on the right. Explicit category excess amounts; exact-budget categories not overspent. Phone ordering and five-row preview retained.
- Selectable daily bars including all-zero windows, real dates/weekdays, read-only date panel, keyboard opening/closing and focus restoration. Full ledger supplies the window across month boundaries; laptop chart remains cumulative.
- Validated date searches in both list views, visible month/category scope, outside-month switch action, original text searches and filtering/sorting before preview.
- Relevant source changes invalidate snapshots without rewriting historical figures. Projection snapshots also invalidate on category budget changes. Changes to the earliest recorded date invalidate all-history averages even if the added row belongs to another category.
- Accurate capability discovery and receipt/hardware documentation.

## Independent expected answers versus actual

The deterministic fictional fixture in `scripts/query-checks.jsx` uses custom IDs `custom-meals`, `travel-42` and `leisure`; today is 2026-10-18. It contains Chicken rice 10.00, 10.01 and 20.00; Kopi 0.10; Grab ride 15.00; GrabFood lunch 20.00; Art class 15.00; prior-month rice 8.00; and a future 999.00 row which must be excluded.

| Family / variation | Independent expected result | Actual |
| --- | --- | --- |
| Total, current month | S$90.11, excluding future row | Pass |
| Weekdays vs weekends, Oct 1–18 | S$70.01 / 12 days vs S$20.10 / 6 days; averages S$5.83 vs S$3.35 | Pass |
| Food strictly over S$10 | IDs b, c, f, never the exact-S$10 row | Pass |
| At least S$15 | IDs c, e, f, g | Pass |
| Under S$10 / at most S$10.01 | d / a, b, d | Pass |
| Text + category + inclusive amount | Chicken + Food + at least S$10.01 selects b, c | Pass |
| Usually highest weekday, Oct 1–18 | Tuesday S$10.00 average, S$20.00 total, 2 calendar occurrences; only f as evidence | Pass |
| Highest daily total tie | Both exact winning groups, c and f, each S$20.00 | Pass |
| Chicken rice comparison | S$40.01 vs S$8.00, S$32.01 more, both source lists | Pass |
| Category budget pace | Food S$60.11 / 18 days; S$39.89 remaining from S$100; about 11.9 days, around Oct 30 | Pass |
| Custom category, no history / no budget | No invented rate / explicit no-budget state | Pass |
| Last week boundary at Monday Oct 19 | Oct 12–18 inclusive, excludes Oct 11 and 19 | Pass |
| Partial week at Oct 1 | Sep 28–Oct 1 vs Sep 21–24; later prior-week row excluded | Pass |
| Short prior February | Mar 1–31 vs Feb 1–28, shorter-period limitation | Pass |
| Equal totals / zero earlier total | Zero difference and 0%; percentage unavailable at zero baseline | Pass |
| Cent exact arithmetic | 0.10 + 0.20 = S$0.30 | Pass |
| Differing weekday conclusions | Weekdays total S$50, weekends S$40; daily averages S$10 vs S$20, difference explained | Pass |
| Invalid/reversed dates, missing thresholds, unknown/multiple categories, invented fields | Reject or clarify; no rollover or silently simpler answer | Pass |
| Date search variants | ISO, day/month/year, named month with selected year, case-insensitive; invalid dates rejected | Pass |
| Evidence changes | Source edit/delete/add, competing winner, earlier comparison side, budget change and history-start change mark stale | Pass |

Additional variants use Food, Creative hobbies, Grab, chicken rice, quoted descriptions, different operators and explicit date ranges. A quoted category word remains a description term, not an implicit category filter. Multi-subject descriptions are clarified rather than combined silently.

## Live OpenAI results, verified here

Controlled fictional Responses calls passed strict output, server validation, client validation and independent local expected figures for all five families:

- Weekdays/weekends: S$10.01 weekdays and S$20.00 weekends in the separate live fixture.
- Filtered list: two Food rows over S$10, S$30.01 total.
- Usual weekday: Saturday, with calendar occurrences calculated locally.
- Description comparison: Chicken rice S$30.01 vs S$8.00, S$22.01 difference.
- Custom-category projection: Creative hobbies has no recorded spending, so no invented rate.

Initial iterations exposed the legacy read-schema alternative and conflicting prompt rules about categories and missing amounts. Those were removed/replaced; targeted comparison and projection retries then passed. These were bounded explicit checks, not an automatic retry loop. Intent requests now have a 10-second server timeout with SDK retries disabled, inside the existing 12-second client timeout and 30-second function budget.

A live browser filtered-list answer also returned three Food expenses over S$10, S$57.00 total, with Chicken chop 13.50, Lunch set 11.50 and Dinner with friends 32.00 as source rows. It had no offline label. Earlier browser answers deliberately exercised the offline path and were labelled as such.

## Roaster

Three distinct fictional rows with description `Fictional test kopi`, Food, S$3.30 each, dated Oct 18, were saved. The first two had roasting disabled. The third produced a live card labelled **AI-generated roast**. Exact repeat facts were three purchases this week/month totalling S$9.90, Food S$155.70 and overall S$340 against S$320, so over-budget intensity 2. Optional fictional name and Singapore/SMU preferences were enabled. Other Food descriptions were not counted as this repeat.

Validated live text:

> Fictional Alex dropped $3.30 on a test kopi thrice in one week—talk about a coffee audit! Your caffeine expenses are making the finance team sweat harder than a Monday morning meeting.

The count, individual amount and optional name agree with supplied facts. The meeting is a joke, not a claim about an actual meeting. Reload displayed the same cached text; automated request-count checks verify no repeat paid request.

Intentional forced failure: backend stopped, one S$9.99 `Fictional roast failure` saved. Count moved from 31 to 32 and total from S$340.00 to S$349.99. The card was labelled **Offline quip**:

> Purchase logged. The budget has requested a dramatic pause and a very long meeting.

Deleting that row removed the obsolete card and restored S$340.00. Focused automated checks cover off/default preferences, exact repeated counts, unrelated Food, optional contexts, intensity bands (<75%, 75–100%, >100%, no budget/historical), cache, late responses, provider failure, all save entry points and edit/delete/undo cleanup. The transient browser Undo button expired before a separate click, so this stage's browser Undo attempt is not claimed as a completed check; automated Undo checks pass.

## Browser checks performed here

Viewport overrides: 1440×900, 1280×800 and 390×844. On scrolling pages Chrome captures can exclude the scrollbar and scale the bitmap, so some image dimensions are smaller than the configured viewport. Dialog and non-scrolling captures retain the full size. These are desktop Chrome responsive checks, not physical-device verification.

- Independent column positioning after expanding Recent; five initial rows and all 28 expanded rows; Show less and month-reset behavior.
- Readable full long custom category label with amount wrapping, explicit excess, and Needs exactly at its S$40 budget without an excess label.
- Home “17 OCT” search: Oct 17 selects MRT 15.00 and Yong tau foo 7.80, S$22.80. Food category same date selects only Yong tau foo 7.80. Changing category month updates Public transport from Oct S$45.00 to Sep S$65.00, agreeing with Home.
- Day panel Oct 17: S$22.80, 2 exact rows. Entirely empty November window still has seven buttons; Nov 30 panel shows S$0.00 and zero rows. Keyboard activation, close, Escape and returned focus checked.
- Usual Food weekday: Wednesday S$19.65, S$39.30 total over 2 calendar Wednesdays, only Dinner with friends and Toast Box as evidence.
- Custom category projection with no history: S$10 remains, no date estimate. Changing its budget to S$11 retains the old S$10 answer and shows Out of date.
- Existing single-category Food donut: complete visible ring and S$0.30 centre total, one real row, no unnecessary View all.
- Existing large crab inspected at laptop widths with a healthy fictional budget. The over-budget scene intentionally hides the crab through its existing decay rules. New beach-only dashboard padding keeps the right donut out of its patrol; animation itself was not rebuilt. Phone crab remains visible.
- Amounts and controls checked in all three wallpaper palettes across the QA session. No material clipping or overlap remains in the inspected states. Some long Home transaction descriptions still use the existing ellipsis; expanded answer evidence displays complete descriptions.

## Hardware and remaining limitations

Physical laptop/phone microphone and real receipt-photo cases remain **awaiting Wei Kai**, not passed. A first laptop microphone draft instruction was sent through the question UI. See `HARDWARE-CHECKLIST.md` for decimal/category/yesterday/unclear/permission-denied cases and ordinary/GST+service/fuzzy/non-SGD receipts. No personal receipt files were selected or read by the agent. Receipt results are receipt-level drafts, not item extraction. Phone mic testing needs an appropriate HTTPS origin; a local Wi-Fi HTTP page is not sufficient. No HTTPS deployment was created in this stage.

Unsupported: multi-category aggregation, multiple independent description terms, arbitrary comparison period pairs, unsupported projection filters, and unrestricted financial advice. Offline grammar is intentionally narrower than natural-language model interpretation and clarifies unresolved wording. Description substring matching is not merchant entity recognition. Model interpretation can still be wrong, so the visible interpretation and source evidence remain necessary.

Public AI endpoints still lack account authentication and a distributed quota/cost cap. Per-instance rate limiting alone does not establish a public spend ceiling.

## Final automated commands

- `npm run build`: passed.
- `npm run smoke`: 933/933 passed.
- `npm --prefix backend test`: 28/28 provider checks plus 81/81 Node tests, 109 total passed.
- `git diff --check`: passed.

Logs: `/private/tmp/tallyai-upgrade-smoke.log`, `/private/tmp/tallyai-upgrade-backend.log`.

## Screenshots

All are fictional data only, outside Git, under `/private/tmp/`:

- `tallyai-upgrade-columns-final-1440.jpg`
- `tallyai-upgrade-columns-final-1280.jpg`
- `tallyai-upgrade-home-1440.jpg` (forest)
- `tallyai-upgrade-beach-1440.jpg`
- `tallyai-upgrade-beach-1280.jpg`
- `tallyai-upgrade-roast-1280.jpg` (city, live roast)
- `tallyai-upgrade-roast-phone.jpg`
- `tallyai-upgrade-roast-failure-laptop.jpg`
- `tallyai-upgrade-recent-collapsed-phone.jpg`
- `tallyai-upgrade-recent-expanded-phone.jpg`
- `tallyai-upgrade-budgets-phone.jpg`
- `tallyai-upgrade-day-phone.jpg`
- `tallyai-upgrade-empty-day-phone.jpg`
- `tallyai-upgrade-date-search-laptop.jpg`
- `tallyai-upgrade-category-phone.jpg`
- `tallyai-upgrade-filter-phone.jpg`
- `tallyai-upgrade-weekdays-phone.jpg`
- `tallyai-upgrade-weekday-pattern-1280.jpg`
- `tallyai-upgrade-projection-outdated-laptop.jpg`
- `tallyai-upgrade-single-donut-phone.jpg`

Stop for review. Public deployment and video have not started.
