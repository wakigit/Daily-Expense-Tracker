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
  motion: 'ww_motion',
  // What the sample dataset replaced, so removing it can put that back.
  sampleMark: 'ww_sample',
  roastPreferences: 'ww_roast_preferences',
  roastCache: 'ww_roast_cache',
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
    return true;
  } catch {
    // Quota exceeded or private-mode Safari. Failing silently is deliberate:
    // losing a write is better than crashing the app mid-entry.
    return false;
  }
}

export async function loadAll() {
  const [expenses, budgets, categories, appName, theme, motion, sampleMark, roastPreferences, roastCache] = await Promise.all([
    load('expenses'),
    load('budgets'),
    load('categories'),
    load('appName'),
    load('theme'),
    load('motion'),
    load('sampleMark'),
    load('roastPreferences'),
    load('roastCache'),
  ]);
  return { expenses, budgets, categories, appName, theme, motion, sampleMark, roastPreferences, roastCache };
}
