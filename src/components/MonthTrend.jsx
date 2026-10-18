import { useEffect, useState } from 'react';
import { monthTrend, axisTicks, MIN_DAYS_WITH_SPEND } from '../lib/trend';
import { money, ymLabel, dayLabel } from '../lib/format';

/* The drawing box. The card scales the SVG to its own width, so these are
   aspect-ratio units rather than pixels — but they are chosen at roughly the
   size the card is actually drawn at on a laptop, so strokes and type land at
   the weights they were designed for. */
const W = 760;
/* Two aspect ratios, not two components.

   A short laptop has ~100px less height and the same cards, so the plot has to
   give some back. Clamping the rendered height in CSS was the wrong way to do
   it: with a fixed viewBox the drawing just scaled down and sat in the middle
   of a card that was still full width, which made the dashboard's main graph
   look small and marooned. Changing the box it is drawn IN keeps it filling
   the card at every size. */
const H_TALL = 212;
const H_SHORT = 164;
const SHORT_SCREEN = '(max-height: 870px)';

const pad = (h) => ({ top: 16, right: 22, bottom: 30, left: 64, W, H: h,
  plotW: W - 64 - 22, plotH: h - 16 - 30 });

/** Matches a media query and re-renders when it changes. */
function useMatch(query) {
  const [hit, setHit] = useState(
    () => typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setHit(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return hit;
}

/**
 * The month's running total, as an area chart.
 *
 * Deliberately not a second view of the donut: the donut answers "where did it
 * go", this answers "am I on pace". The budget line is what makes it the
 * second question rather than a prettier version of the first.
 *
 * Values are inspectable by pointer and by keyboard — the plot takes focus and
 * the arrow keys walk the days, because a chart whose numbers can only be read
 * with a mouse is a chart half the readers cannot read.
 */
export default function MonthTrend({ expenses = [], ym, todayYmd, budget = 0 }) {
  const t = monthTrend(expenses, ym, todayYmd, budget);
  const [active, setActive] = useState(null);
  const H = useMatch(SHORT_SCREEN) ? H_SHORT : H_TALL;
  const PAD = pad(H);
  const PLOT_W = PAD.plotW;
  const PLOT_H = PAD.plotH;

  const title = `Spending so far — ${ymLabel(ym)}`;

  if (!t.enough) {
    return (
      <section className="card trend-card" style={{ '--i': 1 }}>
        <TrendHead title={title} t={t} />
        <div className="trend-empty">
          <p className="trend-empty-title">Not enough to show a trend yet</p>
          <p className="trend-empty-body">
            {t.daysWithSpend === 0
              ? `Nothing is logged for ${ymLabel(ym)}.`
              : `Only one day has spending on it.`}{' '}
            A running total needs at least {MIN_DAYS_WITH_SPEND} days with
            something on them. This chart will not guess the days in between.
          </p>
        </div>
      </section>
    );
  }

  const n = t.points.length;
  /* A single-point month cannot span the axis, so x would divide by zero.
     n is at least 2 to get here, but the guard keeps that implicit fact local. */
  const x = (i) => PAD.left + (n > 1 ? (i / (n - 1)) * PLOT_W : PLOT_W / 2);
  const y = (v) => PAD.top + PLOT_H - (t.scaleMax > 0 ? (v / t.scaleMax) * PLOT_H : 0);

  const line = t.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  const ticks = axisTicks(t.scaleMax);
  const overBudget = budget > 0 && t.total > budget;

  /* Label about six days, always including the first and the last, so the
     axis stays readable whether the month is three days old or thirty-one. */
  const labelEvery = Math.max(1, Math.round(n / 6));
  const shown = active == null ? null : t.points[active];

  const move = (ev) => {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      setActive((a) => {
        const next = (a == null ? n - 1 : a) + (ev.key === 'ArrowRight' ? 1 : -1);
        return Math.max(0, Math.min(n - 1, next));
      });
    } else if (ev.key === 'Home') { ev.preventDefault(); setActive(0); }
    else if (ev.key === 'End') { ev.preventDefault(); setActive(n - 1); }
    else if (ev.key === 'Escape') { setActive(null); }
  };

  return (
    <section className={`card trend-card${overBudget ? ' trend-card--over' : ''}`} style={{ '--i': 1 }}>
      <TrendHead title={title} t={t} />

      <div
        className="trend-plot"
        tabIndex={0}
        role="application"
        aria-label={
          `${title}. Running total ${money(t.total)} over ${t.through} days` +
          (budget > 0 ? `, against a budget of ${money(budget)}` : '') +
          '. Use the left and right arrow keys to read each day.'
        }
        onKeyDown={move}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" role="img"
          aria-label={`Running total reaching ${money(t.total)} by day ${t.through}`}>
          <defs>
            <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="trend-stop-a" />
              <stop offset="1" className="trend-stop-b" />
            </linearGradient>
          </defs>

          {/* Gridlines and the S$ scale. Drawn first so data sits over them. */}
          {ticks.map((v) => (
            <g key={v}>
              <line className="trend-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="trend-axis money" x={PAD.left - 10} y={y(v) + 4} textAnchor="end">
                {v === 0 ? 'S$0' : money(v).replace(/\.00$/, '')}
              </text>
            </g>
          ))}

          {/* The budget, as a reference rather than as data.

              The label used to sit above the line at the right edge, which is
              exactly where an over-budget curve crosses it — the two drew on
              top of each other and neither could be read. It now takes the
              side of the line the curve is NOT on at that end, and carries a
              backing panel so the gridlines behind it do not show through the
              letterforms. */}
          {budget > 0 && budget <= t.scaleMax && (() => {
            /* Put the label at whichever END of the line the curve is furthest
               from, then on whichever SIDE of the line the curve is not.

               Pinning it to the right was wrong in the one case that matters
               most: an over-budget month crosses the line near the right edge,
               so the curve runs through both the space above and the space
               below it there. The left end is almost always clear, because a
               running total starts at nothing — but the rule measures rather
               than assuming, so a low budget crossed early still gets a
               readable label. */
            const first = t.points[0].total;
            const last = t.points[n - 1].total;
            const atLeft = Math.abs(first - budget) >= Math.abs(last - budget);
            const curveBelow = (atLeft ? first : last) < budget;

            const label = `budget ${money(budget)}`;
            const wTag = label.length * 5.6 + 10;
            // Above the line when the curve is below it, and vice versa —
            // clamped so the tag never leaves the plot.
            let tagY = curveBelow ? y(budget) - 8 : y(budget) + 15;
            if (tagY < PAD.top + 10) tagY = y(budget) + 15;
            if (tagY > PAD.top + PLOT_H) tagY = y(budget) - 8;
            const tagX = atLeft ? PAD.left + 5 : W - PAD.right - 5;

            return (
              <g>
                <line className={`trend-budget${overBudget ? ' breached' : ''}`}
                  x1={PAD.left} x2={W - PAD.right} y1={y(budget)} y2={y(budget)} />
                <rect className="trend-budget-pad" x={atLeft ? tagX - 5 : tagX + 5 - wTag}
                  y={tagY - 10} width={wTag} height={14} rx="3" />
                <text className="trend-budget-tag" x={tagX} y={tagY}
                  textAnchor={atLeft ? 'start' : 'end'}>
                  {label}
                </text>
              </g>
            );
          })()}

          <path className={`trend-area${overBudget ? ' over' : ''}`} d={area} fill="url(#trendfill)" />
          <path className={`trend-line${overBudget ? ' over' : ''}`} d={line} fill="none" />

          {/* Day labels along the bottom. */}
          {t.points.map((p, i) => (
            (i % labelEvery === 0 || i === n - 1) && (
              <text key={p.date} className="trend-axis" x={x(i)} y={H - 10} textAnchor="middle">
                {p.day}
              </text>
            )
          ))}

          {shown && (
            <g className="trend-marker">
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + PLOT_H} />
              <circle cx={x(active)} cy={y(shown.total)} r="5.5" />
            </g>
          )}

          {/* Invisible per-day hit targets. One rect per day beats tracking the
              pointer across the plot: it lands on the same day the marker
              shows, with no rounding disagreement between the two. */}
          {t.points.map((p, i) => (
            <rect
              key={`hit-${p.date}`}
              className="trend-hit"
              x={x(i) - (n > 1 ? PLOT_W / (n - 1) / 2 : PLOT_W / 2)}
              y={PAD.top}
              width={n > 1 ? PLOT_W / (n - 1) : PLOT_W}
              height={PLOT_H}
              onPointerEnter={() => setActive(i)}
            />
          ))}
        </svg>

        {/* The readout is HTML, not SVG text: it has to wrap, and it has to be
            announced when the arrow keys move it. */}
        <p className="trend-readout" aria-live="polite">
          {shown ? (
            <>
              <strong>{dayLabel(shown.date)}</strong>
              <span className="trend-readout-sep">·</span>
              <span className="money">{money(shown.total)} so far</span>
              <span className="trend-readout-sep">·</span>
              <span className="trend-readout-day money">
                {shown.spent > 0 ? `${money(shown.spent)} that day` : 'nothing that day'}
              </span>
            </>
          ) : (
            <span className="trend-readout-hint">
              Hover or focus the chart and use ← → to read any day.
            </span>
          )}
        </p>
      </div>
    </section>
  );
}

function TrendHead({ title, t }) {
  return (
    <div className="trend-head">
      <div>
        <p className="lbl">{title}</p>
        <p className="trend-sub">
          Running total in Singapore dollars
          {t.isCurrent ? `, days 1–${t.through}` : `, the whole month`}
          {t.budget > 0 ? ` · budget ${money(t.budget)}` : ' · no budget set'}
        </p>
      </div>
      <p className="trend-total money">{money(t.total)}</p>
    </div>
  );
}
