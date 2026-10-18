# ChromaDB semantic search results

Run on 2026-10-18 against 68 invented sample transactions (`tools/chroma-demo/sample-transactions.json`).

Embedding model: Chroma's default `DefaultEmbeddingFunction`, which is `all-MiniLM-L6-v2` running locally under onnxruntime. No API key and no paid call is involved.

Distance is cosine distance: lower is a closer match. A low distance means the sentence embeddings are near each other, not that the row is necessarily a correct answer to the question.

## "late night supper"

| # | distance | description | category | date | amount |
|---|---|---|---|---|---|
| 1 | 1.0064 | Supper prata | Food | 2026-09-12 | S$4.40 |
| 2 | 1.0804 | Supper prata | Food | 2026-10-12 | S$4.40 |
| 3 | 1.1736 | Dinner with friends | Food | 2026-10-07 | S$32.00 |
| 4 | 1.1937 | Dinner with friends | Food | 2026-09-07 | S$32.00 |
| 5 | 1.3337 | Lunch set | Food | 2026-09-13 | S$11.50 |

## "getting to school"

| # | distance | description | category | date | amount |
|---|---|---|---|---|---|
| 1 | 1.4552 | Grab to campus | Private hire | 2026-09-04 | S$14.20 |
| 2 | 1.4623 | Grab to campus | Private hire | 2026-10-04 | S$14.20 |
| 3 | 1.5287 | Notebook and pens | Shopping | 2026-09-05 | S$18.40 |
| 4 | 1.5290 | Dinner with friends | Food | 2026-09-07 | S$32.00 |
| 5 | 1.5625 | Mee pok | Food | 2026-09-08 | S$5.00 |

## "coffee and breakfast"

| # | distance | description | category | date | amount |
|---|---|---|---|---|---|
| 1 | 1.2774 | Bubble tea | Food | 2026-09-21 | S$6.20 |
| 2 | 1.3071 | Bubble tea | Food | 2026-09-06 | S$6.20 |
| 3 | 1.3612 | Toast Box | Food | 2026-09-14 | S$7.30 |
| 4 | 1.3640 | Bubble tea | Food | 2026-10-06 | S$6.20 |
| 5 | 1.4047 | Dinner with friends | Food | 2026-09-07 | S$32.00 |

## "printing and school supplies"

| # | distance | description | category | date | amount |
|---|---|---|---|---|---|
| 1 | 1.0779 | Printing credit | Needs | 2026-10-15 | S$12.00 |
| 2 | 1.1216 | Printing credit | Needs | 2026-09-15 | S$12.00 |
| 3 | 1.2278 | Notebook and pens | Shopping | 2026-09-05 | S$18.40 |
| 4 | 1.2327 | Notebook and pens | Shopping | 2026-10-05 | S$18.40 |
| 5 | 1.4086 | Lunch set | Food | 2026-10-13 | S$11.50 |

## "entertainment and going out"

| # | distance | description | category | date | amount |
|---|---|---|---|---|---|
| 1 | 1.3905 | Dinner with friends | Food | 2026-09-07 | S$32.00 |
| 2 | 1.3908 | Concert ticket | Miscellaneous | 2026-09-19 | S$48.00 |
| 3 | 1.4125 | Hotpot with friends | Food | 2026-09-25 | S$28.00 |
| 4 | 1.4185 | Dinner with friends | Food | 2026-10-07 | S$32.00 |
| 5 | 1.4405 | Birthday gift | Miscellaneous | 2026-10-10 | S$25.00 |

## "something to eat" filtered to `where={"month": "2026-10"}`

The metadata filter is exact, so only October 2026 rows are eligible; the ranking within them is still semantic.

| # | distance | description | category | date | amount |
|---|---|---|---|---|---|
| 1 | 1.3385 | Dinner with friends | Food | 2026-10-07 | S$32.00 |
| 2 | 1.4178 | Lunch set | Food | 2026-10-13 | S$11.50 |
| 3 | 1.4277 | Chicken chop | Food | 2026-10-15 | S$13.50 |
| 4 | 1.4392 | Supper prata | Food | 2026-10-12 | S$4.40 |
| 5 | 1.4485 | Mee pok | Food | 2026-10-08 | S$5.00 |
