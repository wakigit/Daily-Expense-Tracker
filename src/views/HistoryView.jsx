import { money, ymLabel, curYm } from '../lib/format';

/** Month-by-month totals, newest year first. */
export default function HistoryView({ histByYear, monthTotals, ym, totalBudget, hasExpenses, onPickMonth }) {
  if (!hasExpenses) {
    return (
      <section className="card empty" style={{ '--i': 0 }}>
        <p className="empty-title">No history yet</p>
        <p className="empty-body">
          Months appear here once you have logged something in them.
        </p>
      </section>
    );
  }

  return histByYear.map(([year, months], yi) => (
    <section key={year} className="card" style={{ '--i': yi }}>
      <p className="lbl">{year}</p>
      {months.map((m, i) => {
        const { spent, count } = monthTotals(m);
        const isCur = m === curYm();
        const isSel = m === ym;
        const pct = totalBudget > 0 ? Math.min(Math.round((spent / totalBudget) * 100), 100) : 0;

        return (
          <div key={m}>
            {i > 0 && <div className="divider" />}
            <div className="hist-row" onClick={() => onPickMonth(m)}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: isSel ? 'var(--accent)' : 'var(--tx)' }}>
                    {ymLabel(m)}
                  </span>
                  {isCur && <span className="pill-now">NOW</span>}
                </div>
                <span style={{ fontSize: 12, color: 'var(--tx-muted)' }}>
                  {count > 0 ? `${count} transaction${count !== 1 ? 's' : ''}` : 'No entries'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="display" style={{ fontSize: '1.05rem', color: spent > 0 ? 'var(--tx)' : 'var(--tx-muted)' }}>
                  {spent > 0 ? money(spent) : '—'}
                </div>
                <span style={{ fontSize: 18, color: 'var(--tx-muted)', lineHeight: 1 }}>›</span>
              </div>
            </div>
            {spent > 0 && totalBudget > 0 && (
              <div className="progress-track" style={{ margin: '0 6px 7px' }}>
                <div
                  className="progress-fill"
                  style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--st-over)' : 'var(--accent)', opacity: 0.6 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </section>
  ));
}
