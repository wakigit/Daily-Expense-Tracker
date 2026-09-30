import { ymLabel } from '../lib/format';

/**
 * App title plus either the month stepper or, when drilled into a category,
 * a back affordance naming that category.
 */
export default function Header({ appName, filteredCat, onClearFilter, ym, onShiftMonth, onOpenPicker }) {
  return (
    <header className="hero">
      <div className="display hero-title">{(appName || 'Expense Tracker')} 🎀</div>

      {filteredCat ? (
        <div className="hero-row">
          <button className="ghost-btn" onClick={onClearFilter}>← All</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div className="dot" style={{ width: 12, height: 12, background: filteredCat.color }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--heading-sub)' }}>
              {filteredCat.label}
            </span>
          </div>
        </div>
      ) : (
        <div className="hero-row">
          <button className="arrow-btn" onClick={() => onShiftMonth(-1)} aria-label="Previous month">‹</button>
          <button className="ghost-btn" onClick={onOpenPicker} style={{ gap: 5 }}>
            {ymLabel(ym)}
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▾</span>
          </button>
          <button className="arrow-btn" onClick={() => onShiftMonth(1)} aria-label="Next month">›</button>
        </div>
      )}
    </header>
  );
}
