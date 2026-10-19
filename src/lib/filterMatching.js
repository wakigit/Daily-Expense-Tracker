/** Literal matching shared by explicit filters and reviewed spending rules. */
export const normaliseScopeText = text => String(text ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-SG');
export const matchesAnyCategory = (row, categories) => categories.includes(row.category);
export const matchesAnyDescription = (row, terms) => {
  const description = normaliseScopeText(row.description);
  return terms.some(term => description.includes(normaliseScopeText(term)));
};
