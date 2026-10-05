import { useEffect, useRef, useState } from 'react';

/**
 * Chat interface over the spending data.
 *
 * Every figure shown here is computed by lib/stats.js over the real rows,
 * whether the question was understood by the model or by the offline matcher.
 * Nothing on this screen is a number the model produced.
 *
 * Anything that would change data arrives as `pending` and is rendered as a
 * card with the exact values and a Confirm button. Until that is pressed, the
 * expense list has not moved.
 */
export default function AskView({
  messages, onSend, hasData, busy = false, pending = null, onConfirm, onCancel,
}) {
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pending, busy]);

  const send = (text) => {
    const q = (text ?? draft).trim();
    if (!q) return;
    setDraft('');
    onSend(q);
    inputRef.current?.focus();
  };

  return (
    <section className="card ask-card" style={{ '--i': 0 }}>
      <p className="lbl">Ask about your spending</p>

      {messages.length === 0 ? (
        <div className="ask-intro">
          <p className="ask-intro-text">
            {hasData
              ? 'Ask me anything about what you’ve spent.'
              : 'Add a few expenses first, then ask me about them.'}
          </p>
        </div>
      ) : (
        <div className="ask-thread">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.from}`}>
              <p>{m.text}</p>
              {m.detail && <p className="bubble-detail">{m.detail}</p>}
              {/* How the question was read. The model's reporting of what it
                  saw cannot be fully verified here, so the interpretation is
                  put in front of the reader instead of assumed correct. */}
              {m.interpretation && (
                <p className="bubble-interp">
                  Read as: <strong>{m.interpretation.category}</strong> · {m.interpretation.period}
                </p>
              )}
              {m.options?.length > 0 && (
                <div className="bubble-options">
                  {m.options.map((o) => (
                    <button key={o} type="button" className="chip-option" onClick={() => send(o)}>{o}</button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {busy && <div className="bubble bot"><p className="bubble-detail">Thinking…</p></div>}

          {pending && (
            <div className="proposal" role="group" aria-label="Confirm before anything changes">
              {pending.kind === 'confirm_add' ? (
                <>
                  <p className="proposal-cap">New expense</p>
                  <p className="proposal-row money">{pending.summary}</p>
                  {pending.duplicate && (
                    <p className="proposal-warn">
                      Looks like one you already have: {pending.duplicate.summary}
                    </p>
                  )}
                  <div className="proposal-actions">
                    <button type="button" className="btn-primary" onClick={() => onConfirm()}>Add it</button>
                    <button type="button" onClick={onCancel}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="proposal-cap">
                    {pending.candidates.length === 1 ? 'Delete this' : 'Which one?'}
                  </p>
                  {pending.candidates.map((c) => (
                    <button key={c.id} type="button" className="proposal-pick money" onClick={() => onConfirm(c.id)}>
                      {c.summary}
                    </button>
                  ))}
                  <div className="proposal-actions">
                    <button type="button" onClick={onCancel}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}

          <div ref={endRef} />
        </div>
      )}

      <form
        className="ask-form"
        onSubmit={(ev) => { ev.preventDefault(); send(); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          placeholder="How much did I spend this week?"
          aria-label="Ask a question about your spending"
          autoComplete="off"
        />
        <button type="submit" className="btn-primary ask-send" aria-label="Send" disabled={!draft.trim()}>
          ↑
        </button>
      </form>
    </section>
  );
}
