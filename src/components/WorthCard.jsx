import { money } from '../lib/format';
import { WORTH_OPTIONS } from '../lib/worth';

/**
 * The insight card. Deliberately silent until enough expenses are tagged —
 * a "you regret 100% of your spending" headline drawn from one data point is
 * noise, and it would undermine the feature the first time anyone saw it.
 */
export default function WorthCard({ stats, index = 0 }) {
  const { counts, totals, regretTotal, regretRate, topRegret, taggedCount, untaggedCount } = stats;
  const pct = Math.round(regretRate * 100);

  return (
    <section className="card" style={{ '--i': index }}>
      <p className="lbl">Was it worth it?</p>

      <div className="worth-stats">
        {WORTH_OPTIONS.map((o) => (
          <div key={o.id} className="worth-stat">
            <span className="worth-stat-emoji">{o.emoji}</span>
            <span className="money worth-stat-amt">{money(totals[o.id])}</span>
            <span className="worth-stat-cap">{counts[o.id]} {counts[o.id] === 1 ? 'entry' : 'entries'}</span>
          </div>
        ))}
      </div>

      <p className="worth-insight">
        {regretTotal > 0 ? (
          <>
            You regret <strong className="money">{money(regretTotal)}</strong> — {pct}% of what you've tagged
            {topRegret && topRegret.share >= 0.4 && (
              <>
                , mostly{' '}
                <span className="worth-cat">
                  <span className="dot" style={{ width: 8, height: 8, background: topRegret.color }} />
                  {topRegret.label}
                </span>
              </>
            )}
            .
          </>
        ) : (
          <>No regrets so far — {money(totals.yes)} of tagged spending was worth it. 🌸</>
        )}
      </p>

      <p className="worth-foot">
        Based on {taggedCount} tagged {taggedCount === 1 ? 'entry' : 'entries'}
        {untaggedCount > 0 && ` · ${untaggedCount} untagged`}
      </p>
    </section>
  );
}
