# Ask evaluation — step3b1-final (MAIN)

Mode **mock** · reference date **2026-10-19** · generated 2026-10-19T13:48:06.678Z

> Mixed-age MAIN replay. M66 and M68 attempted once on Step3B1 (only M68 envelope differs); 72 other recordings untouched. No expectation changes. Final safety guards revalidated saved live intents, not new provider calls.

## Score

| | Passed | Total | Rate |
| --- | ---: | ---: | ---: |
| Questions | 74 | 76 | 97.4% |
| Turns | 80 | 82 | 97.6% |

Paid model calls: **0** (of 0 HTTP requests; a 400 never reaches the provider). Offline fallbacks: **0** (an offline answer never counts as a live pass).

## Per capability

| Capability | Passed | Total | Rate | Failing ids |
| --- | ---: | ---: | ---: | --- |
| breakdown | 5 | 5 | 100.0% | — |
| budget-no-budget | 1 | 1 | 100.0% | — |
| budget-projection | 4 | 4 | 100.0% | — |
| complex-arbitrary-periods | 1 | 1 | 100.0% | — |
| complex-average-per-week | 1 | 1 | 100.0% | — |
| complex-combined | 1 | 1 | 100.0% | — |
| complex-compare-category | 1 | 1 | 100.0% | — |
| complex-multipart-percentage | 1 | 1 | 100.0% | — |
| complex-multiple-categories | 1 | 1 | 100.0% | — |
| complex-savings-goal | 1 | 1 | 100.0% | — |
| complex-share-per-category | 1 | 1 | 100.0% | — |
| complex-top-n | 1 | 1 | 100.0% | — |
| complex-trend | 1 | 1 | 100.0% | — |
| complex-two-category | 1 | 1 | 100.0% | — |
| complex-what-if | 1 | 1 | 100.0% | — |
| day-types | 1 | 1 | 100.0% | — |
| filter-amount | 4 | 4 | 100.0% | — |
| filter-category | 1 | 1 | 100.0% | — |
| filter-custom-category | 1 | 1 | 100.0% | — |
| filter-day | 2 | 2 | 100.0% | — |
| filter-description | 3 | 3 | 100.0% | — |
| filter-description-case | 1 | 1 | 100.0% | — |
| filter-description-trap | 1 | 1 | 100.0% | — |
| filter-legacy-category | 1 | 1 | 100.0% | — |
| followup-chain | 3 | 3 | 100.0% | — |
| followup-guard | 1 | 1 | 100.0% | — |
| injection-row | 2 | 2 | 100.0% | — |
| must-clarify | 6 | 6 | 100.0% | — |
| must-refuse | 2 | 2 | 100.0% | — |
| period | 8 | 8 | 100.0% | — |
| ranking | 3 | 3 | 100.0% | — |
| ranking-latest | 1 | 1 | 100.0% | — |
| ranking-tie | 2 | 2 | 100.0% | — |
| ranking-weekday | 1 | 1 | 100.0% | — |
| robustness-empty | 1 | 1 | 100.0% | — |
| robustness-injection | 1 | 1 | 100.0% | — |
| robustness-long | 1 | 1 | 100.0% | — |
| robustness-noise | 1 | 1 | 100.0% | — |
| robustness-singlish | 1 | 1 | 100.0% | — |
| robustness-typo | 1 | 1 | 100.0% | — |
| scope | 1 | 2 | 50.0% | M46 |
| scope-chain | 0 | 1 | 0.0% | M48 |
| scope-clarify | 1 | 1 | 100.0% | — |

## Root causes

| Root cause | Failing turns |
| --- | ---: |
| unsupported-capability | 1 |
| interpretation | 1 |

## Failures

| id | question | wanted | got | root cause | detail |
| --- | --- | --- | --- | --- | --- |
| M46 | How much have I spent on bubble tea related purchases this year? | propose_scope/answer | clarify | unsupported-capability | clarified instead of answering: Related purchases need explicit inclusion rules before a calculation. Which purchase-description terms or categories should count? I can propose literal rules for your review and approval. Your original request: “How much have I spent on bubble tea related purchases this year?” |
| M48.2 | Exclude brunch. | propose_scope | clarify | interpretation | outcome clarify, wanted propose_scope |

## Definitions used by the oracle

- **lastNDays**: Last N days is inclusive of today: start = today - (N-1), end = today.
- **weekStart**: Calendar weeks start on Monday (ISO). "This week" is weekStart(today) through today.
- **monthToDate**: "This month" is the 1st of the current month through today, not the whole month.
- **lastMonth**: "Last month" is the whole previous calendar month, 1st through its last day.
- **year**: "This year" / year-to-date is 1 January of today's year through today.
- **all**: "All time" starts at the earliest recorded date on or before today and ends today.
- **range**: An explicit range is inclusive; an end after today is capped at today.
- **dayFilter**: Weekday means Monday-Friday. Weekend means Saturday-Sunday.
- **amounts**: All arithmetic is in integer cents. A dollar amount is converted once, at the boundary.
- **description**: Description matching is a case-insensitive literal substring. No stemming, no aliases.
- **compareMonth**: Compare month: this month-to-date versus the SAME day-of-month span of the previous month, capped at that month's last day.
- **compareWeek**: Compare week: weekStart(today)..today versus the same weekday span shifted back exactly 7 days.
- **breakdownSort**: Breakdown groups sort by month key chronologically, or by category label alphabetically then id.
- **averages**: daily_average divides by calendar days in range matching the day filter (zero-spend days included); per_transaction divides by matching row count; calendar_week is the daily rate times seven; calendar_month divides by the number of distinct calendar months the range touches.
- **evidenceIds**: Evidence ids are the ledger ids of the rows a figure was computed from. Compared as a sorted set: membership is the correctness claim, display order is a presentation concern.
