import { useEffect, useRef } from 'react';
import VoiceButton from '../components/VoiceButton';
import ReceiptButton from '../components/ReceiptButton';
import { ERR } from '../lib/actions';

/**
 * What to say for each way the form can be wrong.
 *
 * The highlight says WHICH field; this says WHAT about it. One generic line
 * covered both jobs before, and it was wrong as often as it was right: an
 * amount of -3 is highlighted and already filled in, so "please fill in the
 * highlighted fields" told the person to do the one thing they had done.
 *
 * Keyed by the codes `validateExpense` already returns, so the wording lives
 * here in the view and the rule stays in lib/actions.js.
 */
const MESSAGES = {
  [ERR.DESCRIPTION_REQUIRED]: 'Give the expense a description.',
  [ERR.DESCRIPTION_TOO_LONG]: 'That description is too long — shorten it.',
  [ERR.AMOUNT_REQUIRED]: 'Enter how much it cost.',
  [ERR.AMOUNT_INVALID]: "That amount isn't a number.",
  [ERR.AMOUNT_NOT_POSITIVE]: 'The amount has to be more than zero.',
  [ERR.AMOUNT_TOO_LARGE]: 'That amount is too large to record.',
  [ERR.CATEGORY_REQUIRED]: 'Choose a category.',
  [ERR.CATEGORY_UNKNOWN]: 'Choose a category from the list.',
  [ERR.DATE_INVALID]: 'Enter a valid date.',
};

/** Add / edit form. The same view serves both; `editId` decides the wording. */
export default function AddView({
  form, setField, errors, errorCode, cats, editId, today, onSubmit, onCancel, onVoice, onScanned,
}) {
  const descRef = useRef(null);

  // Focus the first field on arrival so you can start typing immediately.
  // The delay lets the tab transition finish first, or iOS ignores the focus.
  useEffect(() => {
    const t = setTimeout(() => descRef.current?.focus(), 160);
    return () => clearTimeout(t);
  }, [editId]);

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <section className="card" style={{ '--i': 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 className="display" style={{ fontSize: '1.3rem', color: 'var(--tx)' }}>
          {editId ? 'Edit expense' : 'New expense'}
        </h2>
        {editId && <button onClick={onCancel} className="cancel-link">Cancel</button>}
      </div>

      {/* Both shortcuts are offered only for new expenses — correcting an
          existing one by speaking or photographing the whole thing again
          would be slower than typing. Scan sits first: it is the one that
          fills every field, so voice is the fallback rather than the
          headline. */}
      {!editId && (
        <>
          <ReceiptButton cats={cats} today={today} onScanned={onScanned} />
          <VoiceButton cats={cats} onParsed={onVoice} />
        </>
      )}

      <div className="field">
        <label htmlFor="f-desc">Description</label>
        <input
          id="f-desc"
          ref={descRef}
          type="text"
          placeholder="e.g. Grab to Orchard"
          value={form.description}
          onChange={setField('description')}
          className={errors.description ? 'err' : ''}
          autoComplete="off"
          autoCorrect="off"
        />
      </div>

      <div className="field">
        <label htmlFor="f-amt">Amount (SGD)</label>
        <input
          id="f-amt"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          min="0"
          step="0.01"
          value={form.amount}
          onChange={setField('amount')}
          className={errors.amount ? 'err' : ''}
        />
      </div>

      <div className="field">
        <label htmlFor="f-cat">Category</label>
        {/* The placeholder exists only while nothing is chosen — the receipt
            scanner clears this field when it could not read a category, and a
            select with no matching value would otherwise display the first
            option as though it had been chosen. */}
        <select
          id="f-cat"
          value={form.category}
          onChange={setField('category')}
          className={errors.category ? 'err' : ''}
        >
          {!form.category && <option value="">Choose a category</option>}
          {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-date">Date</label>
        <input id="f-date" type="date" value={form.date} onChange={setField('date')} />
      </div>

      <div style={{ marginBottom: '1.25rem' }} className="field">
        <label htmlFor="f-notes">Notes (optional)</label>
        <input
          id="f-notes"
          type="text"
          placeholder="e.g. split with friends"
          value={form.notes}
          onChange={setField('notes')}
        />
      </div>

      {hasErrors && (
        <p style={{ fontSize: 12, color: 'var(--st-over)', marginBottom: '0.75rem', textAlign: 'center' }} role="alert">
          {MESSAGES[errorCode] ?? 'Please fill in the highlighted fields'}
        </p>
      )}

      <button onClick={onSubmit} className="btn-primary btn-block">
        {editId ? 'Save changes' : 'Add expense'}
      </button>
    </section>
  );
}
