import Donut from '../components/Donut';
import TxnList from '../components/TxnList';
import SearchBar from '../components/SearchBar';
import { money, signedMoney } from '../lib/format';
import { useCountUp } from '../hooks/useCountUp';
import { useTxnFilter } from '../hooks/useTxnFilter';

// Below this many rows a search box is clutter, not help.
const SEARCH_THRESHOLD = 6;

export default function HomeView({
  totalSpent, totalBudget, remaining, budPct, isOver,
  chartData, cats, budgets, spending, monthExp,
  onPickCat, catById, onDelete, onEdit,
}) {
  const shownTotal = useCountUp(totalSpent);
  const shownRemaining = useCountUp(remaining);
  const f = useTxnFilter(monthExp, catById);

  return (
    <>
      {/* ── Summary ── */}
      <section className="card" style={{ '--i': 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <p className="stat-cap">Total spent</p>
            <div className="display" style={{ fontSize: '2.05rem', lineHeight: 1, color: isOver ? 'var(--danger)' : 'var(--text)' }}>
              {money(shownTotal)}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '5px 0 0' }}>
              of {money(totalBudget)} budget
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="stat-cap">Remaining</p>
            <div className="display" style={{ fontSize: '1.45rem', lineHeight: 1, color: remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {signedMoney(shownRemaining)}
            </div>
            <p style={{ fontSize: 11, margin: '5px 0 0', color: remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {remaining >= 0 ? 'under budget 🌸' : 'over budget'}
            </p>
          </div>
        </div>

        <div className="progress-track">
          <div
            className={`progress-fill${isOver ? ' over' : ''}`}
            style={{ width: `${budPct}%`, background: isOver ? 'var(--danger)' : 'var(--accent)' }}
          />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0', textAlign: 'right' }}>
          {budPct}% used
        </p>
      </section>

      {/* ── Breakdown ── */}
      <section className="card" style={{ '--i': 1 }}>
        <p className="lbl">Spending breakdown</p>
        {chartData.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Donut data={chartData} total={totalSpent} onSlice={onPickCat} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {chartData.map((item) => (
                <div key={item.id} className="legend-row" onClick={() => onPickCat(item.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <div className="dot" style={{ width: 9, height: 9, background: item.color }} />
                    <span className="truncate" style={{ fontSize: 13, color: 'var(--text-sub)' }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span className="money" style={{ fontSize: 13, fontWeight: 700 }}>{money(item.value)}</span>
                    <span style={{ fontSize: 12, color: 'var(--chevron)' }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
            No expenses yet this month 🎀
          </p>
        )}
      </section>

      {/* ── Budgets ── */}
      <section className="card" style={{ '--i': 2 }}>
        <p className="lbl">Budget by category — tap to view ›</p>
        {cats.map((c) => {
          const spent = spending[c.id] || 0;
          const budget = budgets[c.id] || 0;
          const over = spent > budget && budget > 0;
          const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;

          return (
            <div key={c.id} className="cat-row" onClick={() => onPickCat(c.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <div className="dot" style={{ width: 10, height: 10, background: c.color }} />
                  <span className="truncate" style={{ fontSize: 14 }}>{c.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className="money" style={{ fontSize: 12, color: over ? 'var(--danger)' : 'var(--text-faint)' }}>
                    {budget > 0 ? `${money(spent)} / ${money(budget)}` : money(spent)}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--chevron)' }}>›</span>
                </div>
              </div>
              {budget > 0 ? (
                <div className="progress-track">
                  <div
                    className={`progress-fill${over ? ' over' : ''}`}
                    style={{ width: `${pct}%`, background: over ? 'var(--danger)' : c.color }}
                  />
                </div>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', fontStyle: 'italic' }}>
                  No budget set
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* ── Transactions ── */}
      {monthExp.length > 0 && (
        <section className="card" style={{ '--i': 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p className="lbl">Transactions</p>
            {f.isFiltering && (
              <p className="lbl money" style={{ color: 'var(--text-sub)' }}>{money(f.total)}</p>
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
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '1.25rem 0' }}>
              Nothing matches “{f.query}” 🎀
            </p>
          ) : (
            <TxnList items={f.filtered} catById={catById} onDelete={onDelete} onEdit={onEdit} />
          )}
        </section>
      )}
    </>
  );
}
