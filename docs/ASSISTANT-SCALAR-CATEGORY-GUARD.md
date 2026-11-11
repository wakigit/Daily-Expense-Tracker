# The scalar-category gap: measured, and deliberately not closed

**Status: pinned, not implemented.** Measured 11 November 2026 at zero cost. **(ran)**

## The gap

`src/lib/intent.js` guards the explicit OR list `categories` against the categories the user named, but **nothing guards the scalar `category`.** A model that invents `category: 'food'` on a question naming no category gets that filter applied silently — the exact silent narrowing the coverage guard exists to prevent, reachable through the older field.

It is pinned by assertion in `scripts/category-coverage-checks.jsx` ("known gap"), so it is visible rather than rediscovered.

## Why a mention-guard was rejected

The obvious fix — refuse when the scalar category is not in `mentionedCategories(message, cats)` — was measured against the whole MAIN set and against synonym phrasings before being written. **It refuses legitimate questions, so it was not implemented.** **(ran)**

**MAIN:** 12 questions carry a scalar category in their recorded intent. Eleven pass. One does not:

| | Question | Recorded scalar | `mentionedCategories` | Verdict |
| --- | --- | --- | --- | --- |
| **M59** | *Eh how much I spend on makan this month ah?* | `food` | `[]` | **would be REFUSED** |

M59 is a legitimate question, correctly answered today. "Makan" is Singlish for food and is not a configured label, so the model's resolution is right and the guard's would be wrong.

**Synonym and partial-label probes: 9 of 42 would be refused.** **(ran)**

| Phrasing | Would refuse |
| --- | --- |
| Partial labels — "Daily", "Public", "Private", "Bubble", "Travel" | yes, 5 of 5 |
| Synonyms with no configured label — "transport", "dining", "groceries", "travel" | yes, 4 of 4 |
| Full labels, any case, any spacing, and the small aliases ("Food") | **no — all 28 pass** |

## What this says

`mentionedCategories` is a **literal label matcher**, and the model is doing real vocabulary resolution the matcher cannot reproduce. A guard built on it would convert that resolution into refusals, trading a silent-narrowing risk for a reliable loss of working answers. That is a bad trade on this evidence.

Note the asymmetry this leaves, and why it is tolerable: for the OR list, "all of them" has an identity the normaliser can recognise, so the guard can be kept without cost. For the scalar there is no identity to recognise — only a judgement about whether a word means a category.

## A design worth considering, when someone has the budget to measure it

1. **Disclose rather than refuse.** The answer already prints "Counting only: category Food & Drinks". Make an *unmentioned* scalar category render a stronger, explicit line — the filter the model chose, in the user's own category label, above the figure. Costs no correct answers and removes the silence, which is the actual complaint.
2. **Guard only the provably wrong case.** Refuse when the scalar category's label shares no token with the message AND the message contains another configured label — the model picked a different category from the one named. M59 survives (no other label present); a genuine mix-up does not.
3. **Ask the model to report its resolution.** A `category_terms` entry carrying the word it resolved from ("makan") would let the guard check the model's own claim instead of re-deriving it. This is a schema and prompt change, so it needs a full MAIN re-measurement and probably its own step.

**Do not implement any of these on the strength of this document.** Each needs the same before/after measurement the mention-guard just failed.
