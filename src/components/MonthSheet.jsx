import { Fragment } from 'react';
import { money, ymLabel } from '../lib/format';

/** Bottom sheet for jumping to any month that has data. */
export default function MonthSheet({ histByYear, ym, monthTotals, onPick, onClose }) {
  return (
    <div
      className="overlay"
      onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Select month"
    >
      <div className="sheet">
        <div className="handle" />
        <p className="sheet-title">Select month</p>

        {histByYear.map(([year, months]) => (
          <Fragment key={year}>
            <div className="yr-hdr">{year}</div>
            {months.map((m) => {
              const { spent, count } = monthTotals(m);
              const active = ym === m;
              return (
                <div
                  key={m}
                  className={`m-item${active ? ' sel' : ''}`}
                  onClick={() => onPick(m)}
                >
                  <div>
                    <span style={{
                      fontSize: 15,
                      fontWeight: active ? 700 : 400,
                      color: active ? 'var(--accent)' : 'var(--text)',
                    }}>
                      {ymLabel(m)}
                    </span>
                    {count > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {count} {count === 1 ? 'entry' : 'entries'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {spent > 0 && (
                      <span className="money" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sub)' }}>
                        {money(spent)}
                      </span>
                    )}
                    {active && <span style={{ fontSize: 16, color: 'var(--accent)' }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
