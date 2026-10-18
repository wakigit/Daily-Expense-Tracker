import { money } from '../lib/format';

/** These are the rows at answer time, never live rows that could change the figure. */
export default function AnswerEvidence({ evidence, outdated = false, showWarning = true }) {
  if (!evidence) return null;
  return (
    <>
      {outdated && showWarning && (
        <p className="answer-outdated" role="status">
          <strong>Out of date.</strong> Source transactions or category budget settings have changed since this answer.
          {' '}Ask again for an updated figure.
        </p>
      )}
      {evidence.rows.length > 0 && (
        <details className="answer-evidence">
          <summary>See transactions <span>({evidence.rows.length})</span></summary>
          <p className="evidence-caption">
            {outdated ? 'Historical transactions at the time of this answer.' : 'Transactions used for this answer.'}
          </p>
          <ul tabIndex={0} aria-label="Transactions behind this answer">
            {evidence.rows.map((row) => (
              <li key={row.id}>
                <div className="evidence-description">
                  <strong>{row.description}</strong>
                  <span><time dateTime={row.date}>{row.date}</time> · {row.categoryLabel}</span>
                </div>
                <span className="evidence-amount money">{money(row.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
