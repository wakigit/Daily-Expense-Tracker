import { money, ymLabel, curYm } from '../lib/format';
import { budgetStatus } from '../lib/status';

/**
 * Every month you have logged anything in, newest first.
 *
 * This was called History and behaved like an archive — the rows navigated, but
 * nothing said so, which is why it read as view-only. Each row now says it is a
 * way in: a chevron, a "Viewing" marker on the month in focus, and an explicit
 * Add action so an expense can be filed against a past month without first
 * switching month and then fixing the date by hand.
 */
export default function OverviewView({
  histByYear, monthTotals, ym, totalBudget, hasExpenses, onPickMonth, onAddToMonth,
}) {
  if (!hasExpenses) {
    return (
      <section className="card empty" style={{ '--i': 0 }}>
        <p className="empty-title">Nothing to show yet</p>
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
        const st = budgetStatus(spent, totalBudget);

        return (
          <div key={m}>
            {i > 0 && <div className="divider" />}

            <button
              className={`hist-row${isSel ? ' sel' : ''}`}
              onClick={() => onPickMonth(m)}
              aria-label={`Open ${ymLabel(m)}`}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: isSel ? 'var(--accent)' : 'var(--tx)' }}>
                    {ymLabel(m)}
                  </span>
                  {isCur && <span className="pill-now">NOW</span>}
                  {isSel && !isCur && <span className="pill-now">VIEWING</span>}
                </div>
                <span style={{ fontSize: 13, color: 'var(--tx-muted)' }}>
                  {count > 0 ? `${count} transaction${count !== 1 ? 's' : ''}` : 'No entries'}
                  {spent > 0 && totalBudget > 0 && ` · ${st.label}`}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span className="display money" style={{ fontSize: '1.05rem', color: spent > 0 ? 'var(--tx)' : 'var(--tx-muted)' }}>
                  {spent > 0 ? money(spent) : '—'}
                </span>
                <span style={{ fontSize: 18, color: 'var(--tx-muted)', lineHeight: 1 }}>›</span>
              </div>
            </button>

            {spent > 0 && totalBudget > 0 && (
              <div className="progress-track" style={{ margin: '0 6px 7px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, st.pct)}%`,
                    background: st.key === 'over' ? 'var(--st-over)' : 'var(--accent)',
                    opacity: 0.6,
                  }}
                />
              </div>
            )}

            <button className="row-add" onClick={() => onAddToMonth(m)}>
              + Add to {ymLabel(m).split(' ')[0]}
            </button>
          </div>
        );
      })}
    </section>
  ));
}
