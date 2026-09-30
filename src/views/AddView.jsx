import { useEffect, useRef } from 'react';
import WorthPicker from '../components/WorthPicker';
import VoiceButton from '../components/VoiceButton';

/** Add / edit form. The same view serves both; `editId` decides the wording. */
export default function AddView({ form, setField, errors, cats, editId, onSubmit, onCancel, onWorth, onVoice }) {
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
        <h2 className="display" style={{ fontSize: '1.3rem', color: 'var(--text)' }}>
          {editId ? 'Edit expense ✏️' : 'New expense 🎀'}
        </h2>
        {editId && <button onClick={onCancel} className="cancel-link">Cancel</button>}
      </div>

      {/* Voice is offered only for new expenses — correcting an existing one
          by speaking the whole thing again would be slower than typing. */}
      {!editId && <VoiceButton cats={cats} onParsed={onVoice} />}

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
        <select id="f-cat" value={form.category} onChange={setField('category')}>
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

      {/* Only when editing: a brand-new expense gets asked via the toast, so
          the add form stays as short as possible. */}
      {editId && (
        <div className="field">
          <label>Was it worth it?</label>
          <WorthPicker value={form.worth} onPick={onWorth} />
        </div>
      )}

      {hasErrors && (
        <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: '0.75rem', textAlign: 'center' }} role="alert">
          Please fill in the highlighted fields 🎀
        </p>
      )}

      <button onClick={onSubmit} className="btn-primary btn-block">
        {editId ? 'Save changes' : 'Add expense'}
      </button>
    </section>
  );
}
