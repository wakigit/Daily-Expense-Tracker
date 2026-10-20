import AnswerEvidence from './AnswerEvidence';
import { planPartLabel, formatPlanMoney } from '../lib/planPresentation.js';
const cash = formatPlanMoney;
const signedCash = cents => `${cents>=0?'+':'−'}${cash(Math.abs(cents))}`;

/** Typed code-calculated results, with original operands and evidence. */
export default function PlanAnswer({result,answerId='snapshot',outdated=false,source}) {
  if(!result)return null;
  const label=id=>{const i=result.base.findIndex(p=>p.id===id);return i<0?'Input':planPartLabel(result.base[i],i);};
  const anchor=id=>`plan-${answerId}-${id}`;
  return <div className="plan-answer">
    <p className="evidence-caption">{source==='mock'?'Mock interpretation':source==='model'?'Model interpretation, calculated locally':source==='builtin'?'Built-in historical evidence':'Local calculation from validated instructions'} · One ledger snapshot · SGD</p>
    {outdated&&<p className="answer-outdated" role="status"><strong>Out of date.</strong> At least one part’s source records or categories changed. These figures and evidence are frozen. Ask again for updated results.</p>}
    {result.base.map((part,i)=><section className="comparison-side" key={part.id} id={anchor(part.id)} aria-label={planPartLabel(part,i)}>
      <div className="comparison-heading"><strong>{planPartLabel(part,i)}</strong><span className="money">{cash(part.totalCents)}</span></div>
      <p className="evidence-caption">{part.range.start} to {part.range.end} · {part.count} recorded {part.count===1?'transaction':'transactions'}</p>
      <p className="evidence-caption">{part.interpretation?.category} · {part.detail}</p>
      {part.outdated&&<p className="answer-outdated">This part is out of date.</p>}
      {!part.count&&<p className="evidence-caption">No matching recorded expenses.</p>}
      <AnswerEvidence evidence={part.evidence} outdated={part.outdated} showWarning={false} pageSize={50}/>
    </section>)}
    {result.derived.map((part,i)=>{
      const inputs=part.provenance.inputs;
      const share=part.operation==='percent_of';
      const first=share?inputs.numerator:inputs.left,second=share?inputs.denominator:inputs.right;
      return <section className="comparison-side" key={part.id} aria-label={`${result.plan.steps.length+Number(part.id.slice(1))}. ${share?'Percentage share':'Difference'}`}>
        <div className="comparison-heading"><strong>{result.plan.steps.length+Number(part.id.slice(1))}. {share?'Percentage share':'Difference'}</strong><span className="money">{share?(part.status==='unavailable_zero_denominator'?'Unavailable':part.display):signedCash(part.totalCents)}</span></div>
        <p className="evidence-caption">{label(first.reference.step)} {share?'÷':'minus'} {label(second.reference.step)}</p>
        <p>{share ? part.status==='unavailable_zero_denominator'?'Percentage unavailable: the recorded denominator is S$0.00. No numeric share can be calculated.':`${cash(part.numeratorCents)} ÷ ${cash(part.denominatorCents)} × 100 = ${part.display}`
          : `${cash(first.totalCents)} − ${cash(second.totalCents)} = ${signedCash(part.totalCents)}`}</p>
        {part.outdated&&<p className="answer-outdated">An input changed. This calculation remains the original snapshot.</p>}
        <p className="evidence-caption">Original input evidence: {[first,second].map((input,j)=><span key={j}>{j>0?' · ':''}<a href={`#${anchor(input.reference.step)}`}>{label(input.reference.step)}</a></span>)}</p>
      </section>;
    })}
  </div>;
}
