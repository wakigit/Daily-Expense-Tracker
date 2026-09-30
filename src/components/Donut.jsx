import { money } from '../lib/format';

/**
 * Hand-built SVG donut. No charting library: the maths is 12 lines, and a
 * library would add ~50KB plus its own opinions about our colours.
 *
 * Slices are separated by a real angular gap rather than a stroke, so the
 * separation works on every theme without knowing the card's background.
 */
export default function Donut({ data, size = 132, inner = 40, outer = 60, total, onSlice }) {
  const sum = data.reduce((s, d) => s + d.value, 0);
  if (!sum) return null;

  const cx = size / 2;
  const cy = size / 2;
  const GAP = data.length > 1 ? 0.03 : 0; // radians trimmed from each side

  let angle = -Math.PI / 2;
  const slices = data.map((d) => {
    const sweep = (d.value / sum) * 2 * Math.PI;
    const a0 = angle + GAP / 2;
    const a1 = angle + sweep - GAP / 2;
    angle += sweep;

    // A slice smaller than the gap would invert — skip drawing it.
    if (a1 <= a0) return { ...d, path: null };

    const big = a1 - a0 > Math.PI ? 1 : 0;
    const x1 = cx + outer * Math.cos(a0), y1 = cy + outer * Math.sin(a0);
    const x2 = cx + outer * Math.cos(a1), y2 = cy + outer * Math.sin(a1);
    const ix1 = cx + inner * Math.cos(a1), iy1 = cy + inner * Math.sin(a1);
    const ix2 = cx + inner * Math.cos(a0), iy2 = cy + inner * Math.sin(a0);

    return {
      ...d,
      path: `M${x1},${y1} A${outer},${outer} 0 ${big} 1 ${x2},${y2} L${ix1},${iy1} A${inner},${inner} 0 ${big} 0 ${ix2},${iy2} Z`,
    };
  });

  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
           aria-label={`Spending split across ${data.length} categories`}>
        {slices.map((s, i) =>
          s.path && (
            <path
              key={s.id ?? i}
              className="donut-slice"
              style={{ '--i': i }}
              d={s.path}
              fill={s.color}
              onClick={onSlice ? () => onSlice(s.id) : undefined}
            />
          )
        )}
      </svg>
      <div className="donut-center">
        <span className="donut-center-cap">Total</span>
        <span className="donut-center-val">{money(total ?? sum)}</span>
      </div>
    </div>
  );
}
