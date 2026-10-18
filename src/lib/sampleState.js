/** Pure sample lifecycle. Saved categories are never migrated or overwritten. */
import { buildSample, isSampleRow } from './sampleData';
import { DEF_CATS } from '../themes/themes';

export const emptyMark = () => null;
export const hasSampleRows = (expenses = [], mark = null) => mark?.version === 2 || expenses.some(isSampleRow);
export const ownRows = (expenses = []) => expenses.filter(e => !isSampleRow(e));
export const sampleRows = (expenses = []) => expenses.filter(isSampleRow);
export const sampleLoadNeedsConfirmation = ({ expenses = [], budgets = {} }) => ownRows(expenses).length > 0 || Object.keys(budgets).length > 0;
const labelKey = label => String(label).trim().toLowerCase().replace(/\s+/g, ' ');
const aliases = {
  food: ['food & drinks', 'food and drinks', 'food'],
  entertainment: ['entertainment'], needs: ['daily needs', 'needs'],
  shop: ['shopping'], pub: ['public transport'], hire: ['private hire'],
  misc: ['others', 'miscellaneous'],
};

/** Reuse only clear compatible labels, never an ID whose label means something else. */
export function sampleCategories(cats, reservedIds = []) {
  const categories = cats.map(cat => ({ ...cat }));
  const used = new Set([...categories.map(c => c.id), ...reservedIds]);
  const mapping = {}, introducedCategories = [];
  for (const wanted of DEF_CATS) {
    const compatible = categories.filter(cat => aliases[wanted.id].includes(labelKey(cat.label)));
    let category = compatible.find(cat => cat.id === wanted.id) ?? compatible[0];
    if (!category) {
      let id = wanted.id, suffix = 1;
      while (used.has(id)) id = `sample-${wanted.id}-${suffix++}`;
      used.add(id);
      category = { ...wanted, id };
      categories.push(category);
      introducedCategories.push({ ...category });
    }
    mapping[wanted.id] = category.id;
  }
  return { categories, mapping, introducedCategories };
}

/** Existing sample sets are left as-is until explicit removal/reload, including legacy sets. */
export function planLoad({ expenses = [], budgets = {}, cats = DEF_CATS, mark = null, todayYmd }) {
  if (hasSampleRows(expenses, mark)) return { expenses, budgets, categories: cats, mark, replacedBudgets: false, keptRows: ownRows(expenses).length, alreadyLoaded: true };
  const sample = buildSample(todayYmd);
  const resolved = sampleCategories(cats, [...Object.keys(budgets), ...expenses.map(e => e.category)]);
  const mappedBudgets = Object.fromEntries(Object.entries(sample.budgets).map(([id, value]) => [resolved.mapping[id], value]));
  // Other custom-category budgets are preserved. Sample budgets never use personal spending.
  const appliedBudgets = { ...budgets, ...mappedBudgets };
  return {
    expenses: [...expenses, ...sample.expenses.map(row => ({ ...row, category: resolved.mapping[row.category] }))],
    budgets: appliedBudgets,
    categories: resolved.categories,
    mark: {
      version: 2, loadedAt: new Date().toISOString(), todayYmd, months: sample.months,
      rowCount: sample.expenses.length, previousBudgets: { ...budgets }, appliedBudgets: { ...appliedBudgets },
      introducedCategories: resolved.introducedCategories,
    },
    replacedBudgets: Object.keys(mappedBudgets).some(id => Object.hasOwn(budgets, id)),
    keptRows: expenses.length,
  };
}

/** Restore only unchanged sample budgets. Missing legacy snapshots mean leave them alone. */
export function planRemove({ expenses = [], budgets = {}, cats = DEF_CATS, mark }) {
  const remaining = ownRows(expenses);
  const canRestore = !!mark?.previousBudgets && !!mark?.appliedBudgets;
  const nextBudgets = canRestore ? { ...mark.previousBudgets } : { ...budgets };
  if (canRestore) {
    for (const key of new Set([...Object.keys(mark.appliedBudgets), ...Object.keys(budgets)])) {
      if (Object.hasOwn(budgets, key) === Object.hasOwn(mark.appliedBudgets, key)
          && budgets[key] === mark.appliedBudgets[key]) continue;
      if (Object.hasOwn(budgets, key)) nextBudgets[key] = budgets[key];
      else delete nextBudgets[key];
    }
  }
  const introduced = mark?.version === 2 && Array.isArray(mark.introducedCategories) ? mark.introducedCategories : [];
  const categories = cats.filter(category => {
    const snapshot = introduced.find(c => c.id === category.id);
    if (!canRestore || !snapshot || JSON.stringify(snapshot) !== JSON.stringify(category) || remaining.some(row => row.category === category.id)) return true;
    // A later positive/changed budget is also intentional use of this category.
    const budgetChanged = canRestore && Object.hasOwn(budgets, category.id) && budgets[category.id] !== mark.appliedBudgets[category.id];
    if (budgetChanged) return true;
    delete nextBudgets[category.id];
    return false;
  });
  return { expenses: remaining, budgets: nextBudgets, categories, restoredBudgets: canRestore, removed: sampleRows(expenses).length };
}
