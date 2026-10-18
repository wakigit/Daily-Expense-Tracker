import { useEffect, useRef, useState } from 'react';
import { createRoastSession } from '../lib/roastSession';
import { requestRoast } from '../lib/roastClient';
import { save } from '../lib/storage';

export function useRoaster({ ready, seed, expenses, cats, budgets, preferences, today }) {
  const [card, setCard] = useState(null);
  const [queued, setQueued] = useState(null);
  const session = useRef(null);
  useEffect(() => {
    if (!ready) return;
    session.current = createRoastSession({ seed, request: requestRoast, onChange: setCard, persist: cache => { void save('roastCache', cache); } });
    return () => { session.current?.dispose(); session.current = null; };
  }, [ready]);
  useEffect(() => { session.current?.reconcile(expenses, preferences); }, [ready, expenses, preferences]);
  const latest = useRef(null);
  latest.current = { expenses, preferences };
  const processed = useRef(null);
  useEffect(() => {
    if (!ready || !queued || processed.current === queued) return;
    processed.current = queued;
    // Flush the ledger before any request. Recheck it after the asynchronous seam.
    void save('expenses', expenses).then(saved => {
      const current = latest.current;
      const original = expenses.find(e => e.id === queued.action.id);
      if (saved && current.preferences.enabled && current.expenses.includes(original)) {
        void session.current?.savedResult({ ...queued, expenses: current.expenses }, { cats, budgets, preferences: current.preferences, today });
      }
    });
  }, [ready, queued, expenses, preferences]);
  return { card: preferences.enabled ? card : null, saved: result => { if (result?.ok && result.action?.type === 'add') setQueued(result); }, pause: value => session.current?.setPaused(value), dismiss: () => session.current?.dismiss() };
}
