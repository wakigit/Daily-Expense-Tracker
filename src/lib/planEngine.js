import { executeQuery, unmatchedSubject } from './queryEngine.js';
import { validateQuery, matchingRows, validDate } from './queryContract.js';
import { captureEvidence } from './answerEvidence.js';
import { toCents } from './money.js';
import { validatePlan, planFailure, PLAN_LIMITS, PLAN_MONEY_UNIT, jsonBytes } from './planContract.js';
import { auditPlanRequest } from './planRequest.js';

const MAX=BigInt(Number.MAX_SAFE_INTEGER);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const safe=n=>Number.isSafeInteger(n);
export function planDifference(left,right){
  if(!safe(left)||!safe(right))return {ok:false,reason:'plan_money_invalid'};
  const cents=BigInt(left)-BigInt(right);
  return cents>MAX||cents < -MAX?{ok:false,reason:'plan_money_overflow'}:{ok:true,totalCents:Number(cents)};
}
export function planShare(numeratorCents,denominatorCents){
  if(!safe(numeratorCents)||!safe(denominatorCents)||numeratorCents<0||denominatorCents<0||numeratorCents>denominatorCents)
    return {ok:false,reason:'plan_share_values'};
  if(denominatorCents===0)return {ok:true,status:'unavailable_zero_denominator',numeratorCents,denominatorCents};
  const n=BigInt(numeratorCents)*10000n,d=BigInt(denominatorCents);
  const rounded=n/d+((n%d)*2n>=d?1n:0n);
  return {ok:true,status:'available',numeratorCents,denominatorCents,hundredthsPercent:Number(rounded),
    display:`${rounded/100n}.${String(rounded%100n).padStart(2,'0')}%`};
}

/** Not raw user/model prose. Constructed only after the complete request audit. */
export function boundPlanQuestion(query,range){
  return `Total recorded spending from ${range.start} to ${range.end}. Filters: ${JSON.stringify({category:query.category,categories:query.categories,
    description:query.description,descriptionTerms:query.descriptionTerms,day:query.day,amountOperator:query.amountOperator,amount:query.amount})}`;
}

