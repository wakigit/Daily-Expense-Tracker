import { useMemo, useState } from 'react';
import { filterAndSort } from '../lib/search';

/**
 * Search + sort state for a list of expenses.
 *
 * Home and the category drill-down both use this, so they stay identical in
 * behaviour. The actual matching lives in lib/search.js as pure functions.
 */
export function useTxnFilter(items, catById) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date');

  const filtered = useMemo(
    () => filterAndSort(items, query, sort, catById),
    [items, query, sort, catById]
  );

  const total = useMemo(
    () => filtered.reduce((s, e) => s + Number(e.amount), 0),
    [filtered]
  );

  return {
    query, setQuery,
    sort, setSort,
    filtered,
    total,
    isFiltering: query.trim().length > 0,
    matchCount: filtered.length,
    sourceCount: items.length,
  };
}
