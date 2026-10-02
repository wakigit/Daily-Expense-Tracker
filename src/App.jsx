import { useEffect, useMemo, useState } from 'react';
import { useAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';
import { curYm, shiftYm, today } from './lib/format';
import { answer } from './lib/ask';

import Header from './components/Header';
import BottomNav from './components/BottomNav';
import MonthSheet from './components/MonthSheet';
import Toast from './components/Toast';

import HomeView from './views/HomeView';
import CategoryView from './views/CategoryView';
import HistoryView from './views/HistoryView';
import AddView from './views/AddView';
import AskView from './views/AskView';
import SettingsView from './views/SettingsView';

const blankForm = (catId) => ({
  date: today(),
  category: catId || 'food',
  description: '',
  amount: '',
  notes: '',
});

export default function App() {
  const {
    ready,
    expenses, setExpenses,
    budgets, setBudgets,
    cats, setCats,
    appName, setAppName,
    themeId, setThemeId,
  } = useAppData();

  const [ym, setYm] = useState(curYm());
  const [tab, setTab] = useState('home');
  const [catFilter, setCatFilter] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const [form, setForm] = useState(blankForm());
  const [editId, setEditId] = useState(null);
  const [errors, setErrors] = useState({});

  const [budDraft, setBudDraft] = useState({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [delCatId, setDelCatId] = useState(null);
  const [newCat, setNewCat] = useState({ label: '', color: '#D85A30' });
  const [toast, setToast] = useState(null);
  // Conversation lives here rather than in the view so switching tabs and
  // coming back doesn't wipe the thread.
  const [chat, setChat] = useState([]);
  // Holds the last deleted expense so the toast can put it back.
  const [undoExp, setUndoExp] = useState(null);

  useEffect(() => { setBudDraft(budgets); }, [budgets]);

  // Tabs have very different heights — Settings is long, Home is short. Without
  // this, leaving a scrolled-down Settings for Home drops you into blank space
  // below all the content, looking like the app rendered nothing.
  useEffect(() => { window.scrollTo(0, 0); }, [tab, catFilter]);

  // An undoable toast stays longer — 1.9s isn't enough time to read it,
  // decide, and reach the button.
  // Toasts offering a choice stay longer — 1.9s isn't enough time to read
  // them, decide, and reach the button.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => { setToast(null); setUndoExp(null); }, toast.kind ? 4600 : 1900);
    return () => clearTimeout(t);
  }, [toast]);

  const catById = (id) => cats.find((c) => c.id === id);

  /* ── Derived: months ─────────────────────────────────────────── */

  const monthList = useMemo(() => {
    const cur = curYm();
    if (!expenses.length) return [cur];
    // Defensive: a row without a date would throw here and white-screen the
    // whole app. Can't happen through the UI, but localStorage can be edited.
    const dated = expenses.filter((e) => typeof e?.date === 'string');
    if (!dated.length) return [cur];
    const earliest = dated.map((e) => e.date.slice(0, 7)).sort()[0];
    const [ey, em] = earliest.split('-').map(Number);
    const list = [];
    let d = new Date(ey, em - 1);
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth());
    while (d <= end) {
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d = new Date(d.getFullYear(), d.getMonth() + 1);
    }
    return list.reverse();
  }, [expenses]);

  const histByYear = useMemo(() => {
    const g = {};
    monthList.forEach((m) => {
      const y = m.slice(0, 4);
      (g[y] = g[y] || []).push(m);
    });
    return Object.entries(g).sort(([a], [b]) => b - a);
  }, [monthList]);

  const monthTotals = (m) => {
    const ex = expenses.filter((e) => e.date.startsWith(m));
    return { spent: ex.reduce((s, e) => s + Number(e.amount), 0), count: ex.length };
  };

  /* ── Derived: category drill-down ────────────────────────────── */

  const catItems = useMemo(() => {
    if (!catFilter) return [];
    return expenses
      .filter((e) => e.category === catFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [catFilter, expenses]);

  const catTotal = useMemo(() => catItems.reduce((s, e) => s + Number(e.amount), 0), [catItems]);

  const catByMonth = useMemo(() => {
    const g = {};
    catItems.forEach((exp) => {
      const m = exp.date.slice(0, 7);
      (g[m] = g[m] || []).push(exp);
    });
    return Object.entries(g).sort(([a], [b]) => b.localeCompare(a));
  }, [catItems]);

  /* ── Derived: current month ──────────────────────────────────── */

  const monthExp = useMemo(
    () => expenses.filter((e) => e.date.startsWith(ym)).sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, ym]
  );

  const spending = useMemo(
    () => cats.reduce((acc, c) => {
      acc[c.id] = monthExp
        .filter((e) => e.category === c.id)
        .reduce((s, e) => s + Number(e.amount), 0);
      return acc;
    }, {}),
    [cats, monthExp]
  );

  const totalSpent = Object.values(spending).reduce((a, b) => a + b, 0);
  const totalBudget = cats.reduce((s, c) => s + (budgets[c.id] || 0), 0);
  const remaining = totalBudget - totalSpent;
  const budPct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;
  const isOver = totalSpent > totalBudget && totalBudget > 0;

  // Drives the wallpaper. The scene reads one boolean — `isOver` is false
  // when no budget is set, so someone who never sets one keeps a calm scene
  // rather than being handed a permanently bleak app. Loops run on Home only.
  useTheme(themeId, { isOver, paused: tab !== 'home' });

  const chartData = cats
    .filter((c) => spending[c.id] > 0)
    .map((c) => ({ id: c.id, name: c.label, value: spending[c.id], color: c.color }));

  const filteredCat = catFilter ? catById(catFilter) : null;

  /* ── Actions ─────────────────────────────────────────────────── */

  const setField = (key) => (ev) => {
    const { value } = ev.target;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: false }));
  };

  const submit = () => {
    const errs = {};
    if (!form.description.trim()) errs.description = true;
    if (!form.amount) errs.amount = true;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    const entry = { ...form, amount: parseFloat(form.amount) };
    if (editId !== null) {
      setExpenses((p) => p.map((e) => (e.id === editId ? { ...entry, id: editId } : e)));
      setEditId(null);
      setToast({ message: 'Changes saved ✓' });
    } else {
      setExpenses((p) => [...p, { ...entry, id: Date.now() }]);
      setToast({ message: 'Added ✓' });
    }
    setForm(blankForm(cats[0]?.id));
    setTab('home');
  };

  /**
   * Fills the form from a spoken sentence. Only the fields speech actually
   * resolved are overwritten — whatever it couldn't hear is left as-is rather
   * than blanked, so a second attempt adds to the first instead of resetting it.
   */
  const applyVoice = (fields) => {
    setForm((f) => ({ ...f, ...fields }));
    setErrors({});
  };

  const startEdit = (exp) => {
    setForm({
      date: exp.date,
      category: exp.category,
      description: exp.description,
      amount: String(exp.amount),
      notes: exp.notes || '',
    });
    setEditId(exp.id);
    setTab('add');
  };

  const cancelEdit = () => {
    setEditId(null);
    setErrors({});
    setForm(blankForm(cats[0]?.id));
    setTab('home');
  };

  /** Delete now, offer Undo. No confirm dialog — see TxnList for why. */
  const deleteExp = (exp) => {
    setExpenses((p) => p.filter((e) => e.id !== exp.id));
    setUndoExp(exp);
    setToast({ message: 'Entry deleted', kind: 'undo' });
  };

  /**
   * Answer a question about the data. Every number comes from lib/stats.js —
   * the arithmetic is exact and matches what the rest of the app shows.
   */
  const askQuestion = (text) => {
    const reply = answer(text, { expenses, cats });
    setChat((c) => [
      ...c,
      { from: 'me', text },
      { from: 'bot', text: reply.text, detail: reply.detail },
    ]);
  };

  const undoDelete = () => {
    if (!undoExp) return;
    setExpenses((p) => [...p, undoExp]);
    setUndoExp(null);
    setToast({ message: 'Restored ✓' });
  };

  const addCat = () => {
    if (!newCat.label.trim()) return;
    const id = `cat_${Date.now()}`;
    setCats((p) => [...p, { id, label: newCat.label.trim(), color: newCat.color }]);
    setBudgets((b) => ({ ...b, [id]: 0 }));
    setNewCat({ label: '', color: '#D85A30' });
    setToast({ message: 'Category added 🎀' });
  };

  const delCat = (id) => {
    setCats((p) => p.filter((c) => c.id !== id));
    setExpenses((p) => p.filter((e) => e.category !== id));
    setBudgets((b) => { const n = { ...b }; delete n[id]; return n; });
    setDelCatId(null);
    setToast({ message: 'Category deleted' });
  };

  const saveBudgets = () => {
    setBudgets(budDraft);
    setSavedFlash(true);
    setToast({ message: 'Budgets saved 💰' });
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const goTo = (t) => {
    if (t !== 'home') setCatFilter(null);
    if (t === 'add' && !editId) { setForm(blankForm(cats[0]?.id)); setErrors({}); }
    if (t === 'settings') setBudDraft({ ...budgets });
    setTab(t);
  };

  /* ── Render ──────────────────────────────────────────────────── */

  if (!ready) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--on-wallpaper)',
        fontFamily: "'Caprasimo', cursive", fontSize: 18,
      }}>
        {appName || 'Expense Tracker'} 🎀
      </div>
    );
  }

  const txnProps = { catById, onDelete: deleteExp, onEdit: startEdit };

  return (
    <>
      {showPicker && (
        <MonthSheet
          histByYear={histByYear}
          ym={ym}
          monthTotals={monthTotals}
          onPick={(m) => { setYm(m); setShowPicker(false); setTab('home'); }}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div className="app">
        <h1 className="sr-only">Expense Tracker</h1>

        <Header
          appName={appName}
          filteredCat={tab === 'home' ? filteredCat : null}
          onClearFilter={() => setCatFilter(null)}
          ym={ym}
          onShiftMonth={(dir) => setYm((cur) => shiftYm(cur, dir))}
          onOpenPicker={() => setShowPicker(true)}
        />

        {tab === 'home' && catFilter && (
          <CategoryView
            cat={filteredCat}
            items={catItems}
            total={catTotal}
            byMonth={catByMonth}
            {...txnProps}
          />
        )}

        {tab === 'home' && !catFilter && (
          <HomeView
            totalSpent={totalSpent}
            totalBudget={totalBudget}
            remaining={remaining}
            budPct={budPct}
            isOver={isOver}
            chartData={chartData}
            cats={cats}
            budgets={budgets}
            spending={spending}
            monthExp={monthExp}
            onPickCat={setCatFilter}
            catById={catById}
            {...txnProps}
          />
        )}

        {tab === 'history' && (
          <HistoryView
            histByYear={histByYear}
            monthTotals={monthTotals}
            ym={ym}
            totalBudget={totalBudget}
            hasExpenses={expenses.length > 0}
            onPickMonth={(m) => { setYm(m); setTab('home'); }}
          />
        )}

        {tab === 'add' && (
          <AddView
            form={form}
            setField={setField}
            errors={errors}
            cats={cats}
            editId={editId}
            onSubmit={submit}
            onCancel={cancelEdit}
            onVoice={applyVoice}
          />
        )}

        {tab === 'ask' && (
          <AskView messages={chat} onSend={askQuestion} hasData={expenses.length > 0} />
        )}

        {tab === 'settings' && (
          <SettingsView
            themeId={themeId}
            onTheme={setThemeId}
            appName={appName}
            onAppName={setAppName}
            cats={cats}
            budDraft={budDraft}
            onBudDraft={(id, val) => setBudDraft((b) => ({ ...b, [id]: val }))}
            onSaveBudgets={saveBudgets}
            saved={savedFlash}
            delCatId={delCatId}
            onAskDelCat={setDelCatId}
            onDelCat={delCat}
            newCat={newCat}
            onNewCat={setNewCat}
            onAddCat={addCat}
          />
        )}

        <p className="footer-credit">made by @wakii___</p>
      </div>

      <BottomNav tab={tab} onGo={goTo} />
      <Toast
        message={toast?.message}
        actions={
          toast?.kind === 'undo'
            ? [{ key: 'undo', label: 'Undo', onClick: undoDelete }]
            : []
        }
      />
    </>
  );
}
