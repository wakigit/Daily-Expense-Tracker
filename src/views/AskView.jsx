import SpendingScopeReview, { SpendingScopeRules } from '../components/SpendingScopeReview';
import { completeQuestionChoices } from '../lib/assistantDialogue';
import { useEffect, useRef, useState } from 'react';
import ComparisonEvidence from '../components/ComparisonEvidence';
import BreakdownEvidence from '../components/BreakdownEvidence';
import AnswerEvidence from '../components/AnswerEvidence';

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
  scopeProposal=null, cats=[], onScopeConfirm, onScopeCancel, onScopeRevise, messages, onSend, hasData, busy = false, pending = null, onConfirm, onCancel, onLoadSample, onClear, onStop}) {
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pending, busy, scopeProposal]);

  const send = (text) => {
    const q = (text ?? draft).trim();
    if (!q) return;
    setDraft('');
    onSend(q);
    inputRef.current?.focus();
  };

  return (
    <section className="card ask-card" style={{ '--i': 0 }}>
      <div className="ask-heading"><p className="lbl">Ask about your spending</p>
        {messages.length > 0 && onClear && <button type="button" className="btn-ghost" onClick={() => {setDraft('');onClear();}}>Clear chat</button>}
      </div>

      {messages.length === 0 ? (
        <div className="ask-intro">
          <p className="ask-intro-text">
            {hasData
              ? 'Ask for recorded totals, complete category/month breakdowns, largest single expenses, transaction filters, weekday patterns, month/week comparisons, or a category budget pace estimate.'
              : 'Add a few expenses first, then ask me about them.'}
          </p>
          {/* hasData is the whole ledger, not the selected month, so this
              only ever appears on a genuinely empty store. */}
          {!hasData && onLoadSample && (
            <button type="button" onClick={onLoadSample} className="btn-ghost" style={{ marginTop: 12 }}>
              Try it with sample data
            </button>
          )}
        </div>
      ) : (
        <div className="ask-thread">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.from}`} data-answer-source={m.source} data-assistant-endpoint={m.endpoint} data-http-status={m.httpStatus}>
              {m.answerId && <p className="evidence-caption">Answer #{m.answerId}</p>}
              {m.followup && <p className="evidence-caption">Based on answer #{m.followup.answerId} · {m.followup.mode === 'snapshot' ? 'Original supporting records' : 'Follow-up calculated locally'}</p>}
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
              {m.clarificationDraft && <button type="button" className="btn-ghost" onClick={() => { setDraft(m.clarificationDraft); inputRef.current?.focus(); }}>Edit original question</button>}
              {completeQuestionChoices(m.suggestions).length>0 && <div className="ask-suggestions" aria-label="Complete follow-up questions">{completeQuestionChoices(m.suggestions).map(question=><button key={question} type="button" className="btn-ghost" onClick={()=>send(question)}>{question}</button>)}</div>}
              {m.approvedScope && <details className="approved-scope"><summary>Approved spending rules: {m.approvedScope.label}</summary><SpendingScopeRules scope={m.approvedScope} cats={m.scopeCategories ?? cats}/></details>}
              <AnswerEvidence evidence={m.evidence} outdated={m.outdated} />
              <BreakdownEvidence breakdown={m.breakdown} outdated={m.outdated} />
              <ComparisonEvidence comparison={m.comparison} outdated={m.outdated} />

            </div>
          ))}

          {busy && <div className="bubble bot"><p className="bubble-detail">Thinking…</p>{onStop && <button type="button" className="btn-ghost" onClick={onStop}>Stop request</button>}</div>}

          {scopeProposal && <SpendingScopeReview key={scopeProposal.ticket.generation} proposal={scopeProposal} cats={cats} onConfirm={onScopeConfirm} onCancel={onScopeCancel} onRevise={onScopeRevise}/>}
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

      <details className="ask-capabilities"><summary>Supported questions and filters</summary><p>Try “Weekdays or weekends this month?”, “Highest average weekday?”, “Compare descriptions mentioning Grab this month with last month”, or “When will my Food budget run out?” Try “Break down descriptions mentioning Amazon by category over the last 90 days” or “Show spending by month this year”. Related concepts with explicit inclusion terms can be proposed for your review and approval before calculation — try “How much did I spend on supper and late-night food this month?” These literal rules do not guarantee every related purchase is found. Matching uses description text, not verified merchant identity. Use one category, a description term, amount condition and a period or ISO date range. Last N days includes today. After a financial answer, try “Break that down by month”, “Show those transactions”, “What about last month?” or “Only purchases over S$20”. Follow-ups refer only to the latest eligible calculation in this chat.</p></details>
      <form
        className="ask-form"
        onSubmit={(ev) => { ev.preventDefault(); send(); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          placeholder="Show Food expenses over S$10 this month"
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