/** Pure synchronous atomic execution, called only after whole-request validation. */
export function executePlan(raw,context={}){
  const message=typeof context.message==='string'?context.message:'';
  const reject=reason=>({kind:'clarify',...planFailure(reason,message)});
  let snapshot;
  try { snapshot=structuredClone({expenses:context.expenses??[],cats:context.cats??[],today:context.today}); }
  catch {return reject('plan_snapshot_invalid');}
  if(!Array.isArray(snapshot.expenses)||!Array.isArray(snapshot.cats))return reject('plan_snapshot_invalid');
  const rowsById=new Map();
  for(const row of snapshot.expenses){
    if(!row||!['string','number'].includes(typeof row.id)||(typeof row.id==='string'?!row.id.length:!safe(row.id)))return reject('plan_record_id');
    if(typeof row.date!=='string'||typeof row.description!=='string'||(row.category!=null&&typeof row.category!=='string'))return reject('plan_record_shape');
    if(rowsById.has(row.id)&&stable(rowsById.get(row.id))!==stable(row))return reject('plan_conflicting_record_id');
    rowsById.set(row.id,row);
  }
  snapshot.expenses=[...rowsById.values()];freeze(snapshot);
  const checked=validatePlan(raw,{...snapshot,message});
  if(!checked.ok)return {kind:'clarify',...checked};
  const audit=auditPlanRequest(checked.plan,{...snapshot,message});
  if(!audit.ok)return {kind:'clarify',...audit};
  const {plan,ranges}=checked,base=[];let memberships=0;
  const selectedIds=new Set();
  for(const [i,step]of plan.steps.entries()){
    const query=validateQuery(step.query,snapshot.cats).query;
    if(query.categories.length===1&&unmatchedSubject({...query,category:query.categories[0]},snapshot.expenses,snapshot.cats)?.kind==='clarify')return reject('plan_base_clarification');
    const scope={...ranges[i],start:query.period==='all'?'1900-01-01':ranges[i].start,
      category:query.category,categories:query.categories,description:query.description,descriptionTerms:query.descriptionTerms,
      day:query.day,amountOperator:query.amountOperator,amountCents:query.amountCents,deduplicate:true};
    // Validate money/currency before applying a monetary threshold. NaN or a
    // foreign nominal amount must not silently vanish through that comparison.
    const candidates=matchingRows(snapshot.expenses,{...scope,amountOperator:null,amountCents:null});
    for(const row of candidates){
      if(row.currency!=null&&row.currency!=='SGD')return reject('plan_currency_unsupported');
      if((typeof row.amount!=='number'&&!(typeof row.amount==='string'&&/^\d+(?:\.\d+)?$/.test(row.amount)))||
        !Number.isFinite(Number(row.amount))||Number(row.amount)<0||!safe(toCents(row.amount))||!validDate(row.date))return reject('plan_record_amount');
    }
    const rows=matchingRows(snapshot.expenses,scope);
    let total=0n;
    for(const row of rows){
      total+=BigInt(toCents(row.amount));selectedIds.add(row.id);
    }
    if(total>MAX)return reject('plan_money_overflow');
    memberships+=rows.length;
    if(memberships>PLAN_LIMITS.memberships||selectedIds.size>PLAN_LIMITS.matchedRows)return reject('plan_evidence_limit');
    const answer=executeQuery(step.query,{...snapshot,message:boundPlanQuestion(step.query,ranges[i])});
    if(answer.kind!=='answer'||!answer.evidence)return reject('plan_base_clarification');
    if(stable(answer.evidence.rows.map(r=>[r.id,r.amount]))!==stable(rows.map(r=>[r.id,r.amount])))return reject('plan_base_evidence_mismatch');
    const evidence=captureEvidence(rows,{cats:snapshot.cats,categoryIds:[query.category,...query.categories].filter(Boolean),
      scope:{...answer.evidence.scope,deduplicate:true}});
    base.push({id:step.id,heading:`${step.id}: Recorded total`,query:step.query,scope:evidence.scope,range:ranges[i],
      unit:PLAN_MONEY_UNIT,totalCents:Number(total),count:rows.length,evidence,interpretation:answer.interpretation,
      detail:answer.detail,provenance:{source:'application_calculation',referenceDate:snapshot.today}});
  }
  const byId=new Map(base.map(b=>[b.id,b])),derived=[];
  for(const node of plan.derived){
    const roles=node.operation==='difference'?['left','right']:['numerator','denominator'];
    const parts=roles.map(r=>byId.get(node[r].step));
    if(node.operation==='percent_of'){
      const ids=new Set(parts[1].evidence.rows.map(r=>r.id));
      if(parts[0].evidence.rows.some(r=>!ids.has(r.id)))return reject('plan_share_evidence');
    }
    const value=node.operation==='difference'?planDifference(parts[0].totalCents,parts[1].totalCents):planShare(parts[0].totalCents,parts[1].totalCents);
    if(!value.ok)return reject(value.reason);
    const {ok:ignored,...calculation}=value;
    derived.push({id:node.id,operation:node.operation,heading:node.operation==='difference'?`${node.left.step} less ${node.right.step}`:`${node.numerator.step} share of ${node.denominator.step}`,
      unit:node.operation==='difference'?PLAN_MONEY_UNIT:{kind:'percentage',scale:'hundredth_percent'},...calculation,
      provenance:{source:'application_calculation',dependencies:parts.map(p=>p.id),
        inputs:Object.fromEntries(roles.map((role,i)=>[role,{reference:{...node[role]},unit:parts[i].unit,totalCents:parts[i].totalCents,evidenceStep:parts[i].id}])),
        formula:node.operation==='difference'?'left - right':'numerator / denominator × 100',
        rounding:node.operation==='difference'?'exact integer cents':'two decimal percent, half away from zero; base cents unchanged'}});
  }
  const metadata={referenceDate:snapshot.today,base:base.map(({evidence,...b})=>b),derived};
  if(jsonBytes(metadata)>PLAN_LIMITS.metadataBytes||[...base,...derived].some(b=>b.heading.length>PLAN_LIMITS.headingLength))return reject('plan_output_limit');
  return freeze({kind:'plan_answer',version:1,referenceDate:snapshot.today,plan,family:audit.family,base,derived,
    provenance:{source:'application_calculation',snapshot:'one immutable local ledger',metadataBytes:jsonBytes(metadata),matchedRows:selectedIds.size,memberships}});
}
