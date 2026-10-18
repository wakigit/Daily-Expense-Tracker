import AnswerEvidence from './AnswerEvidence';
import { money } from '../lib/format';
import { fromCents } from '../lib/money';

export default function ComparisonEvidence({ comparison, outdated }) {
  if (!comparison) return null;
  return <div className="comparison-evidence">
    {outdated && <p className="answer-outdated" role="status"><strong>Out of date.</strong> Transactions have changed since this answer. Ask again for updated figures.</p>}
    {comparison.sides.map(side => <section key={side.key} className="comparison-side" aria-label={side.label}>
      <div className="comparison-heading"><strong>{side.label}</strong><span className="money">{money(fromCents(side.totalCents))}</span></div>
      <p className="evidence-caption">{side.start} to {side.end}</p>
      {side.evidence.rows.length === 0 && <p className="evidence-caption">No recorded expenses.</p>}
      <AnswerEvidence evidence={side.evidence} outdated={outdated} showWarning={false} />
    </section>)}
  </div>;
}
