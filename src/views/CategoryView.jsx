import DateSearchNotice from '../components/DateSearchNotice';
import TxnList from '../components/TxnList';
import SearchBar from '../components/SearchBar';
import { money, ymLabel } from '../lib/format';
import { useCountUp } from '../hooks/useCountUp';
import { useTxnFilter } from '../hooks/useTxnFilter';


/** Drill-down for the header month. */
export default function CategoryView({
  cat, items, total, byMonth, ym,
  catById, onDelete, onEdit, onChangeMonth,
}) {
  const shown = useCountUp(total);
  const f = useTxnFilter(items, catById, ym);

  return (
    <>
      <section className="card" style={{ '--i': 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.9rem' }}>
          <div className="dot" style={{ width: 16, height: 16, background: cat?.color }} />
          <span className="display" style={{ fontSize: '1.15rem', color: 'var(--tx)' }}>{cat?.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 30 }}>
          <div>
            <p className="stat-cap">{ymLabel(ym)} total</p>
            <div className="display money" style={{ fontSize: '1.7rem', color: 'var(--tx)', lineHeight: 1 }}>
              {money(shown)}
            </div>
          </div>
          <div>
            <p className="stat-cap">Transactions</p>
            <div className="display money" style={{ fontSize: '1.7rem', color: 'var(--tx)', lineHeight: 1 }}>
              {items.length}
            </div>
          </div>
        </div>
      </section>

      {(
        <section className="card" style={{ '--i': 1, paddingBottom: f.isFiltering ? '1.15rem' : '0.4rem' }}>
          <p className="search-scope">Searching {cat?.label} · {ymLabel(ym)}<br />Dates: 17 Oct, D/M/YYYY or YYYY-MM-DD</p>
          <DateSearchNotice parsed={f.dateSearch} ym={ym} onChangeMonth={onChangeMonth} />
          <SearchBar
            query={f.query}
            onQuery={f.setQuery}
            sort={f.sort}
            onSort={f.setSort}
            matchCount={f.matchCount}
            sourceCount={f.sourceCount}
            isFiltering={f.isFiltering}
          />
        </section>
      )}

      {/* While searching, one flat result list reads better than month groups. */}
      {f.isFiltering ? (
        <section className="card" style={{ '--i': 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p className="lbl">Results</p>
            <p className="lbl money" style={{ color: 'var(--tx-sub)' }}>{money(f.total)}</p>
          </div>
          {f.filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--tx-muted)', textAlign: 'center', padding: '1.25rem 0' }}>
              Nothing matches “{f.query}”
            </p>
          ) : (
            <TxnList items={f.filtered} catById={catById} onDelete={onDelete} onEdit={onEdit} />
          )}
        </section>
      ) : items.length === 0 ? (
        <section className="card empty" style={{ '--i': 1 }}>
          
          <p style={{ fontSize: 14, color: 'var(--tx-muted)' }}>No {cat?.label} entries in {ymLabel(ym)}. Choose another month or add an expense.</p>
        </section>
      ) : (
        byMonth.map(([m, exps], i) => (
          <section key={m} className="card" style={{ '--i': i + 2 }}>
            <p className="lbl">{ymLabel(m)}</p>
            <TxnList items={exps} catById={catById} onDelete={onDelete} onEdit={onEdit} />
          </section>
        ))
      )}
    </>
  );
}
