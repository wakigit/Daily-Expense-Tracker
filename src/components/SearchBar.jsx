const SORTS = [
  { id: 'date', label: 'Newest' },
  { id: 'amount', label: 'Highest' },
  { id: 'amount-asc', label: 'Lowest' },
];

/** Search field + sort cycler for a transaction list. */
export default function SearchBar({ query, onQuery, sort, onSort, matchCount, sourceCount, isFiltering }) {
  const current = SORTS.findIndex((s) => s.id === sort);
  const next = SORTS[(current + 1) % SORTS.length];

  return (
    <div className="search-bar">
      <div className="search-field">
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          value={query}
          onChange={(ev) => onQuery(ev.target.value)}
          placeholder="Search description, notes, amount…"
          aria-label="Search transactions"
          autoComplete="off"
        />
        {isFiltering && (
          <button
            className="search-clear"
            onClick={() => onQuery('')}
            aria-label="Clear search"
          >✕</button>
        )}
      </div>

      <button
        className="sort-btn"
        onClick={() => onSort(next.id)}
        aria-label={`Sort by ${next.label}`}
        title={`Sorted by ${SORTS[current]?.label ?? 'Newest'} — tap for ${next.label}`}
      >
        {SORTS[current]?.label ?? 'Newest'} ⇅
      </button>

      {isFiltering && (
        <p className="search-count">
          {matchCount === 0
            ? 'No matches'
            : `${matchCount} of ${sourceCount} ${sourceCount === 1 ? 'entry' : 'entries'}`}
        </p>
      )}
    </div>
  );
}
