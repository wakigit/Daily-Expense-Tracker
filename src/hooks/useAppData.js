import { useEffect, useState } from 'react';
import { loadAll, save } from '../lib/storage';
import { DEF_CATS, DEFAULT_THEME, isKnownTheme } from '../themes/themes';

/**
 * Owns every piece of persisted state and writes it back on change.
 *
 * `ready` gates the save effects — without it, the first render would write
 * empty defaults over real saved data before the load finished.
 */
export function useAppData() {
  const [ready, setReady] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [cats, setCats] = useState(DEF_CATS);
  const [appName, setAppName] = useState('Expense Tracker');
  const [themeId, setThemeId] = useState(DEFAULT_THEME);
  // 'auto' follows the system Reduce Motion setting; 'on' overrides it.
  const [motion, setMotion] = useState('auto');

  useEffect(() => {
    (async () => {
      const d = await loadAll();
      if (d.expenses) setExpenses(d.expenses);
      if (d.budgets) setBudgets(d.budgets);
      if (d.categories) setCats(d.categories);
      if (d.appName) setAppName(d.appName);
      // A saved id can name a theme this build no longer has — Pink Bow,
      // Midnight and Mahjong Fortune went in the wallpaper redesign. Anyone
      // who had one selected lands on the forest instead of a blank palette.
      if (d.theme && isKnownTheme(d.theme)) setThemeId(d.theme);
      if (d.motion === 'on' || d.motion === 'auto') setMotion(d.motion);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) save('expenses', expenses); }, [expenses, ready]);
  useEffect(() => { if (ready) save('budgets', budgets); }, [budgets, ready]);
  useEffect(() => { if (ready) save('categories', cats); }, [cats, ready]);
  useEffect(() => { if (ready && appName) save('appName', appName); }, [appName, ready]);
  useEffect(() => { if (ready) save('theme', themeId); }, [themeId, ready]);
  useEffect(() => { if (ready) save('motion', motion); }, [motion, ready]);

  return {
    ready,
    expenses, setExpenses,
    budgets, setBudgets,
    cats, setCats,
    appName, setAppName,
    themeId, setThemeId,
    motion, setMotion,
  };
}
