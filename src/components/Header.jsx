import { ymLabel } from '../lib/format';

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const Gear = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" />
  </svg>
);

/**
 * Zone 1 of §4: the month picker on Home, the screen title everywhere else,
 * and the settings gear — which is where Settings lives now that the fifth tab
 * belongs to Budget.
 *
 * Drilling into a category replaces the month stepper with a way back out.
 */
export default function Header({ title, filteredCat, onClearFilter, ym, onOpenPicker, onOpenSettings }) {
  return (
    <header className="top-bar">
      {filteredCat ? (
        <button className="month-btn" onClick={onClearFilter}>
          <span aria-hidden="true">←</span>
          <div className="dot" style={{ width: 10, height: 10, background: filteredCat.color }} />
          {filteredCat.label}
        </button>
      ) : title ? (
        <h1 className="page-title">{title}</h1>
      ) : (
        <button
          className="month-btn"
          onClick={onOpenPicker}
          aria-label={`Change month, ${ymLabel(ym)}`}
        >
          <span>{ymLabel(ym)}</span>
          <Chevron />
        </button>
      )}

      <button className="gear-btn" onClick={onOpenSettings} aria-label="Settings">
        <Gear />
      </button>
    </header>
  );
}
