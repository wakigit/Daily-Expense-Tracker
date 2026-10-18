import { matchingRows, validateQuery, validDate } from './queryContract.js';
import { queryRange, executeQuery } from './queryEngine';

/** A review is local, read-only and deliberately contains no aggregate total. */
export function previewSpendingScope(raw, ctx) {
  if (!validDate(ctx.today)) return {ok:false,question:'A valid Singapore reference date is required.'};
  const checked = validateQuery(raw, ctx.cats);
  if (!checked.ok || !checked.query.spendingScope) return {ok:false,question:checked.question ?? 'Include at least one category or description rule.'};
  const query=checked.query, range=queryRange(query,ctx.today,ctx.expenses);
  // Reuse engine validation/date handling without granting approval or calculating.
  if (!validDate(range.start)||!validDate(range.end)||range.start > range.end) return {ok:false,question:'Choose recorded dates through today.'};
  const filters={...range,start:query.period==='all'?'1900-01-01':range.start,category:query.category,description:query.description,day:query.day,amountOperator:query.amountOperator,amountCents:query.amountCents,spendingScope:query.spendingScope};
  const rows=matchingRows(ctx.expenses,filters).sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
  const categories=ctx.cats.map(c=>[c.id,c.label]).sort((a,b)=>a[0].localeCompare(b[0]));
  const fingerprint=JSON.stringify({query,range,categories,rows:rows.map(r=>[r.id,r.date,r.description,r.category,r.amount,r.notes??''])});
  return {ok:true,query,range,count:rows.length,rows:rows.slice(0,6).map(r=>({...r,categoryLabel:ctx.cats.find(c=>c.id===r.category)?.label??'Unknown category'})),fingerprint};
}
export function confirmSpendingScope(proposal,ctx) {
  const preview=previewSpendingScope(proposal.query,ctx);
  if(!preview.ok) return {kind:'invalid',question:preview.question};
  if(preview.fingerprint!==proposal.preview.fingerprint) return {kind:'refresh',preview};
  return {kind:'confirmed',query:preview.query,plan:executeQuery(preview.query,{...ctx,approvedScope:preview.query.spendingScope})};
}
