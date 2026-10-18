/** Call after filtering and sorting the entire selected month. Never pad rows. */
export function recentPreview(filtered, expanded, limit = 5) {
  return { rows: expanded ? filtered : filtered.slice(0, limit), canExpand: filtered.length > limit };
}
