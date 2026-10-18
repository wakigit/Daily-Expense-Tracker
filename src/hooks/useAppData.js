import { useEffect, useState } from 'react';
import { roastPreferences as normaliseRoastPreferences, ROAST_DEFAULTS } from '../lib/roastContract';
import { loadAll, save } from '../lib/storage';
import { DEF_CATS, DEFAULT_THEME, isKnownTheme } from '../themes/themes';

/**
 * Owns every piece of persisted state and writes it back on change.
 *
 * `ready` gates the save effects — without it, the first render would write
 * empty defaults over real saved data before the load finished.
 */
export function useAppData() {
  const [roastPrefs, setRoastPrefs] = useState(ROAST_DEFAULTS);
  const [roastSeed, setRoastSeed] = useState(null);
  const [ready, setReady] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [cats, setCats] = useState(DEF_CATS);
  const [appName, setAppName] = useState('TallyAI');
  const [themeId, setThemeId] = useState(DEFAULT_THEME);
  // 'auto' follows the system Reduce Motion setting; 'on' overrides it.
  const [motion, setMotion] = useState('auto');
  /* What the sample dataset replaced when it was loaded, or null. Persisted
     because "remove the sample data" has to survive a reload to mean
     anything. */
  const [sampleMark, setSampleMark] = useState(null);

  useEffect(() => {
    (async () => {
      const d = await loadAll();
      if (d.expenses) setExpenses(d.expenses);
      if (d.budgets) setBudgets(d.budgets);
      if (d.categories) setCats(d.categories);
      if (d.appName) setAppName(d.appName === 'Expense Tracker' ? 'TallyAI' : d.appName);
      // A saved id can name a theme this build no longer has — Pink Bow,
      // Midnight and Mahjong Fortune went in the wallpaper redesign. Anyone
      // who had one selected lands on the forest instead of a blank palette.
      if (d.theme && isKnownTheme(d.theme)) setThemeId(d.theme);
      if (d.motion === 'on' || d.motion === 'auto') setMotion(d.motion);
      if (d.sampleMark && typeof d.sampleMark === 'object') setSampleMark(d.sampleMark);
      setRoastPrefs(normaliseRoastPreferences(d.roastPreferences));
      setRoastSeed(d.roastCache);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) save('expenses', expenses); }, [expenses, ready]);
  useEffect(() => { if (ready) save('budgets', budgets); }, [budgets, ready]);
  useEffect(() => { if (ready) save('categories', cats); }, [cats, ready]);
  useEffect(() => { if (ready && appName) save('appName', appName); }, [appName, ready]);
  useEffect(() => { if (ready) save('theme', themeId); }, [themeId, ready]);
  useEffect(() => { if (ready) save('motion', motion); }, [motion, ready]);
  useEffect(() => { if (ready) save('sampleMark', sampleMark); }, [sampleMark, ready]);

  useEffect(() => { if (ready) save('roastPreferences', roastPrefs); }, [roastPrefs, ready]);

  return {
    roastPrefs, setRoastPrefs, roastSeed,
    ready,
    expenses, setExpenses,
    budgets, setBudgets,
    cats, setCats,
    appName, setAppName,
    themeId, setThemeId,
    motion, setMotion,
    sampleMark, setSampleMark,
  };
}
