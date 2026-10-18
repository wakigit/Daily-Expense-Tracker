import { parseDateSearch } from '../lib/dateSearch';
import { useMemo, useState } from 'react';
import { filterAndSort } from '../lib/search';
import { sumAmounts } from '../lib/money';

/**
 * Search + sort state for a list of expenses.
 *
 * Home and the category drill-down both use this, so they stay identical in
 * behaviour. The actual matching lives in lib/search.js as pure functions.
 */
export function useTxnFilter(items, catById, ym) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date');

  const filtered = useMemo(
    () => filterAndSort(items, query, sort, catById, ym?.slice(0,4)),
    [items, query, sort, catById, ym]
  );

  const total = useMemo(
    () => sumAmounts(filtered),
    [filtered]
  );

  return {
    dateSearch: ym ? parseDateSearch(query, ym.slice(0,4)) : {kind: 'text'},
    query, setQuery,
    sort, setSort,
    filtered,
    total,
    isFiltering: query.trim().length > 0,
    matchCount: filtered.length,
    sourceCount: items.length,
  };
}
