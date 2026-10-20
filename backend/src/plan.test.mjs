import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,validatePlanIntent,buildPlanSchema,buildPlanIntentSchema,planQuery,planRef,planScopeContains} from '../../src/lib/planContract.js';
import {recognizePlanRequest,auditPlanRequest,guardPlanResponse} from '../../src/lib/planRequest.js';
import {validateIntent} from '../../src/lib/intent.js';
import {buildSchema} from './provider.js';
import {planContext,sharePlan,differencePlan,FOOD_REQUEST,DIFFERENCE_REQUEST,LITERAL_REQUEST} from '../../scripts/plan-fixture.js';
const ctx=planContext(),clone=x=>structuredClone(x);
const intent=plan=>({type:'plan',plan,say:null,query:null,expense:null,filter:null,scope:null,question:null,options:null});
const schemas=[buildPlanSchema(ctx.cats.map(c=>c.id)),buildPlanIntentSchema(ctx.cats.map(c=>c.id))];
function accepts(s,v){
 if(s.anyOf)return s.anyOf.some(a=>accepts(a,v));
 const type=v===null?'null':Array.isArray(v)?'array':typeof v==='number'&&Number.isInteger(v)?'integer':typeof v;
 if(!(Array.isArray(s.type)?s.type:[s.type]).includes(type))return false;
 if(s.enum&&!s.enum.includes(v))return false;
 if(type==='object')return s.required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>s.properties[k]&&accepts(s.properties[k],v[k]));
 if(type==='array')return v.length>=(s.minItems??0)&&v.length<=(s.maxItems??Infinity)&&v.every(x=>accepts(s.items,x));
 if(type==='string')return v.length>=(s.minLength??0)&&v.length<=(s.maxLength??Infinity);
 if(type==='integer')return v>=(s.minimum??-Infinity)&&v<=(s.maximum??Infinity);
 return true;
}
test('plan decoding schema is recursively closed and every field required',()=>{
 const walk=s=>{if(!s||typeof s!=='object')return;if(s.type==='object'){assert.equal(s.additionalProperties,false);assert.deepEqual(s.required.slice().sort(),Object.keys(s.properties).sort());}Object.values(s).forEach(v=>Array.isArray(v)?v.forEach(walk):walk(v));};schemas.forEach(walk);
});
for(const [name,p,message] of [['share',sharePlan(),FOOD_REQUEST],['difference',differencePlan(),DIFFERENCE_REQUEST],['literal',sharePlan({period:'last_days',dayCount:90},{description:'Amazon'}),LITERAL_REQUEST]]){
 test('plan schema and independent Node server/client round-trip '+name,()=>{
  assert.equal(accepts(schemas[0],p),true);assert.equal(accepts(schemas[1],intent(p)),true);
  const checked=validatePlanIntent(intent(p),{...ctx,message});assert.equal(checked.ok,true);
  assert.deepEqual(validatePlanIntent(JSON.parse(JSON.stringify(checked.intent)),{...ctx,message}),checked);
  assert.equal(auditPlanRequest(checked.intent.plan,{...ctx,message}).ok,true);
 });
}
for(const [name,change]of [
 ['extra top field',p=>p.totalCents=4000],['model label',p=>p.steps[0].label='foo'],['derived cents from model',p=>p.steps[0].query.amountCents=null],
 ['missing required query field',p=>delete p.steps[0].query.amount],['unknown category',p=>p.steps[1].query.category='fictional-invalid'],
 ['q ID gap',p=>p.steps[1].id='q3'],['duplicate ID',p=>p.steps[1].id='q1'],['d ID gap',p=>p.derived[0].id='d2'],
 ['forward unknown reference',p=>p.derived[0].numerator.step='q4'],['self reference',p=>p.derived[0].numerator.step='d1'],
 ['non-money field',p=>p.derived[0].numerator.field='count'],['invented unit',p=>p.derived[0].numerator.unit='count'],
 ['duplicate query',p=>p.steps[1].query=clone(p.steps[0].query)],['duplicate derived',p=>p.derived.push({...clone(p.derived[0]),id:'d2'})],
 ['scope bypass',p=>p.steps[0].query.spendingScope={label:null,includeCategories:[],includeTerms:[],excludeCategories:[],excludeTerms:[]}],
 ['comparison side',p=>p.steps[0].query.comparison={kind:'categories',categories:['meal-p','transit-p'],periods:[]}],
 ['different period',p=>p.steps[1].query.period='lastmonth'],['overlap sum',p=>p.derived[0].operation='sum'],
 ['third derived',p=>p.derived.push({...clone(p.derived[0]),id:'d2'},{...clone(p.derived[0]),id:'d3'})],
 ['incompatible count',p=>p.steps[1].query.operation='count'],
])test('plan validation rejects '+name,()=>{const p=sharePlan();change(p);assert.equal(validatePlan(p,ctx).ok,false);});
test('request audit rejects reversed order, omitted parts and invented restrictions',()=>{
 for(const change of [p=>p.derived=[],p=>{[p.derived[0].numerator,p.derived[0].denominator]=[p.derived[0].denominator,p.derived[0].numerator];},p=>p.steps[0].query.day='weekday']){
 const p=sharePlan();change(p);const v=validatePlan(p,ctx);assert.equal(v.ok&&auditPlanRequest(v.plan,{...ctx,message:FOOD_REQUEST}).ok,false);
 }
});
test('static containment does not use accidentally contained ledger rows',()=>{
 assert.equal(planScopeContains(planQuery({category:'transit-p'}),planQuery({category:'meal-p'})),false);
 const p=sharePlan();p.steps[0].query.description='Orchard';assert.equal(validatePlan(p,{...ctx,expenses:[]}).ok,false);
});
test('category conjunctions, duplicate aliases and quoted terms are never dropped',()=>{
 const c={...ctx,cats:ctx.cats.map(c=>c.id==='meal-p'?{...c,label:'Paint and Paper'}:c)};
 assert.equal(recognizePlanRequest(FOOD_REQUEST.replace('Food & Drinks','Paint and Paper'),c).ok,true);
 assert.equal(recognizePlanRequest(FOOD_REQUEST.replace('Food & Drinks','Food'),{...ctx,cats:[...ctx.cats,{id:'dup',label:'Food'}]}).ok,false);
 const q=recognizePlanRequest('What share of this month spending was at "Food & Drinks"?',ctx);assert.equal(q.ok,true);assert.equal(q.plan.steps[1].query.category,null);assert.equal(q.plan.steps[1].query.description,'Food & Drinks');
});
test('generated tokens are protected from adversarial configured token-like labels',()=>{
 const c={...ctx,cats:[...ctx.cats,{id:'token-t',label:'t0'},{id:'token-c',label:'c0'}]};
 assert.equal(recognizePlanRequest('What share of this month spending was at "Amazon"?',c).ok,true);
 assert.equal(recognizePlanRequest(FOOD_REQUEST,c).ok,true);
 assert.equal(recognizePlanRequest('What share of total spending was at Amazon?',{...ctx,cats:[...ctx.cats,{id:'total',label:'total'}]}).ok,false);
 assert.equal(recognizePlanRequest('What share of this month spending was at Amazon?',{...ctx,cats:[...ctx.cats,{id:'calendar',label:'This month'}]}).ok,false);
});
test('whole-request guard remains exported only; live ordinary contracts unchanged',()=>{
 assert.equal(guardPlanResponse(FOOD_REQUEST,{type:'analyze'},ctx).handled,true);
 for(const m of ['Total Food and Transit spending this month.','Compare spending in September with July.'])assert.deepEqual(guardPlanResponse(m,{type:'analyze'},ctx),{handled:false});
 assert.equal(buildSchema(ctx.cats.map(c=>c.id)).properties.type.enum.includes('plan'),false);
 assert.equal(validateIntent(intent(sharePlan()),{cats:ctx.cats}).ok,false);
 assert.equal(validateIntent({type:'analyze',query:{operation:'total',period:'month',category:'meal-p'}},{cats:ctx.cats}).ok,true);
});
test('malformed context and cyclic instructions reject without throwing',()=>{
 for(const c of [{...ctx,cats:null},{...ctx,cats:[{id:'x',label:3}]},{...ctx,expenses:null}])assert.equal(validatePlan(sharePlan(),c).ok,false);
 const p=sharePlan();p.loop=p;assert.equal(validatePlan(p,ctx).ok,false);
});
test('independent requested totals never inherit a first part merchant/day/amount',()=>{
 const message='Show my total spending at least S$10 and my Transit spending, then total minus Transit.';
 const parsed=recognizePlanRequest(message,ctx);assert.equal(parsed.ok,true);
 assert.equal(parsed.plan.steps[0].query.amount,'10');assert.equal(parsed.plan.steps[1].query.amount,null);
 const p=differencePlan();for(const s of p.steps){s.query.amountOperator='gte';s.query.amount='10';}
 assert.equal(auditPlanRequest(validatePlan(p,ctx).plan,{...ctx,message}).ok,false);
 assert.equal(recognizePlanRequest(message.replace('total minus Transit','the difference'),ctx).ok,false);
 const literal='Show my total spending at Amazon and my Transit spending, then total minus Transit.';
 const r=recognizePlanRequest(literal,ctx);assert.equal(r.ok,true);assert.equal(r.plan.steps[1].query.description,null);
});
test('calendar/day and grammar category names require clarification rather than an invented scope',()=>{
 for(const label of ['Monday','on weekdays','This year','last 90 days','My spending','March 2027'])assert.equal(recognizePlanRequest('What share of my spending this year on Monday was at Amazon?',{...ctx,cats:[...ctx.cats,{id:'ambiguous',label}]}).ok,label==='last 90 days'||label==='on weekdays'||label==='March 2027');
});
test('comparison-only show wording keeps the existing comparison path',()=>{
 assert.deepEqual(guardPlanResponse('Show a comparison of Food spending and Transit spending this month.',{type:'analyze'},ctx),{handled:false});
});
test('required query fields cannot normalise away undefined or sparse filter members',()=>{
 const undefinedPeriod=sharePlan();undefinedPeriod.steps[0].query.period=undefined;
 assert.equal(validatePlan(undefinedPeriod,ctx).ok,false);
 for(const key of ['categories','descriptionTerms','category_terms']){const p=sharePlan();p.steps[0].query[key]=Array(1);assert.equal(validatePlan(p,ctx).ok,false);}
 const malformed=sharePlan();malformed.derived[0].operation=42;assert.equal(validatePlan(malformed,ctx).kind,'invalid');
});
