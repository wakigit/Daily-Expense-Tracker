import { buildRoastInput, offlineRoast, roastFingerprint } from './roastFacts';
import { roastPreferences, validateRoastInput, validateRoastOutput } from './roastContract';

export const ROAST_VISIBLE_MS = 8000;
/** This sidecar never writes the ledger. Timer dependencies permit exact clock tests. */
export function createRoastSession({ seed = {}, request, onChange = () => {}, persist = () => {}, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  seed = seed && typeof seed === 'object' ? seed : {};
  let entries = Array.isArray(seed.entries) ? seed.entries.slice(-30).filter(e => e && typeof e.id === 'string' && typeof e.fingerprint === 'string' && validateRoastInput(e.input).ok) : [];
  // Keep paid-attempt caches, including old/invalid output, but never replay a popup on reload.
  entries = entries.map(e => e.status === 'loading' || !validateRoastOutput({ text: e.text }, e.input).ok ? { ...e, status: 'done', source: 'offline', text: offlineRoast(e.input) } : e);
  let activeId = null;
  let angleIndex = Number.isSafeInteger(seed.angleIndex) && seed.angleIndex >= 0 ? seed.angleIndex : 0;
  let enabled = false, generation = 0, pending = null;
  let timer = null, remaining = ROAST_VISIBLE_MS, started = null, paused = false;
  const current = () => enabled ? entries.find(e => e.id === activeId) ?? null : null;
  const emit = () => {
    entries = entries.slice(-30);
    persist({ entries, activeId, angleIndex });
    const visible = current();
    onChange(visible ? { ...visible } : null);
  };
  const stopTimer = () => { if (timer !== null) clearTimer(timer); timer = null; started = null; };
  const cancel = () => { generation++; pending?.abort(); pending = null; stopTimer(); };
  const dismiss = () => { activeId = null; cancel(); emit(); };
  const armTimer = () => {
    if (paused || current()?.status !== 'done') return;
    started = now();
    timer = setTimer(dismiss, remaining);
    timer?.unref?.();
  };
  return {
    reconcile(expenses, preferences) {
      enabled = roastPreferences(preferences).enabled;
      const byId = new Map(expenses.map(e => [String(e.id), e]));
      entries = entries.filter(e => byId.has(e.id) && roastFingerprint(byId.get(e.id)) === e.fingerprint);
      if (!enabled || !entries.some(e => e.id === activeId)) { activeId = null; cancel(); }
      emit();
    },
    dismiss,
    setPaused(value) {
      if (paused === value) return;
      if (value && started !== null) remaining = Math.max(0, remaining - (now() - started));
      paused = value;
      stopTimer();
      if (!paused) armTimer();
    },
    dispose() { cancel(); },
    getCurrent: current,
    async savedResult(result, context) {
      if (!enabled || !result?.ok || result.action?.type !== 'add') return;
      const row = result.expenses.find(e => e.id === result.action.id);
      if (!row) return;
      const id = String(row.id);
      if (entries.some(e => e.id === id)) return; // No replay, paid request or replacement by an older cached purchase.
      cancel();
      remaining = ROAST_VISIBLE_MS;
      const ticket = generation;
      const input = buildRoastInput(row, { ...context, expenses: result.expenses, angleIndex: angleIndex++ });
      const entry = { id, fingerprint: roastFingerprint(row), input, description: row.description, amount: row.amount, status: 'loading', source: 'ai', text: '' };
      entries.push(entry);
      activeId = id;
      pending = new AbortController();
      emit();
      let reply;
      try { reply = await request(input, { signal: pending.signal }); } catch { reply = { ok: false }; }
      if (ticket !== generation || !enabled || !entries.includes(entry)) return;
      const checked = reply?.ok ? validateRoastOutput({ text: reply.text }, input) : { ok: false };
      Object.assign(entry, { status: 'done', source: checked.ok ? 'ai' : 'offline', text: checked.ok ? checked.text : offlineRoast(input) });
      pending = null;
      remaining = ROAST_VISIBLE_MS;
      armTimer();
      emit();
    },
  };
}
