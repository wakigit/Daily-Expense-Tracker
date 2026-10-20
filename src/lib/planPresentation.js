/** Product labels use immutable, code-generated scope interpretation, never model prose. */
export function planPartLabel(part, index) {
  const q=part.query;
  const category=(part.evidence.scopeCategories??[]).find(([id])=>id===q.category)?.[1];
  const subject=category ? category.length<=120 ? `${category} spending` : 'Selected category spending' : q.categories.length ? 'Selected categories spending'
    : q.description || q.descriptionTerms.length ? 'Literal description spending' : 'Total recorded spending';
  return `${Number(part.id?.slice(1)) || index + 1}. ${subject}`;
}
export function planEvidenceChoices(result,answerId) {
  return {answerId,parts:[...result.base.map((p,i)=>({id:p.id,label:planPartLabel(p,i)})),
    ...result.derived.map((p,i)=>({id:p.id,label:`${result.base.length+i+1}. ${p.operation==='difference'?'Difference':'Percentage share'} (both inputs)`}))]};
}
/** Resolve against the intended historical answer, never the latest implicit query. */
export function planEvidenceSelection(result,partId) {
  const base=result.base.find(p=>p.id===partId);
  if(base)return { ...result,base:[base],derived:[] };
  const derived=result.derived.find(p=>p.id===partId);
  if(!derived)return null;
  return {...result,base:result.base.filter(p=>derived.provenance.dependencies.includes(p.id)),derived:[derived]};
}

/** Format typed cents directly, so large safe integers never lose a displayed cent. */
export function formatPlanMoney(cents) {
  if(!Number.isSafeInteger(cents))return 'Unavailable';
  const value=BigInt(cents),absolute=value<0n?-value:value;
  return `${value<0n?'−':''}S$${absolute/100n}.${String(absolute%100n).padStart(2,'0')}`;
}
