import Donut from '../components/Donut';
import TxnList from '../components/TxnList';
import SearchBar from '../components/SearchBar';
import StatusChip from '../components/StatusChip';
import { money, ymLabel, today } from '../lib/format';
import { budgetStatus } from '../lib/status';
import { useCountUp } from '../hooks/useCountUp';
import { useTxnFilter } from '../hooks/useTxnFilter';

// Below this many rows a search box is clutter, not help.
const SEARCH_THRESHOLD = 6;

/**
 * Days still to come in the selected month. A past month has none, so the
 * per-day pace line is suppressed rather than dividing by zero.
 */
function daysLeftIn(ym, now = new Date()) {
  const ymd = today(now);
  if (ym !== ymd.slice(0, 7)) return 0;
  const [y, m, d] = ymd.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return daysInMonth - d + 1;
}

export default function HomeView({
  totalSpent, totalBudget, chartData, cats, budgets, spending, monthExp, ym,
  onPickCat, catById, onDelete, onEdit, onAddFirst,
}) {
  const shownTotal = useCountUp(totalSpent);
  const f = useTxnFilter(monthExp, catById);
  const st = budgetStatus(totalSpent, totalBudget);
  const daysLeft = daysLeftIn(ym);
  const monthName = ymLabel(ym).split(' ')[0];

  // §4: the bar is a bar, so it clamps — but the chip reports the true figure.
  const barWidth = Math.min(100, st.pct);

  return (
    <>
      {/* ── Hero: zone 2 of §4. Lives on the scene, not in a card. ── */}
      <section className="hero" aria-label={`${monthName} summary`}>
        <p className="hero-cap">Spent in {monthName}</p>
        <p className="display hero-amount money">{money(shownTotal)}</p>
        <p className="hero-of money">of {money(totalBudget)} budget</p>

        <StatusChip status={st.key} label={st.label} pct={st.pct} showPct={totalBudget > 0} />

        {totalBudget > 0 && (
          <div className="hero-bar">
            <div className={`hero-bar-fill ${st.key}`} style={{ width: `${barWidth}%` }} />
            <div className="hero-tick" />
          </div>
        )}

        {totalBudget > 0 && (
          <>
            <p className="hero-left money">
              {st.left >= 0 ? `${money(st.left)} left this month` : `${money(st.over)} over budget`}
            </p>
            {daysLeft > 0 && (
              <p className="hero-pace money">
                {st.left > 0
                  ? `About ${money(st.left / daysLeft)} a day for the last ${daysLeft} days`
                  : `Nothing left for the last ${daysLeft} days`}
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Cards: zone 4, starting below the focal band. ── */}
      {monthExp.length === 0 ? (
        <section className="card" style={{ '--i': 0 }}>
          <p className="empty-title">Nothing logged for {monthName} yet</p>
          <p className="empty-body">
            Add what you spend as you go and this page fills in.
          </p>
          <button onClick={onAddFirst} className="btn-primary btn-block" style={{ marginTop: 16 }}>
            Add your first expense
          </button>
        </section>
      ) : (
        <section className="card" style={{ '--i': 0 }}>
          <p className="lbl">Where it went</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Donut data={chartData} total={totalSpent} onSlice={onPickCat} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {chartData.slice(0, 4).map((item) => (
                <div key={item.id} className="legend-row" onClick={() => onPickCat(item.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <div className="dot" style={{ width: 9, height: 9, background: item.color }} />
                    <span className="truncate" style={{ fontSize: 13, color: 'var(--tx-sub)' }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span className="money" style={{ fontSize: 13, fontWeight: 700 }}>{money(item.value)}</span>
                    <span style={{ fontSize: 12, color: 'var(--tx-muted)' }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Budgets ── */}
      <section className="card" style={{ '--i': 1 }}>
        <p className="lbl">Budget by category — tap to view ›</p>
        {cats.map((c) => {
          const spent = spending[c.id] || 0;
          const budget = budgets[c.id] || 0;
          const cs = budgetStatus(spent, budget);
          const over = cs.key === 'over';

          return (
            <div key={c.id} className="cat-row" onClick={() => onPickCat(c.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <div className="dot" style={{ width: 10, height: 10, background: c.color }} />
                  <span className="truncate" style={{ fontSize: 14 }}>{c.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className="money" style={{ fontSize: 12, color: over ? 'var(--st-over)' : 'var(--tx-muted)' }}>
                    {budget > 0 ? `${money(spent)} / ${money(budget)}` : money(spent)}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--tx-muted)' }}>›</span>
                </div>
              </div>
              {budget > 0 ? (
                <div className="progress-track">
                  <div
                    className={`progress-fill${over ? ' over' : ''}`}
                    style={{ width: `${Math.min(100, cs.pct)}%`, background: over ? 'var(--st-over)' : c.color }}
                  />
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--tx-muted)', margin: '2px 0 0' }}>
                  No budget set
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* ── Recent ── */}
      {monthExp.length > 0 && (
        <section className="card" style={{ '--i': 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p className="lbl">Recent</p>
            {f.isFiltering && (
              <p className="lbl money" style={{ color: 'var(--tx-sub)' }}>{money(f.total)}</p>
            )}
          </div>

          {monthExp.length >= SEARCH_THRESHOLD && (
            <SearchBar
              query={f.query}
              onQuery={f.setQuery}
              sort={f.sort}
              onSort={f.setSort}
              matchCount={f.matchCount}
              sourceCount={f.sourceCount}
              isFiltering={f.isFiltering}
            />
          )}

          {f.filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--tx-muted)', textAlign: 'center', padding: '1.25rem 0' }}>
              Nothing matches “{f.query}”
            </p>
          ) : (
            <TxnList items={f.filtered} catById={catById} onDelete={onDelete} onEdit={onEdit} />
          )}
        </section>
      )}
    </>
  );
}
