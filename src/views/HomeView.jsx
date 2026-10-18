import DateSearchNotice from '../components/DateSearchNotice';
import { toCents } from '../lib/money';
import { recentPreview } from '../lib/recentPreview';
import { useEffect, useState } from 'react';
import Donut from '../components/Donut';
import WeekBars from '../components/WeekBars';
import MonthTrend from '../components/MonthTrend';
import TxnList from '../components/TxnList';
import SearchBar from '../components/SearchBar';
import StatusChip from '../components/StatusChip';
import { money, ymLabel, today, curYm } from '../lib/format';
import { budgetStatus } from '../lib/status';
import { useCountUp } from '../hooks/useCountUp';
import { useTxnFilter } from '../hooks/useTxnFilter';


const countLabel = (n) => `${n} ${n === 1 ? 'transaction' : 'transactions'}`;

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
  onPickCat, catById, onChangeMonth, onDelete, onEdit, onAddFirst, onAdd,
  /* Falls back to the displayed month when a caller has nothing wider to give.
     That is never wrong inside the month, only incomplete across the 1st — so
     App.jsx passes the full list and the window stays correct there. */
  allExpenses = monthExp,
}) {
  const shownTotal = useCountUp(totalSpent);
  const topCategories = [...chartData].filter((c) => c.value > 0).sort((a, b) => b.value - a.value).slice(0, 4);

  // Both layouts preview five matching rows, after the full month is sorted.
  const [ledgerOpen, setLedgerOpen] = useState(false);
  useEffect(() => { setLedgerOpen(false); }, [ym]);

  /* The seven-day window ends today on the current month and on the month's
     last day otherwise, so stepping back to September shows that September's
     final week rather than seven empty days. */
  const isCurrentMonth = ym === curYm();
  const weekAnchor = isCurrentMonth
    ? today()
    : new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).toISOString().slice(0, 10);
  const f = useTxnFilter(monthExp, catById, ym);
  const preview = recentPreview(f.filtered, ledgerOpen);
  const st = budgetStatus(totalSpent, totalBudget);
  const daysLeft = daysLeftIn(ym);
  const monthName = ymLabel(ym).split(' ')[0];

  // §4: the bar is a bar, so it clamps — but the chip reports the true figure.
  const barWidth = Math.min(100, st.pct);

  return (
    <>
      {/*
        The two columns below are `display: contents` on a phone, so they add
        no box and the markup renders exactly as it did before. At laptop width
        they become the centre and ledger columns of the shell grid. One set of
        sections, placed two ways — no component is forked per breakpoint.
      */}
      <div className="col col--main">
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

        {/* The main action belongs where the eye already is. On a phone the
            raised Add in the bar is always a thumb away and this would be a
            second copy of it; at laptop width the rail icon is a long way from
            the reading position, so the hero carries the real button. */}
        {onAdd && (
          <button type="button" className="btn-primary hero-add" onClick={onAdd}>
            + Add expense
          </button>
        )}
      </section>


      {/* Two charts, two questions, one shown at a time.

          Laptop gets the running total, because "am I on pace" is the question
          a budget poses and it is the one worth the width of a dashboard. The
          phone keeps the seven-day bars, which fit a narrow column and answer
          the narrower "what have I been spending lately". Only one is ever on
          screen — CSS decides which — so Home never shows two versions of the
          same answer. */}
      <div className="only-wide trend-slot">
        <MonthTrend expenses={monthExp} ym={ym} todayYmd={today()} budget={totalBudget} />
      </div>
      <div className="only-narrow">
        <WeekBars cats={cats} expenses={allExpenses} anchor={weekAnchor} anchorIsToday={isCurrentMonth} />
      </div>
      {/* ── Recent ── */}
      {monthExp.length > 0 && (
        <section
          className={`card card--recent${ledgerOpen ? ' card--recent-open' : ''}`}
          style={{ '--i': 2 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p className="lbl">Recent</p>
            {preview.canExpand ? (
              <button type="button" className="recent-count" aria-expanded={ledgerOpen}
                aria-controls="recent-transactions" onClick={() => setLedgerOpen(open => !open)}>
                {countLabel(monthExp.length)}
                <span className="recent-count-cta">
                  {ledgerOpen ? 'Show less' : f.isFiltering ? `View all ${f.matchCount} matches` : 'View all'} ›
                </span>
              </button>
            ) : <p className="recent-count recent-count--static">{countLabel(monthExp.length)}</p>}

          </div>

          {monthExp.length > 0 && (
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

          <p className="search-scope">Searching {ymLabel(ym)} · all categories<br />Dates: 17 Oct, D/M/YYYY or YYYY-MM-DD</p>
          <DateSearchNotice parsed={f.dateSearch} ym={ym} onChangeMonth={onChangeMonth} />
          {f.isFiltering && <p className="recent-results-summary">
            Showing {preview.rows.length} of {f.matchCount} matches · {money(f.total)} total
          </p>}

          {f.filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--tx-muted)', textAlign: 'center', padding: '1.25rem 0' }}>
              Nothing matches “{f.query}”
            </p>
          ) : (
            /* The whole page scrolls; rows have no internal height cap. */
            <div className="txn-list" id="recent-transactions">
              <TxnList items={preview.rows} catById={catById} onDelete={onDelete} onEdit={onEdit} />
            </div>
          )}
        </section>
      )}      </div>

      <div className="col col--side">
        {/* ── Budgets ── */}
        <section className="card card--budgets" style={{ '--i': 1 }}>
        <p className="lbl">Budget by category</p>
        {cats.map((c) => {
          const spent = spending[c.id] || 0;
          const budget = budgets[c.id] || 0;
          const cs = budgetStatus(spent, budget);
          const excess = toCents(spent) - toCents(budget);
          const over = budget > 0 && excess > 0;

          return (
            <button type="button" key={c.id} className="cat-row" onClick={() => onPickCat(c.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <div className="dot" style={{ width: 10, height: 10, background: c.color }} />
                  <span className="home-category-label" style={{ fontSize: 14 }}>{c.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className="money" style={{ fontSize: 12, color: over ? 'var(--st-over)' : 'var(--tx-muted)' }}>
                    {budget > 0 ? `${money(spent)} / ${money(budget)}` : money(spent)}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--tx-muted)' }}>›</span>
                </div>
              </div>
              {over && <p className="category-over money">{money(excess / 100)} over budget</p>}
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
            </button>
          );
        })}
      </section>

      {/* ── Cards: zone 4, starting below the focal band. ── */}
      {monthExp.length === 0 ? (
        <section className="card card--donut" style={{ '--i': 0 }}>
          <p className="empty-title">Nothing logged for {monthName} yet</p>
          <p className="empty-body">
            Add what you spend as you go and this page fills in.
          </p>
          <button onClick={onAddFirst} className="btn-primary btn-block" style={{ marginTop: 16 }}>
            Add your first expense
          </button>
        </section>
      ) : (
        <section className="card card--donut" style={{ '--i': 0 }}>
          <p className="lbl">Where it went</p>
          <div className="home-donut-layout">
            <Donut data={chartData} total={totalSpent} onSlice={onPickCat} />
            <div className="home-top-categories">
              <p className="top-categories-title">{topCategories.length >= 4 ? 'Your top 4 criminals' : 'Your top spending categories'}</p>
              {topCategories.map((item) => (
                <button type="button" key={item.id} className="legend-row" onClick={() => onPickCat(item.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <div className="dot" style={{ width: 9, height: 9, background: item.color }} />
                    <span className="home-category-label">{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span className="money" style={{ fontSize: 13, fontWeight: 700 }}>{money(item.value)}</span>
                    <span style={{ fontSize: 12, color: 'var(--tx-muted)' }}>›</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}


      </div>
    </>
  );
}
