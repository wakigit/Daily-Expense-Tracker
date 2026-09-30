/**
 * The single seam between the app and where its data lives.
 *
 * Right now this is localStorage. When the backend arrives, THIS IS THE ONLY
 * FILE THAT CHANGES — swap the bodies for `fetch()` calls and every view keeps
 * working. That is why the app never touches localStorage directly anywhere else.
 *
 * The functions are async even though localStorage is synchronous, precisely so
 * that swap doesn't ripple outward into every caller later.
 */

const KEYS = {
  expenses: 'ww_exp',
  budgets: 'ww_bud',
  categories: 'ww_cats',
  appName: 'ww_name',
  theme: 'ww_theme',
};

export async function load(key) {
  try {
    const raw = localStorage.getItem(KEYS[key] ?? key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function save(key, value) {
  try {
    localStorage.setItem(KEYS[key] ?? key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private-mode Safari. Failing silently is deliberate:
    // losing a write is better than crashing the app mid-entry.
  }
}

export async function loadAll() {
  const [expenses, budgets, categories, appName, theme] = await Promise.all([
    load('expenses'),
    load('budgets'),
    load('categories'),
    load('appName'),
    load('theme'),
  ]);
  return { expenses, budgets, categories, appName, theme };
}
