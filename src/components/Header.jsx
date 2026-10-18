import { ymLabel } from '../lib/format';

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/**
 * Zone 1 of §4: the month picker on Home, the screen title everywhere else.
 * Settings has its own tab, so nothing else belongs up here.
 *
 * A category keeps both its back button and the selected-month picker.
 */
export default function Header({ title, filteredCat, onClearFilter, ym, onOpenPicker }) {
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
      {filteredCat && (
        <button className="month-btn" onClick={onOpenPicker} aria-label={`Change month, ${ymLabel(ym)}`}>
          <span>{ymLabel(ym)}</span><Chevron />
        </button>
      )}
    </header>
  );
}
