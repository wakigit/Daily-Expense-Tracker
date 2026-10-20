import { generalQuerySchema, providerQuerySchemas, validateQuery, validDate } from './queryContract.js';
import { resolveQueryRange } from './queryDates.js';
import { categoryNames } from './categoryVocabulary.js';
import { normaliseScopeText } from './filterMatching.js';

/** Shared bounded plan contract, validated on both sides of the transport. */
export const PLAN_LIMITS = Object.freeze({steps:4, derived:2, instructionBytes:16384,
  metadataBytes:16384, matchedRows:10000, memberships:20000, headingLength:160});
export const PLAN_MONEY_UNIT = Object.freeze({kind:'money',currency:'SGD',scale:'cents'});
export const validPlanCategories = cats => Array.isArray(cats)&&cats.every(c=>c&&typeof c.id==='string'&&c.id.length&&typeof c.label==='string'&&c.label.trim())&&new Set(cats.map(c=>c.id)).size===cats.length;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
  && [Object.prototype,null].includes(Object.getPrototypeOf(v));
const keys = (v, wanted) => object(v) && Object.keys(v).length === wanted.length
  && wanted.every(k => Object.hasOwn(v,k));
export function jsonBytes(value) {
  try { const s=JSON.stringify(value); return typeof s==='string'?new TextEncoder().encode(s).length:Infinity; }
  catch { return Infinity; }
}
export function planFailure(reason, message='', kind='clarify', field=null) {
  return {ok:false,kind,reason,...(field?{field}:{}),question:
    `I cannot safely answer this complete multi-part request. Please give the requested totals, one common period, and the exact share or subtraction to calculate. Nothing has been calculated.${message?` Your original request: “${message}”`:''}`};
}
export const planQuery = patch => ({operation:'total',period:'month',start:null,end:null,
  dayCount:null,category:null,categories:[],description:null,descriptionTerms:[],
  amountOperator:null,amount:null,day:'all',groupBy:null,aggregate:'total',
  comparison:null,spendingScope:null,category_terms:[],...patch});
export const planRef = step => ({step,field:'totalCents'});

/** Full existing provider query fields, with derived cents deliberately absent. */
export function canonicalPlanQuery(raw,cats) {
  const required=generalQuerySchema({type:['string','null'],enum:[...cats.map(c=>c.id),null]}).required;
  if(!keys(raw,required)||required.some(k=>raw[k]===undefined)||['categories','descriptionTerms','category_terms'].some(k=>Array.isArray(raw[k])&&Object.keys(raw[k]).length!==raw[k].length))return planFailure('plan_query_fields','','invalid','query');
  const checked=validateQuery(raw,cats);
  if(!checked.ok)return planFailure('plan_query_invalid','',checked.limitation?'clarify':'invalid',checked.field);
  const q=checked.query;
  if(q.operation!=='total'||q.aggregate!=='total'||q.groupBy!==null||raw.comparison!==null||raw.spendingScope!==null)
    return planFailure('plan_operation_unsupported');
  const selected=[q.category,...q.categories].filter(Boolean);
  if(q.categoryTerms.some(t=>!cats.some(c=>selected.includes(c.id)&&categoryNames(c).some(n=>normaliseScopeText(n)===normaliseScopeText(t)))))
    return planFailure('plan_category_metadata');
  const {amountCents:ignored,categoryTerms,...query}=q;
  return {ok:true,query:{...query,category_terms:categoryTerms}};
}
/** Financial scope only. Metadata is not independent semantic evidence. */
export function planScopeKey(q) {
  return JSON.stringify({period:q.period,start:q.start,end:q.end,dayCount:q.dayCount,
    categories:[...new Set([q.category,...q.categories].filter(Boolean))].sort(),
    description:q.description?.toLocaleLowerCase('en-SG')??null,descriptionTerms:q.descriptionTerms,
    day:q.day,amountOperator:q.amountOperator,amount:q.amount===null?null:Math.round(Number(q.amount)*100)});
}
export function planScopeContains(denominator,numerator) {
  const categorySet=q=>[q.category,...q.categories].filter(Boolean);
  const d=categorySet(denominator),n=categorySet(numerator);
  if(d.length&&(!n.length||n.some(id=>!d.includes(id))))return false;
  if((denominator.description||denominator.descriptionTerms.length)&&
    JSON.stringify([denominator.description?.toLocaleLowerCase('en-SG')??null,denominator.descriptionTerms])!==
    JSON.stringify([numerator.description?.toLocaleLowerCase('en-SG')??null,numerator.descriptionTerms]))return false;
  if(denominator.day!=='all'&&denominator.day!==numerator.day)return false;
  if(denominator.amountOperator&&(denominator.amountOperator!==numerator.amountOperator||
    Math.round(Number(denominator.amount)*100)!==Math.round(Number(numerator.amount)*100)))return false;
  return true;
}

