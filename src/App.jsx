import { previewSpendingScope, confirmSpendingScope } from './lib/spendingScope';
import { createAssistantSession, resolveFollowup } from './lib/assistantFollowup';
import { interpretOffline } from './lib/queryOffline';
import { executeQuery } from './lib/queryEngine';
import RoastCard from './components/RoastCard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from './hooks/useAppData';
import { useRoaster } from './hooks/useRoaster';
import { useTheme } from './hooks/useTheme';
import { curYm, shiftYm, today } from './lib/format';
import {
  addExpense, deleteExpenseById, validateExpense, revert, undoLast, pushAction,
} from './lib/actions';
import { sumAmounts, fromCents, toCents } from './lib/money';
import { budgetStatus, decayLevel } from './lib/status';
import { planFromIntent } from './lib/assistant';
import { markOutdatedAnswers } from './lib/answerEvidence';
import { requestIntent, explainIntentFailure } from './lib/assistantClient';
import { mergeReceiptIntoForm } from './lib/receipt';
import { planLoad, planRemove, hasSampleRows, ownRows, sampleLoadNeedsConfirmation } from './lib/sampleState';
import { ymLabel as sampleYmLabel } from './lib/format';

import Header from './components/Header';
import BottomNav from './components/BottomNav';
import MonthSheet from './components/MonthSheet';
import Toast from './components/Toast';

import HomeView from './views/HomeView';
import CategoryView from './views/CategoryView';
import OverviewView from './views/OverviewView';
import AddView from './views/AddView';
import AskView from './views/AskView';
import SettingsView from './views/SettingsView';

/** §4 zone 1: every page but Home shows its name where the month picker sits. */
const PAGE_TITLES = {
  overview: 'Overview',
  add: 'Add expense',
  ask: 'Ask',
  settings: 'Settings',
};

