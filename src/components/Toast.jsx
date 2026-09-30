/**
 * Transient confirmation, optionally with a single action (Undo).
 * `role="status"` + aria-live so screen readers announce it without stealing focus.
 */
export default function Toast({ message, actionLabel, onAction }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      {actionLabel && (
        <button className="toast-action" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
