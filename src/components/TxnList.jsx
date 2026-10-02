import { useState } from 'react';
import SwipeRow from './SwipeRow';
import { money, dayLabel } from '../lib/format';
import Icon from './Icon';

/**
 * Transaction rows with swipe-to-delete.
 *
 * There is no "are you sure?" step any more: deletion is instant and the
 * toast offers Undo. That's strictly better than a confirm dialog — it costs
 * zero taps in the common case (you meant it) and still recovers the rare
 * mistake. The trash button stays as the keyboard/desktop path to the same
 * action, since a swipe is unreachable without a pointer.
 */
export default function TxnList({ items, catById, onDelete, onEdit }) {
  const [openId, setOpenId] = useState(null);

  return items.map((exp) => {
    const cat = catById(exp.category);
    const color = cat?.color || '#888';

    return (
      <SwipeRow
        key={exp.id}
        open={openId === exp.id}
        onOpenChange={(next) => setOpenId(next ? exp.id : null)}
        onDelete={() => { setOpenId(null); onDelete(exp); }}
      >
        <div className="txn-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div className="txn-dot" style={{ background: `${color}28` }}>
              <div className="dot" style={{ width: 12, height: 12, background: color }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p className="truncate" style={{ fontSize: 14, fontWeight: 600 }}>{exp.description}</p>
              <p style={{ fontSize: 11, color: 'var(--tx-muted)', margin: '2px 0 0' }}>
                {dayLabel(exp.date)}
                {exp.notes && <span style={{ color: 'var(--tx-muted)' }}> · {exp.notes}</span>}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 8 }}>
            <span className="money" style={{ fontSize: 14, fontWeight: 700, marginRight: 2 }}>
              {money(exp.amount)}
            </span>
            <button
              onClick={() => onEdit(exp)}
              className="icon-btn"
              aria-label={`Edit ${exp.description}`}
            ><Icon name="edit" size={16} /></button>
            <button
              onClick={() => onDelete(exp)}
              className="icon-btn"
              aria-label={`Delete ${exp.description}`}
            ><Icon name="trash" size={16} /></button>
          </div>
        </div>
      </SwipeRow>
    );
  });
}
