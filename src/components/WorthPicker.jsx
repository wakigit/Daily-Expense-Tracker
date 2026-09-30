import { WORTH_OPTIONS } from '../lib/worth';

/**
 * The three reactions. Used inline on the edit form; the toast renders its
 * own compact version straight after an expense is added.
 */
export default function WorthPicker({ value, onPick, size = 'md' }) {
  return (
    <div className={`worth-picker${size === 'sm' ? ' sm' : ''}`} role="radiogroup" aria-label="Was it worth it?">
      {WORTH_OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`worth-btn${value === o.id ? ' sel' : ''}`}
          // Tapping the current value clears it — tagging must stay optional.
          onClick={() => onPick(value === o.id ? undefined : o.id)}
          role="radio"
          aria-checked={value === o.id}
        >
          <span className="worth-emoji">{o.emoji}</span>
          <span className="worth-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
