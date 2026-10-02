import StatusChip from '../components/StatusChip';
import { money } from '../lib/format';
import { budgetStatus } from '../lib/status';

/**
 * The Budget tab, as far as phase 2 takes it: the month's standing and where
 * each category sits against its limit, using the same §2 helper as Home so
 * the two can never disagree.
 *
 * Editing still lives in Settings. Phase 3 moves it here along with the
 * "wallpaper reflects my budget" switch.
 */
export default function BudgetView({ totalSpent, totalBudget, cats, budgets, spending, onEdit }) {
  const st = budgetStatus(totalSpent, totalBudget);

  return (
    <>
      <section className="card" style={{ '--i': 0 }}>
        <p className="lbl">This month</p>
        <p className="display money" style={{ fontSize: 28, lineHeight: 1.1, color: 'var(--tx)' }}>
          {money(totalSpent)}
        </p>
        <p className="money" style={{ fontSize: 14, color: 'var(--tx-sub)', marginTop: 2 }}>
          of {money(totalBudget)} budget
        </p>

        <div style={{ marginTop: 14 }}>
          <StatusChip status={st.key} label={st.label} pct={st.pct} showPct={totalBudget > 0} />
        </div>

        {totalBudget > 0 && (
          <p className="money" style={{ fontSize: 14, color: 'var(--tx-sub)', marginTop: 14 }}>
            {st.left >= 0 ? `${money(st.left)} left` : `Over by ${money(st.over)}`}
          </p>
        )}

        <button onClick={onEdit} className="btn-primary btn-block" style={{ marginTop: 16 }}>
          Edit budgets
        </button>
      </section>

      <section className="card" style={{ '--i': 1 }}>
        <p className="lbl">By category</p>
        {cats.map((c) => {
          const spent = spending[c.id] || 0;
          const budget = budgets[c.id] || 0;
          const cs = budgetStatus(spent, budget);
          const over = cs.key === 'over';

          return (
            <div key={c.id} className="cat-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <div className="dot" style={{ width: 10, height: 10, background: c.color }} />
                  <span className="truncate" style={{ fontSize: 14 }}>{c.label}</span>
                </div>
                <span className="money" style={{ fontSize: 12, color: over ? 'var(--st-over)' : 'var(--tx-muted)' }}>
                  {budget > 0 ? `${money(spent)} / ${money(budget)}` : money(spent)}
                </span>
              </div>

              {budget > 0 && (
                <div className="progress-track">
                  <div
                    className={`progress-fill${over ? ' over' : ''}`}
                    style={{ width: `${Math.min(100, cs.pct)}%`, background: over ? 'var(--st-over)' : c.color }}
                  />
                </div>
              )}

              <p style={{ fontSize: 13, color: over ? 'var(--st-over)' : 'var(--tx-muted)', margin: '4px 0 0' }}>
                {budget > 0
                  ? `${cs.label}${over ? ` — ${money(cs.over)} over` : cs.key === 'watch' ? ` — ${money(cs.left)} left` : ''}`
                  : 'No budget set'}
              </p>
            </div>
          );
        })}
      </section>
    </>
  );
}
