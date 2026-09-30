import { useEffect, useRef, useState } from 'react';
import { SUGGESTIONS } from '../lib/ask';

/**
 * Chat interface over the spending data.
 *
 * Answers are computed by lib/ask.js + lib/stats.js — real arithmetic over the
 * real rows, never an estimate. Every figure here can be checked against the
 * Home screen and will match exactly.
 */
export default function AskView({ messages, onSend, hasData }) {
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

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
          <span className="empty-emoji">💬</span>
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
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <div className="ask-chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
        ))}
      </div>

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
