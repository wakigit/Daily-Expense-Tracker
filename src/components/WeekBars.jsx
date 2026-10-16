import { byDay, addDays, sum } from '../lib/stats';
import { money } from '../lib/format';

/**
 * Spending for the last seven days, as bars.
 *
 * Reads from ALL expenses rather than the displayed month's, because a
 * seven-day window straddles the 1st for six days out of every thirty — a chart
 * that silently dropped those days would read as "you spent nothing on Monday".
 *
 * The scale is the tallest bar in the window, not the budget: at a daily level
 * the budget is not the question being asked, and dividing a monthly figure by
 * thirty to invent a daily one is arithmetic the app has no basis for. The
 * dashed line is the window's own average, which is a real number.
 */
export default function WeekBars({ expenses = [], anchor, anchorIsToday = false, days = 7 }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(anchor, i - (days - 1)));
  const totals = byDay(expenses);
  const bars = dates.map((d) => ({ date: d, total: totals[d] || 0 }));

  const windowTotal = sum(expenses.filter((e) => dates.includes(e.date)));
  const peak = Math.max(...bars.map((b) => b.total));
  const avg = windowTotal / days;

  // Nothing to scale against, so there is no chart to draw.
  if (peak <= 0) {
    return (
      <section className="card week-bars" style={{ '--i': 1 }}>
        <div className="week-head">
          <p className="lbl">Last {days} days</p>
          <p className="lbl money week-total">{money(0)}</p>
        </div>
        <p className="week-empty">Nothing logged in the last {days} days.</p>
      </section>
    );
  }

  return (
    <section className="card week-bars" style={{ '--i': 1 }}>
      <div className="week-head">
        <p className="lbl">Last {days} days</p>
        <p className="lbl money week-total">{money(windowTotal)}</p>
      </div>

      <div className="week-plot" role="img"
        aria-label={`Spending for the last ${days} days, totalling ${money(windowTotal)}`}>
        {/* The average sits behind the bars so it reads as a reference, not as data.
            The ratio goes out as a custom property rather than a `bottom`
            percentage: a percentage here would resolve against the whole plot,
            which is taller than the bars by the height of the day-label row,
            and the line would be drawn that much too low. The stylesheet does
            the arithmetic against the bar area so the line and the bars share
            one baseline and one scale. */}
        <div className="week-avg" style={{ '--wk-ratio': avg / peak }}>
          <span>avg {money(avg)}</span>
        </div>

        {bars.map((b, i) => (
          <div key={b.date} className="week-col">
            <div
              className={`week-bar${b.total === peak ? ' top' : ''}${b.total === 0 ? ' none' : ''}`}
              style={{ height: `${Math.max((b.total / peak) * 100, b.total > 0 ? 4 : 1.5)}%` }}
            >
              <span className="week-tip money">{money(b.total)}</span>
            </div>
            {/* "Today" is only true when the window actually ends today — on a
                past month it ends on the 31st, and labelling that Today would
                be a lie the chart tells quietly. */}
            <span className="week-day">
              {i === days - 1 && anchorIsToday
                ? 'Today'
                : new Date(`${b.date}T00:00:00`).toLocaleDateString('en-SG', { weekday: 'narrow' })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