export function validatePlan(raw,{cats=[],today,expenses=[],message=''}={}) {
  const fail=(r,k='invalid',f=null)=>planFailure(r,message,k,f);
  if(!validPlanCategories(cats)||!Array.isArray(expenses))return fail('plan_context');
  if(jsonBytes(raw)>PLAN_LIMITS.instructionBytes)return fail('plan_instruction_limit');
  if(!keys(raw,['version','steps','derived'])||raw.version!==1)return fail('plan_structure');
  if(!Array.isArray(raw.steps)||raw.steps.length<1||raw.steps.length>PLAN_LIMITS.steps||
    !Array.isArray(raw.derived)||raw.derived.length>PLAN_LIMITS.derived||raw.steps.length+raw.derived.length<2)return fail('plan_result_limit');
  if(!validDate(today))return fail('plan_reference_date');
  const steps=[],ranges=[],seen=new Set();
  for(const [i,step]of raw.steps.entries()){
    if(!keys(step,['id','query'])||step.id!==`q${i+1}`)return fail('plan_step_id');
    const c=canonicalPlanQuery(step.query,cats);
    if(!c.ok)return {...c,question:planFailure(c.reason,message,c.kind).question};
    const key=planScopeKey(c.query);
    if(seen.has(key))return fail('plan_redundant_step','clarify');
    seen.add(key);
    const range=resolveQueryRange(c.query,today,expenses);
    if(!validDate(range.start)||!validDate(range.end)||range.start>range.end)return fail('plan_range','clarify');
    if(ranges.length&&JSON.stringify(range)!==JSON.stringify(ranges[0]))return fail('plan_common_range','clarify');
    ranges.push(range);steps.push({id:step.id,query:c.query});
  }
  const validRef=ref=>keys(ref,['step','field'])&&ref.field==='totalCents'&&steps.some(s=>s.id===ref.step);
  const derived=[],derivedKeys=new Set();
  for(const [i,node]of raw.derived.entries()){
    if(!object(node)||node.id!==`d${i+1}`)return fail('plan_derived_id');
    const op=node.operation;
    if(!['difference','percent_of'].includes(op))return fail('plan_derived_operation',['sum','ratio'].includes(op)?'clarify':'invalid');
    const roles=op==='difference'?['left','right']:['numerator','denominator'];
    if(!keys(node,['id','operation',...roles])||roles.some(r=>!validRef(node[r])))return fail('plan_reference');
    const derivedKey=JSON.stringify([op,...roles.map(r=>node[r].step)]);
    if(derivedKeys.has(derivedKey))return fail('plan_redundant_derived','clarify');
    derivedKeys.add(derivedKey);
    if(op==='percent_of'&&!planScopeContains(steps.find(s=>s.id===node.denominator.step).query,
      steps.find(s=>s.id===node.numerator.step).query))return fail('plan_share_scope','clarify');
    derived.push({id:node.id,operation:op,...Object.fromEntries(roles.map(r=>[r,{...node[r]}]))});
  }
  const plan={version:1,steps,derived};
  if(jsonBytes(plan)>PLAN_LIMITS.instructionBytes)return fail('plan_instruction_limit');
  return {ok:true,plan,ranges};
}

/** Closed total-only schema, selected only for recognised bounded multipart requests. */
export function buildPlanSchema(categoryIds=[]) {
  const category={type:['string','null'],enum:[...categoryIds,null]};
  const variants=providerQuerySchemas(category).filter(q=>q.properties.comparison.type==='null');
  for(const query of variants){
    query.properties.operation={type:'string',enum:['total']};
    query.properties.aggregate={type:'string',enum:['total']};
    for(const k of ['groupBy','comparison','spendingScope'])query.properties[k]={type:'null'};
    query.properties.category_terms={type:'array',maxItems:8,items:{type:'string',minLength:1,maxLength:80}};
    if(query.properties.description.type!=='null')query.properties.description={...query.properties.description,minLength:1,maxLength:100};
  }
  const query={anyOf:variants};
  const ref={type:'object',additionalProperties:false,required:['step','field'],properties:{
    step:{type:'string',enum:['q1','q2','q3','q4']},field:{type:'string',enum:['totalCents']}}};
  const node=(op,roles)=>({type:'object',additionalProperties:false,required:['id','operation',...roles],properties:{
    id:{type:'string',enum:['d1','d2']},operation:{type:'string',enum:[op]},...Object.fromEntries(roles.map(r=>[r,ref]))}});
  return {type:'object',additionalProperties:false,required:['version','steps','derived'],properties:{
    version:{type:'integer',enum:[1]},steps:{type:'array',minItems:1,maxItems:4,items:{type:'object',additionalProperties:false,required:['id','query'],properties:{id:{type:'string',enum:['q1','q2','q3','q4']},query}}},
    derived:{type:'array',maxItems:2,items:{anyOf:[node('difference',['left','right']),node('percent_of',['numerator','denominator'])]}}}};
}
export function buildPlanIntentSchema(categoryIds=[]) {
  const inactive=['say','query','expense','filter','scope','question','options'];
  return {type:'object',additionalProperties:false,required:['type','plan',...inactive],properties:{
    type:{type:'string',enum:['plan']},plan:buildPlanSchema(categoryIds),...Object.fromEntries(inactive.map(k=>[k,{type:'null'}]))}};
}
export function validatePlanIntent(raw,context) {
  const inactive=['say','query','expense','filter','scope','question','options'];
  if(!keys(raw,['type','plan',...inactive])||raw.type!=='plan'||inactive.some(k=>raw[k]!==null))return planFailure('plan_intent_structure',context?.message,'invalid');
  const checked=validatePlan(raw.plan,context);
  return checked.ok?{ok:true,intent:{type:'plan',plan:checked.plan,...Object.fromEntries(inactive.map(k=>[k,null]))}}:checked;
}
