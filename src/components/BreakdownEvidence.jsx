import AnswerEvidence from './AnswerEvidence';
import { money } from '../lib/format';

/** Complete immutable local result, with collapsed read-only group evidence. */
export default function BreakdownEvidence({ breakdown, outdated }) {
  if (!breakdown || !breakdown.groups.length) return null;
  return <section className="answer-breakdown" aria-label={`Complete ${breakdown.groupBy} breakdown`}>
    <p className="evidence-caption">All {breakdown.groups.length} non-empty {breakdown.groupBy === 'month' ? 'months (chronological)' : 'categories (alphabetical)'}</p>
    <ul className="breakdown-groups">
      {breakdown.groups.map(group => <li key={JSON.stringify(group.key)}>
        <div className="breakdown-heading"><strong>{group.label}</strong><strong className="money">{money(group.totalCents / 100)}</strong></div>
        <p className="evidence-caption">{group.count} recorded {group.count === 1 ? 'transaction' : 'transactions'}</p>
        <AnswerEvidence evidence={group.evidence} outdated={outdated} showWarning={false} />
      </li>)}
    </ul>
  </section>;
}
