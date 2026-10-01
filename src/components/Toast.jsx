/**
 * Transient confirmation, optionally carrying one or more actions.
 *
 * Generalised from a single Undo button so the same component can carry any
 * number of actions — one toast component, not two.
 *
 * role="status" + aria-live announces it without stealing focus.
 */
export default function Toast({ message, actions = [] }) {
  if (!message) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-msg">{message}</span>
      {actions.map((a) => (
        <button
          key={a.key}
          className="toast-action"
          onClick={a.onClick}
          aria-label={a.aria || a.label}
          title={a.aria || a.label}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
