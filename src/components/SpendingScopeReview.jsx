import { useEffect, useState } from 'react';
import { money } from '../lib/format';
export function SpendingScopeRules({ scope, cats=[] }) {
  if(!scope) return null;
  const labels=ids=>ids.map(id=>cats.find(c=>c.id===id)?.label??id).join(', ');
  return <div className="scope-rules"><strong>{scope.label}</strong><ul>
    {scope.includeCategories.length>0 && <li>Include every transaction in categories: {labels(scope.includeCategories)}.</li>}
    {scope.includeTerms.length>0 && <li>Include descriptions containing any of: {scope.includeTerms.map(t=>`“${t}”`).join(', ')}.</li>}
    {scope.excludeCategories.length>0 && <li>Exclude categories: {labels(scope.excludeCategories)}.</li>}
    {scope.excludeTerms.length>0 && <li>Exclude descriptions containing: {scope.excludeTerms.map(t=>`“${t}”`).join(', ')}.</li>}
  </ul><p>Inclusions use OR. Date, amount and other displayed filters apply as well. Exclusions win. Literal matching ignores case and repeated whitespace, without aliases or semantic completeness.</p></div>;
}
export default function SpendingScopeReview({ proposal,cats,onConfirm,onCancel,onRevise }) {
  const [editing,setEditing]=useState(false);
  const [wholeCategoriesAccepted,setWholeCategoriesAccepted]=useState(false);
  useEffect(()=>setWholeCategoriesAccepted(false),[proposal.preview.fingerprint]);
  const [draft,setDraft]=useState(proposal.query.spendingScope);
  const {query,preview}=proposal;
  const edit=()=>{setDraft(query.spendingScope);setEditing(true);};
  const toggle=(key,id)=>setDraft(d=>({...d,[key]:d[key].includes(id)?d[key].filter(x=>x!==id):[...d[key],id]}));
  return <section className="proposal scope-review" aria-label="Review related spending scope">
    <h3>Review spending rules</h3>
    <p>{preview.range.start} to {preview.range.end} (inclusive, Singapore)</p>
    {(query.category||query.description||query.amountOperator||query.day!=='all')&&<p>Additional filters: {[query.category&&cats.find(c=>c.id===query.category)?.label,query.description&&`Descriptions containing “${query.description}”`,query.amountOperator&&`${({gt:'over',lt:'under',gte:'at least',lte:'at most'})[query.amountOperator]} ${money(query.amountCents/100)}`,query.day!=='all'&&query.day].filter(Boolean).join(' · ')}</p>}
    <p>Requested result: {query.operation==='breakdown'?`complete ${query.groupBy} breakdown`:query.operation}.</p>
    <SpendingScopeRules scope={query.spendingScope} cats={cats}/>
    {proposal.notice&&<p role="status" className="scope-notice">{proposal.notice}</p>}
    <p><strong>{preview.count} candidate transactions</strong>. {preview.count>6?'First 6 shown; confirmation calculates all matches.':'All candidates shown below.'} No final scope total until you approve.</p>
    <ul className="scope-preview">{preview.rows.map(r=><li key={r.id}><span>{r.description}<small>{r.date} · {r.categoryLabel}</small></span><strong>{money(r.amount)}</strong></li>)}</ul>
    {query.spendingScope.includeCategories.length>0 && !editing && <label className="scope-category-ack"><input type="checkbox" checked={wholeCategoriesAccepted} onChange={e=>setWholeCategoriesAccepted(e.target.checked)}/>I understand every transaction in the listed whole categories will count, subject to the displayed filters and exclusions. These categories may include unrelated purchases.</label>}
    {!preview.count&&<p>No matching recorded expenses. You can revise the rules or confirm an empty result.</p>}
    {editing ? <form className="scope-editor" onSubmit={e=>{e.preventDefault();onRevise(draft);setEditing(false);}}>
      <label>Scope name<input value={draft.label} maxLength={80} onChange={e=>setDraft(d=>({...d,label:e.target.value}))}/></label>
      {['includeTerms','excludeTerms'].map(key=><label key={key}>{key==='includeTerms'?'Include description terms':'Exclude description terms'} (one per line, literal)<textarea rows={3} value={draft[key].join('\n')} onChange={e=>setDraft(d=>({...d,[key]:e.target.value.split('\n')}))}/></label>)}
      {['includeCategories','excludeCategories'].map(key=><fieldset key={key}><legend>{key==='includeCategories'?'Include entire categories':'Exclude entire categories'}</legend>{cats.map(c=><label key={c.id}><input type="checkbox" checked={draft[key].includes(c.id)} onChange={()=>toggle(key,c.id)}/>{c.label}</label>)}</fieldset>)}
      <p>Blank lines are ignored. Up to eight rules in each list, 80 characters per term.</p>
      <div className="proposal-actions"><button type="submit" className="btn-primary">Preview revised rules</button><button type="button" onClick={()=>setEditing(false)}>Discard revision</button></div>
    </form> : <div className="proposal-actions"><button type="button" className="btn-primary" disabled={query.spendingScope.includeCategories.length>0&&!wholeCategoriesAccepted} onClick={onConfirm}>Approve scope and calculate</button><button type="button" onClick={edit}>Revise rules</button><button type="button" onClick={onCancel}>Cancel scope</button></div>}
  </section>;
}
