import { categoryNames } from './categoryVocabulary.js';
import { normaliseScopeText } from './filterMatching.js';
import { mentionedCategories } from './intentLimitations.js';

/**
 * "Every configured category" is the ABSENCE of a category filter, not a
 * narrowing of one.
 *
 * Step 3 added the explicit OR list `categories`, and the model began using
 * `categories: [every configured id]` to say "across all of them". The
 * coverage guard in intent.js then compared that list against the categories
 * the USER named, found none, and refused a question that previous production
 * answered — measured on 2026-11-11, the same sentence answering at `6cf9345`
 * and refusing at `eaab1a5` (docs/PUBLISH-GATE-2026-11-11.md §11.9, §12).
 *
 * The guard is right and stays exactly as it is. What was wrong is that the
 * identity filter reached it at all. This step removes it first, in one place,
 * on the server and the client alike, and ONLY when the user named no category
 * of their own.
 *
 * Why this cannot become a loophole:
 *
 *   - It only ever BROADENS. Clearing the list restores "every row", which is
 *     a superset of what the list selected. The guard exists to stop a silent
 *     *narrowing*; widening to the question actually asked is the opposite.
 *   - It is correct about orphan rows. A row whose category was deleted is
 *     EXCLUDED by `categories: [all configured ids]` and INCLUDED with no
 *     category filter, so clearing the list is strictly more faithful to
 *     "how much did I spend", not less.
 *   - It never fires when the user named a category. Then the list is a real
 *     claim about a real request and coverage must still be proven.
 *   - It never fires on an invented category WORD. If any `category_terms`
 *     entry does not map to a configured category, the metadata is not a
 *     faithful description of "all of them" and the existing guard keeps it.
 *
 * Deliberately NOT handled here: `descriptionTerms`. There is no "every
 * description" identity, so an unrequested description term is always a
 * narrowing and must keep refusing.
 */

/** One configured category, named by any of its accepted labels or aliases. */
const matchesCategory = (cat, term) =>
  categoryNames(cat).some(name => normaliseScopeText(name) === normaliseScopeText(term));

/** The declared category words on a query, under either spelling of the field. */
const declaredTerms = query => {
  const terms = query?.category_terms ?? query?.categoryTerms ?? [];
  return Array.isArray(terms) ? terms : null;
};

/**
 * Does this query declare EVERY configured category, however it spells it?
 *
 * Three encodings reach us from the model and all three mean "all of them":
 * ids alone, labels alone, and both together. Case and spacing are handled by
 * `normaliseScopeText`, and `categoryNames` accepts the small aliases, so
 * "food", "FOOD", " Food  &  Drinks " and "Food and Drinks" all name `food`.
 *
 * A NON-empty id list that does not cover everything is a real narrowing, and
 * then the labels beside it cannot rescue it — the ids are what filters rows.
 */
export function coversEveryConfiguredCategory(query, cats = []) {
  if (!Array.isArray(cats) || cats.length === 0) return false;
  const ids = Array.isArray(query?.categories) ? query.categories : [];
  const terms = declaredTerms(query);
  if (terms === null) return false;
  // An unmappable category word is not a faithful description of "all of them".
  if (terms.some(t => typeof t !== 'string' || !cats.some(c => matchesCategory(c, t)))) return false;
  if (ids.length) {
    // Every configured id present, and nothing unknown smuggled in beside them.
    return cats.every(c => ids.includes(c.id)) && ids.every(id => cats.some(c => c.id === id));
  }
  return terms.length > 0 && cats.every(c => terms.some(t => matchesCategory(c, t)));
}

/**
 * The one normalisation step, applied before ordinary-query validation and
 * before bounded-plan step validation. Returns the query unchanged unless
 * every condition above holds, and never mutates its argument.
 */
export function normaliseWholeLedgerCategories(query, cats = [], message = '') {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return query;
  if (!coversEveryConfiguredCategory(query, cats)) return query;
  // A category the user named makes the selection a claim about their request.
  if (mentionedCategories(message, cats).length > 0) return query;

  const next = { ...query, categories: [] };
  // The labels described the filter that is now gone; keeping them would leave
  // metadata claiming a selection the query no longer makes.
  if (Array.isArray(next.category_terms)) next.category_terms = [];
  if (Array.isArray(next.categoryTerms)) next.categoryTerms = [];
  return next;
}