/** Budgets as editable strings; 0 shows as an empty field, not a stubborn 0. */
const toDraft = (budgets) =>
  Object.fromEntries(Object.entries(budgets || {}).map(([id, v]) => [id, v ? String(v) : '']));

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
    roastPrefs, setRoastPrefs, roastSeed,
    expenses, setExpenses,
    budgets, setBudgets,
    cats, setCats,
    appName, setAppName,
    themeId, setThemeId,
    motion, setMotion,
    sampleMark, setSampleMark,
  } = useAppData();

  const roaster = useRoaster({ ready, seed: roastSeed, expenses, cats, budgets, preferences: roastPrefs, today: today() });

  const [ym, setYm] = useState(curYm());
  const [tab, setTab] = useState('home');
  const [catFilter, setCatFilter] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const [form, setForm] = useState(blankForm());
  const [editId, setEditId] = useState(null);
  const [errors, setErrors] = useState({});
  // Which rule the form broke, so AddView can say what is wrong rather than
  // only which box to look at. Cleared everywhere `errors` is.
  const [errCode, setErrCode] = useState(null);

  const [budDraft, setBudDraft] = useState({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [delCatId, setDelCatId] = useState(null);
  const [newCat, setNewCat] = useState({ label: '', color: '#D85A30' });
  const [toast, setToast] = useState(null);
  // Conversation lives here rather than in the view so switching tabs and
  // coming back doesn't wipe the thread.
  const [chat, setChat] = useState([]);
  const sessionRef = useRef(null);
  if (!sessionRef.current) sessionRef.current = createAssistantSession();
  const ledgerRef = useRef(null);
  ledgerRef.current = { expenses, cats, budgets, today: today() };
  useEffect(() => () => sessionRef.current.cancel(), []);
  useEffect(() => {
    setChat((messages) => markOutdatedAnswers(messages, expenses, cats, budgets));
    sessionRef.current.noteLedger(ledgerRef.current);
  }, [expenses, cats, budgets, chat]);
  // Every change to `expenses` is recorded here so it can be reversed. Session
  // state on purpose: undo that outlived a reload would be a surprise.
  const [actionLog, setActionLog] = useState([]);
  // A proposal waiting on Confirm. Nothing in `expenses` moves until it is
  // accepted, so the model can never change data on its own.
  const [scopeProposal, setScopeProposal] = useState(null);
  const [pending, setPending] = useState(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => { setBudDraft(toDraft(budgets)); }, [budgets]);

  // §4: Home gets the masked left-hand gradient so the moon stays bright;
  // every other page gets the flat scrim, because there is no hero to protect.
  useEffect(() => {
    const el = document.getElementById('scrim');
    if (el) el.setAttribute('data-home', String(tab === 'home' && !catFilter));
  }, [tab, catFilter]);

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
    const t = setTimeout(() => setToast(null), toast.kind ? 4600 : 1900);
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
    // Walk months as strings against the Singapore month, so the list does not
    // gain or lose a month depending on the device's timezone.
    const list = [];
    const end = curYm();
    let month = earliest;
    while (month <= end) { list.push(month); month = shiftYm(month, 1); }
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
    return { spent: sumAmounts(ex), count: ex.length };
  };

  /* ── Derived: category drill-down ────────────────────────────── */

  const catItems = useMemo(() => {
    if (!catFilter) return [];
    return expenses
      .filter((e) => e.category === catFilter && e.date.startsWith(ym))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [catFilter, expenses, ym]);

  const catTotal = useMemo(() => sumAmounts(catItems), [catItems]);

  /* ── Derived: current month ──────────────────────────────────── */

  const monthExp = useMemo(
    () => expenses.filter((e) => e.date.startsWith(ym)).sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, ym]
  );

  /* Totals accumulate in integer cents and convert back once, so the
     per-category figures always add up to the headline total exactly. Views
     consume dollars, as they always have. */
  const spendingCents = useMemo(
    () => cats.reduce((acc, c) => {
      acc[c.id] = monthExp
        .filter((e) => e.category === c.id)
        .reduce((cents, e) => cents + toCents(e.amount), 0);
      return acc;
    }, {}),
    [cats, monthExp]
  );

  const spending = useMemo(
    () => Object.fromEntries(Object.entries(spendingCents).map(([id, c]) => [id, fromCents(c)])),
    [spendingCents]
  );

  const totalSpent = fromCents(Object.values(spendingCents).reduce((a, b) => a + b, 0));
  const totalBudget = fromCents(cats.reduce((cents, c) => cents + toCents(budgets[c.id] || 0), 0));
  const remaining = totalBudget - totalSpent;
  const budPct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;
  // Drives the wallpaper. App.jsx deliberately holds no opinion about what
  // "close to limit" or "over" mean — it asks lib/status.js, which is the same
  // helper the chip, the bars and the History screen ask. One set of
  // thresholds, so the scene and the words on top of it cannot disagree.
  // Loops run on Home only.
  const decay = decayLevel(budgetStatus(totalSpent, totalBudget).key);
  useTheme(themeId, { decay, paused: tab !== 'home', motion });

  const chartData = cats
    .filter((c) => spending[c.id] > 0)
    .map((c) => ({ id: c.id, name: c.label, value: spending[c.id], color: c.color }));

  const filteredCat = catFilter ? catById(catFilter) : null;

  /* ── Actions ─────────────────────────────────────────────────── */

  const setField = (key) => (ev) => {
    const { value } = ev.target;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: false }));
    setErrCode(null);
  };

  /**
   * Add and edit both run through lib/actions.js, so the rules the assistant
   * will be held to are the same ones the form is held to.
   *
   * Duplicates are allowed here and only here: someone looking at their own
   * list who types the same kopi twice meant it. The assistant passes
   * rejectDuplicate so it has to ask instead of quietly double-charging.
   */
  const submit = () => {
    if (editId !== null) {
      const checked = validateExpense(form, { cats, today: today(), requireCategory: true });
      if (!checked.ok) {
        setErrors({ [checked.error.field ?? 'description']: true });
        setErrCode(checked.error.code);
        return;
      }
      setErrors({});
      setErrCode(null);
      setExpenses((p) => p.map((e) => (e.id === editId ? { ...checked.value, id: editId } : e)));
      setEditId(null);
      setToast({ message: 'Changes saved' });
    } else {
      // requireCategory, even from the form. The select normally always holds a
      // value, so this changes nothing for typing — but the receipt scanner can
      // now deliberately leave it empty, and without this validateExpense would
      // quietly file the expense under the first category instead of refusing.
      const res = addExpense(expenses, form, {
        cats, today: today(), source: 'manual', requireCategory: true,
      });
      if (!res.ok) {
        setErrors({ [res.error.field ?? 'description']: true });
        setErrCode(res.error.code);
        return;
      }
      setErrors({});
      setErrCode(null);
      setExpenses(res.expenses);
      setActionLog((l) => pushAction(l, res.action));
      setToast({ message: 'Added' });
      roaster.saved(res);
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
    setErrCode(null);
  };

  /**
   * Fills the form from a scanned receipt. Same contract as applyVoice, and
   * deliberately the same merge: the scan omits whatever it could not read, so
   * those fields keep what is already in them — except the two it clears
   * outright, an unknown category and a foreign total. The merge itself lives
   * in lib/receipt.js so it can be tested as the thing it is.
   *
   * This does not submit. A scanned total is a proposal — see ReceiptButton.
   */
  /* Sample data. Both actions are planned in lib/sampleState.js so the rules —
     keep what the person typed, remember what was replaced — are testable
     without a browser. The view does the asking; this does the writing. */
  const loadSample = (confirmed = false) => {
    // Home/Ask shortcuts must not bypass Settings' existing budget confirmation.
    if (confirmed !== true && sampleLoadNeedsConfirmation({ expenses, budgets })) {
      setBudDraft(toDraft(budgets));
      setTab('settings');
      setToast({ message: 'Review sample data in Settings before replacing category budgets.' });
      return;
    }
    const plan = planLoad({ expenses, budgets, cats, mark: sampleMark, todayYmd: today() });
    setExpenses(plan.expenses);
    setCats(plan.categories);
    setBudgets(plan.budgets);
    setBudDraft(Object.fromEntries(plan.categories.map((c) => [c.id, plan.budgets[c.id] ?? ''])));
    setSampleMark(plan.mark);
    setYm(curYm());
    setToast({ message: plan.alreadyLoaded ? 'Sample data is already loaded. Remove it in Settings before loading a new version.' : 'Sample data loaded' });
  };

  const removeSample = () => {
    const plan = planRemove({ expenses, budgets, cats, mark: sampleMark });
    setExpenses(plan.expenses);
    setCats(plan.categories);
    setBudgets(plan.budgets);
    setBudDraft(Object.fromEntries(plan.categories.map((c) => [c.id, plan.budgets[c.id] ?? ''])));
    setSampleMark(null);
    setToast({ message: `Removed ${plan.removed} sample entries` });
  };

  const applyReceipt = (draft) => {
    setForm((f) => mergeReceiptIntoForm(f, draft));
    setErrors({});
    setErrCode(null);
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
    setErrCode(null);
    setForm(blankForm(cats[0]?.id));
    setTab('home');
  };

  /** Delete now, offer Undo. No confirm dialog — see TxnList for why. */
  const deleteExp = (exp) => {
    const res = deleteExpenseById(expenses, exp.id, { source: 'manual' });
    if (!res.ok) return;
    setExpenses(res.expenses);
    setActionLog((l) => pushAction(l, res.action));
    // The toast carries the id of the action it undoes, so tapping Undo
    // reverses that delete even if something else happened in the 4.6s since.
    setToast({ message: 'Entry deleted', kind: 'undo', actionId: res.action.actionId });
  };

  /**
   * Answer a question about the data. Every number comes from lib/stats.js —
   * the arithmetic is exact and matches what the rest of the app shows.
   */
  const say = (msg) => setChat((c) => [...c, msg]);

  const publishAnswer = (plan, meta, ticket, query = null, remember = true) => {
    if (!sessionRef.current.current(ticket)) return;
    const answerId = remember ? sessionRef.current.accept(ticket, query, plan, ledgerRef.current) : null;
    if (remember && !query && (plan.evidence || plan.comparison)) sessionRef.current.failed(ticket, true);
    say({ from: 'bot', ...meta, answerId, text: plan.text, suggestions: plan.suggestions,
      detail: plan.detail, interpretation: plan.interpretation, breakdown: plan.breakdown,
      comparison: plan.comparison, evidence: plan.evidence, budgetEvidence: plan.budgetEvidence,
      outdated: plan.outdated, followup: plan.followup, approvedScope: plan.approvedScope, scopeCategories: plan.approvedScope ? ledgerRef.current.cats.map(c=>({id:c.id,label:c.label})) : null });
  };

  const clearChat = () => {
    sessionRef.current.reset(); setChat([]); setPending(null); setScopeProposal(null); setAsking(false);
  };
  const stopAsking = () => {
    sessionRef.current.cancel(); setScopeProposal(null); setAsking(false);
    say({from:'bot',source:'builtin',text:'Stopped waiting for interpretation. Nothing was changed.'});
  };

  const askQuestion = async (text) => {
    const ticket = sessionRef.current.begin();
    say({ from: 'me', text }); setPending(null); setScopeProposal(null); setAsking(true);
    const followup = resolveFollowup(text, sessionRef.current.getContext(), ledgerRef.current);
    if (followup.handled) {
      setAsking(false);
      if (followup.proposal) { setScopeProposal({ticket,query:followup.query,preview:followup.preview,referenceDate:followup.referenceDate,meta:{source:'builtin'}}); return; }
      if (followup.plan.kind === 'answer') publishAnswer(followup.plan, {source:'builtin'}, ticket, followup.query, !followup.snapshot);
      else say({from:'bot',source:'builtin',text:followup.plan.question,clarificationDraft:text});
      return;
    }
    const res = await requestIntent(text, { ...ledgerRef.current, signal: ticket.signal });
    if (!sessionRef.current.current(ticket)) return;
    if (!res.ok) {
      const ctx = ledgerRef.current;
      const parsed = interpretOffline(text, ctx.cats);
      const reply = parsed.query ? executeQuery(parsed.query, { ...ctx, message: text }) : parsed;
      sessionRef.current.failed(ticket, reply.kind === 'answer' && Boolean(reply.evidence || reply.comparison));
      setAsking(false);
      if (reply.kind === 'answer') publishAnswer({...reply,detail:[explainIntentFailure(res.reason),reply.detail].filter(Boolean).join(' ')}, {source:'offline'}, ticket, parsed.query, !sessionRef.current.getContext());
      else say({from:'bot',source:'offline',text:reply.question ?? reply.text,detail:explainIntentFailure(res.reason),clarificationDraft:text});
      return;
    }
    if (res.intent.type === 'propose_scope') {
      const preview=previewSpendingScope(res.intent.query,ledgerRef.current);
      setAsking(false);
      const meta={source:res.source??'model',endpoint:res.endpoint,httpStatus:res.httpStatus};
      if (!preview.ok) return say({from:'bot',...meta,text:preview.question,clarificationDraft:text});
      say({from:'bot',...meta,text:'Review these proposed literal rules before I calculate related spending. They may not find every related purchase.'});
      setScopeProposal({ticket,query:preview.query,preview,referenceDate:ledgerRef.current.today,meta});
      return;
    }
    const plan = planFromIntent(res.intent, { ...ledgerRef.current, actionLog, message: text });
    setAsking(false);
    const meta = {source:res.source ?? 'model',endpoint:res.endpoint,httpStatus:res.httpStatus};
    if (plan.kind === 'answer') return publishAnswer(plan, meta, ticket, res.intent.type === 'analyze' ? res.intent.query : null);
    if (plan.kind === 'clarify') return say({from:'bot',...meta,text:plan.question,suggestions:plan.options,clarificationDraft:text});

    if (plan.kind === 'undo') {
      const undone = undoLast(expenses, actionLog, { source: 'assistant' });
      setActionLog(undone.log ?? actionLog);
      if (!undone.ok) {
        return say({ from: 'bot', text: undone.error.code === 'expense_modified'
          ? "I can't undo that — you've edited it since, and I'd be throwing your change away."
          : "There's nothing of mine left to undo." });
      }
      setExpenses(undone.expenses);
      return say({ from: 'bot', text: 'Undone.' });
    }

    // confirm_add / confirm_delete — shown, not applied.
    say({ from: 'bot', text: plan.text, plan });
    setPending(plan);
  };

  const reviseScope = (scope) => {
    if (!scopeProposal || !sessionRef.current.current(scopeProposal.ticket)) return;
    const cleaned={...scope,includeTerms:scope.includeTerms.filter(t=>t.trim()),excludeTerms:scope.excludeTerms.filter(t=>t.trim())};
    const preview=previewSpendingScope({...scopeProposal.query,spendingScope:cleaned},{...ledgerRef.current,today:scopeProposal.referenceDate});
    setScopeProposal(p=>preview.ok?{...p,query:preview.query,preview,notice:'Revised preview. Review and approve these rules.'}:{...p,notice:preview.question});
  };
  const approveScope = () => {
    if (!scopeProposal || !sessionRef.current.current(scopeProposal.ticket)) return;
    const result=confirmSpendingScope(scopeProposal,{...ledgerRef.current,today:scopeProposal.referenceDate});
    if (result.kind==='refresh') return setScopeProposal(p=>({...p,preview:result.preview,notice:'Records or categories changed. The preview has refreshed. Review it and approve again.'}));
    if (result.kind==='invalid') return setScopeProposal(p=>({...p,notice:result.question}));
    setScopeProposal(null);
    publishAnswer({...result.plan,referenceDate:scopeProposal.referenceDate},scopeProposal.meta,scopeProposal.ticket,result.query);
  };
  const cancelScope = () => { setScopeProposal(null); say({from:'bot',source:'builtin',text:'Scope cancelled. No related-spending total was calculated and no records were changed.'}); };

  /** Applies a parked proposal. The only path from a model to the data. */
  const confirmPending = (choiceId) => {
    if (!pending) return;

    if (pending.kind === 'confirm_add') {
      const res = addExpense(expenses, pending.expense, {
        cats, today: today(), source: 'assistant', requireCategory: true,
      });
      setPending(null);
      if (!res.ok) return say({ from: 'bot', text: "That didn't go through — nothing was added." });
      setExpenses(res.expenses);
      setActionLog((l) => pushAction(l, res.action));
      roaster.saved(res);
      return say({ from: 'bot', text: roastPrefs.enabled ? 'Added.' : 'Added.' });
    }

    const res = deleteExpenseById(expenses, choiceId, { source: 'assistant' });
    setPending(null);
    if (!res.ok) return say({ from: 'bot', text: "I couldn't find that one any more — nothing was deleted." });
    setExpenses(res.expenses);
    setActionLog((l) => pushAction(l, res.action));
    say({ from: 'bot', text: 'Deleted.' });
  };

  const cancelPending = () => {
    setPending(null);
    say({ from: 'bot', text: 'Left as it was.' });
  };

  const undoDelete = () => {
    // By actionId, not by expense id. Adding a row and then deleting it logs
    // two actions carrying the SAME expense id, and matching on that found the
    // add — reversing which, with the row already gone, failed silently and
    // left Undo looking broken.
    const action = actionLog.find((a) => a.actionId === toast?.actionId);
    const res = revert(expenses, action);
    setActionLog((l) => l.filter((a) => a !== action));
    if (!res.ok) { setToast({ message: 'Nothing to undo' }); return; }
    setExpenses(res.expenses);
    setToast({ message: 'Restored' });
  };

  const addCat = () => {
    if (!newCat.label.trim()) return;
    const id = `cat_${Date.now()}`;
    setCats((p) => [...p, { id, label: newCat.label.trim(), color: newCat.color }]);
    setBudgets((b) => ({ ...b, [id]: 0 }));
    setNewCat({ label: '', color: '#D85A30' });
    setToast({ message: 'Category added' });
  };

  const delCat = (id) => {
    setCats((p) => p.filter((c) => c.id !== id));
    setExpenses((p) => p.filter((e) => e.category !== id));
    setBudgets((b) => { const n = { ...b }; delete n[id]; return n; });
    setDelCatId(null);
    setToast({ message: 'Category deleted' });
  };

  const saveBudgets = () => {
    // An empty field means "no budget", which is zero — but only on save, never
    // while typing.
    setBudgets(Object.fromEntries(
      Object.entries(budDraft).map(([id, v]) => [id, Number(v) || 0])
    ));
    setSavedFlash(true);
    setToast({ message: 'Budgets saved' });
    setTimeout(() => setSavedFlash(false), 1500);
  };

  /**
   * Open Add already pointed at another month. Defaults to the 1st, except for
   * the month in progress, where today is what you almost always mean.
   */
  const addToMonth = (m) => {
    setYm(m);
    setEditId(null);
    setErrors({});
    setErrCode(null);
    setForm({ ...blankForm(cats[0]?.id), date: m === curYm() ? today() : `${m}-01` });
    setCatFilter(null);
    setTab('add');
  };

  const goTo = (t) => {
    if (t !== 'home') setCatFilter(null);
    if (t === 'add' && !editId) { setForm(blankForm(cats[0]?.id)); setErrors({}); }
    if (t === 'settings') setBudDraft(toDraft(budgets));
    setTab(t);
  };

  /* ── Render ──────────────────────────────────────────────────── */

  if (!ready) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--on-scene)',
        fontFamily: "'Caprasimo', Georgia, serif", fontSize: 18,
      }}>
        {appName || 'TallyAI'}
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

      {/* The laptop grid is per-view: Home has a ledger column, the card lists
          fill two equal columns, and the form-like views keep one readable
          measure. Phone ignores this attribute entirely. */}
      <div className="app" data-view={catFilter && tab === 'home' ? 'category' : tab}>
        <h1 className="sr-only">TallyAI</h1>

        <Header
          title={PAGE_TITLES[tab]}
          filteredCat={tab === 'home' ? filteredCat : null}
          onClearFilter={() => setCatFilter(null)}
          ym={ym}
          onOpenPicker={() => setShowPicker(true)}
        />

        {tab === 'home' && catFilter && (
          <CategoryView
            cat={filteredCat}
            ym={ym}
            onChangeMonth={setYm}
            items={catItems}
            total={catTotal}
            {...txnProps}
          />
        )}

        {tab === 'home' && !catFilter && (
          <HomeView
            onChangeMonth={setYm}
            totalSpent={totalSpent}
            totalBudget={totalBudget}
            ym={ym}
            onAddFirst={() => goTo('add')}
            onLoadSample={loadSample}
            onAdd={() => goTo('add')}
            chartData={chartData}
            cats={cats}
            budgets={budgets}
            spending={spending}
            monthExp={monthExp}
            allExpenses={expenses}
            onPickCat={setCatFilter}
            catById={catById}
            {...txnProps}
          />
        )}

        {tab === 'overview' && (
          <OverviewView
            histByYear={histByYear}
            monthTotals={monthTotals}
            ym={ym}
            totalBudget={totalBudget}
            hasExpenses={expenses.length > 0}
            onPickMonth={(m) => { setYm(m); setTab('home'); }}
            onAddToMonth={addToMonth}
          />
        )}

        {tab === 'add' && (
          <AddView
            form={form}
            setField={setField}
            errors={errors}
            errorCode={errCode}
            cats={cats}
            editId={editId}
            today={today()}
            onSubmit={submit}
            onCancel={cancelEdit}
            onVoice={applyVoice}
            onScanned={applyReceipt}
          />
        )}

        {tab === 'ask' && (
          <AskView
            scopeProposal={scopeProposal} cats={cats} onScopeConfirm={approveScope} onScopeCancel={cancelScope} onScopeRevise={reviseScope}
            messages={markOutdatedAnswers(chat, expenses, cats, budgets)}
            onSend={askQuestion}
            onClear={clearChat}
            onStop={stopAsking}
            hasData={expenses.length > 0}
            onLoadSample={loadSample}
            busy={asking}
            pending={pending}
            onConfirm={confirmPending}
            onCancel={cancelPending}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            roastPrefs={roastPrefs}
            onRoastPrefs={setRoastPrefs}
            themeId={themeId}
            onTheme={setThemeId}
            motion={motion}
            onMotion={setMotion}
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
            sample={{
              loaded: hasSampleRows(expenses, sampleMark),
              rowCount: expenses.length - ownRows(expenses).length,
              ownRows: ownRows(expenses).length,
              hasBudgets: Object.keys(budgets).length > 0,
              canRestoreBudgets: !!sampleMark?.previousBudgets && !!sampleMark?.appliedBudgets,
              months: (sampleMark?.months ?? []).map(sampleYmLabel).join(' and '),
              onLoad: () => loadSample(true),
              onRemove: removeSample,
            }}
          />
        )}

      </div>

      <RoastCard roast={tab === 'add' || tab === 'settings' ? null : roaster.card} onDismiss={roaster.dismiss} onPause={roaster.pause} />
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
