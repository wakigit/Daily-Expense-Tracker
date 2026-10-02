import { CALM, WATCH, OVER } from '../lib/status';

/**
 * The status cue, §2: the word first, then the shape, then the colour. Three
 * cues rather than one means the state survives a greyscale screenshot and a
 * colour-blind reader.
 *
 * role="status" + aria-live announces a change without stealing focus, which
 * is what makes the wallpaper purely decorative rather than load-bearing.
 */
const Shape = ({ status }) => {
  const props = {
    viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true,
  };

  if (status === OVER)
    return (
      <svg {...props} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5 21.5 20h-19z" />
        <path d="M12 10v4.5M12 17.2v.1" />
      </svg>
    );

  // "Close to limit" and "budget reached" share the half-filled circle: both
  // mean the same thing to a reader deciding whether to spend.
  if (status === WATCH)
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
      </svg>
    );

  return (
    <svg {...props} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.6 2.5L16 9.5" />
    </svg>
  );
};

export default function StatusChip({ status = CALM, label, pct, showPct = true }) {
  return (
    <div className="status-chip" role="status" aria-live="polite">
      <span className={`st-icon k-${status}`}><Shape status={status} /></span>
      <span className="st-label">{label}</span>
      {showPct && <span className="st-pct money">{pct}% used</span>}
    </div>
  );
}
