# Ask evaluation — step3a-live-subset (MAIN)

Mode **live** · reference date **2026-10-19** · generated 2026-10-19T07:18:01.104Z

> Fresh local server handling for five intended MAIN families; broad financial assessment handled locally. No repeated requests. A clarification is handling success, not capability implementation.

## Score

| | Passed | Total | Rate |
| --- | ---: | ---: | ---: |
| Questions | 3 | 6 | 50.0% |
| Turns | 3 | 6 | 50.0% |

Paid model calls: **5** (of 5 HTTP requests; a 400 never reaches the provider). Offline fallbacks: **2** (an offline answer never counts as a live pass).

## Per capability

| Capability | Passed | Total | Rate | Failing ids |
| --- | ---: | ---: | ---: | --- |
| complex-multipart-percentage | 1 | 1 | 100.0% | — |
| complex-multiple-categories | 0 | 1 | 0.0% | M68 |
| complex-two-category | 0 | 1 | 0.0% | M66 |
| must-clarify | 2 | 2 | 100.0% | — |
| scope | 0 | 1 | 0.0% | M46 |

## Root causes

| Root cause | Failing turns |
| --- | ---: |
| contract | 2 |
| unsupported-capability | 1 |

## Failures

| id | question | wanted | got | root cause | detail |
| --- | --- | --- | --- | --- | --- |
| M46 | How much have I spent on bubble tea related purchases this year? | propose_scope/answer | clarify | unsupported-capability | clarified instead of answering: Related purchases need explicit inclusion rules before a calculation. Which purchase-description terms or categories should count? I can propose literal rules for your review and approval. Your original request: “How much have I spent on bubble tea related purchases this year?” |
| M66 | Did I spend more on Food & Drinks or Bubble Tea this month? | clarify/propose_scope/answer | clarify (offline) | contract | fell back to offline (invalid_intent) |
| M68 | How much did I spend on Food & Drinks, Bubble Tea and Public Transport this month? | clarify/propose_scope/answer | clarify (offline) | contract | fell back to offline (invalid_intent) |

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
