/** Typed plan extraction, independent of answer prose and ordinary scalar oracles. */
export function extractPlanResult(answer) {
  const result=answer?.planResult;
  if(!result)return null;
  return {shape:'plan',referenceDate:result.referenceDate,
    base:result.base.map(p=>({id:p.id,query:p.query,range:p.range,scope:p.scope,unit:p.unit,totalCents:p.totalCents,count:p.count,
      ids:p.evidence.rows.map(r=>r.id).sort(),provenance:p.provenance})),
    derived:result.derived.map(p=>({id:p.id,operation:p.operation,unit:p.unit,
      ...(p.totalCents!==undefined?{totalCents:p.totalCents}:{}),
      ...(p.status?{status:p.status,numeratorCents:p.numeratorCents,denominatorCents:p.denominatorCents,
        ...(p.hundredthsPercent!==undefined?{hundredthsPercent:p.hundredthsPercent,display:p.display}:{})}:{}),provenance:p.provenance}))};
}
/** Compare every declared independent oracle field. A clarification is never a numeric pass. */
export function scorePlanResult(answer,expected) {
  const actual=extractPlanResult(answer),failures=[];
  const compare=(a,e,path)=>{
    if(Array.isArray(e)) {if(!Array.isArray(a)||a.length!==e.length){failures.push(path);return;}e.forEach((v,i)=>compare(a[i],v,`${path}[${i}]`));}
    else if(e&&typeof e==='object')for(const [k,v]of Object.entries(e))compare(a?.[k],v,`${path}.${k}`);
    else if(a!==e)failures.push(path);
  };
  if(!actual)return {pass:false,failures:['plan_missing'],actual:null};
  compare(actual,expected,'plan');return {pass:failures.length===0,failures,actual};
}
