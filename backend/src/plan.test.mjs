import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,validatePlanIntent,buildPlanSchema,buildPlanIntentSchema,planQuery,planRef,planScopeContains,PLAN_REASONS,planDiagnostic} from '../../src/lib/planContract.js';
import {INTENT_LIMITATION,limitationClarification} from '../../src/lib/intentLimitations.js';
import {recognizePlanRequest,auditPlanRequest,guardPlanResponse,isCompleteBreakdownAnswer} from '../../src/lib/planRequest.js';
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
test('whole-request helper and ordinary decoder retain comparison boundaries',()=>{
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
/* Regression for a live defect: the model may legitimately encode ONE literal
   description term as the `descriptionTerms` list while the local recognizer
   writes the equivalent scalar `description`. Both select rows through the
   same normalised case-insensitive substring match, so they are one scope.
   Comparing the raw fields rejected a fully supported question, and it also
   failed to notice two identical steps written two ways. Fictional data below
   is new and independent of the evaluation fixture. */
test('one literal description term has one scope identity in either encoding',()=>{
 const cats=[{id:'canteen',label:'Canteen Meals'},{id:'busmrt',label:'Bus & MRT'}];
 const base={cats,today:'2026-11-10',expenses:[
  {id:'n1',date:'2026-11-03',category:'canteen',description:'Chicken rice at North Spine',amount:5.5,notes:''},
  {id:'n2',date:'2026-11-06',category:'busmrt',description:'EZ-Link top up',amount:20,notes:''},
  {id:'n3',date:'2026-11-09',category:'canteen',description:'Popular bookstore snack run',amount:6,notes:''}]};
 const message='What share of last 90 days spending was at "Popular bookstore"?';
 const scalar=recognizePlanRequest(message,base);
 assert.equal(scalar.ok,true);
 assert.equal(scalar.plan.steps[1].query.description,'Popular bookstore');
 // The same plan with the list encoding the live model actually returned.
 const asList=structuredClone(scalar.plan);
 asList.steps[1].query.description=null;
 asList.steps[1].query.descriptionTerms=['Popular bookstore'];
 const checked=validatePlan(asList,{...base,message});
 assert.equal(checked.ok,true);
 assert.equal(auditPlanRequest(checked.plan,{...base,message}).ok,true);
 // Casing and term order are immaterial to the same OR scope.
 const recased=structuredClone(asList);
 recased.steps[1].query.descriptionTerms=['  popular   BOOKSTORE '];
 assert.equal(auditPlanRequest(validatePlan(recased,{...base,message}).plan,{...base,message}).ok,true);
 // And the whole-request guard stops rejecting the supported question.
 assert.deepEqual(guardPlanResponse(message,{type:'plan',plan:asList},base),{handled:false});
});
test('the same step written two ways is still one redundant step',()=>{
 const cats=[{id:'canteen',label:'Canteen Meals'}];
 const base={cats,today:'2026-11-10',expenses:[]};
 const duplicate={version:1,steps:[
  {id:'q1',query:planQuery({description:'North Spine'})},
  {id:'q2',query:planQuery({descriptionTerms:['north spine']})}],
  derived:[{id:'d1',operation:'difference',left:planRef('q1'),right:planRef('q2')}]};
 const result=validatePlan(duplicate,base);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'plan_redundant_step');
});
test('share containment survives a mixed description encoding',()=>{
 const denominator=planQuery({description:'Popular bookstore'});
 const numerator=planQuery({descriptionTerms:['Popular Bookstore'],category:'canteen'});
 assert.equal(planScopeContains(denominator,numerator),true);
 assert.equal(planScopeContains(denominator,planQuery({descriptionTerms:['Other shop']})),false);
 assert.equal(planScopeContains(denominator,planQuery({})),false);
});

/* Regression for M69: the anti-partial guard refuses a NARROWER answer, not
   every ordinary one. A complete breakdown discloses every group and
   recombines to the grand total, so it answers the whole question. Refusing it
   had silently broken "what share went to each category?", a capability that
   worked before bounded plans existed. New fictional rows below. */
const SPLIT_CATS=[{id:'kopi',label:'Kopi Runs'},{id:'print',label:'Printing'},{id:'shuttle',label:'Shuttle'}];
const SPLIT_CTX={cats:SPLIT_CATS,today:'2026-11-10'};
const splitQuery=(patch={})=>({operation:'breakdown',period:'month',start:null,end:null,dayCount:null,category:null,
 description:null,amountOperator:null,amount:null,day:'all',groupBy:'category',aggregate:'total',comparison:null,
 categories:[],descriptionTerms:[],spendingScope:null,category_terms:[],...patch});
const analyzeIntent=query=>({type:'analyze',query,say:null,plan:null,expense:null,filter:null,scope:null,question:null,options:null});
const SPLIT_MESSAGE='What share of my spending this month went to each category?';

test('a complete breakdown answers a recognised share question',()=>{
 for(const query of [splitQuery(),splitQuery({groupBy:'month',period:'year'})]){
  const checked=validateIntent(analyzeIntent(query),{...SPLIT_CTX,message:SPLIT_MESSAGE});
  assert.equal(checked.ok,true);
  assert.equal(checked.intent.type,'analyze');
  assert.equal(checked.intent.query.operation,'breakdown');
 }
 assert.deepEqual(guardPlanResponse(SPLIT_MESSAGE,analyzeIntent(splitQuery()),SPLIT_CTX),{handled:false});
});

test('a narrowed breakdown is still a silently narrower answer and still clarifies',()=>{
 /* Each of these recombines to a NARROWER total than the question asked about. */
 for(const patch of [{category:'kopi'},{categories:['kopi','print']},{description:'kopi'},
   {descriptionTerms:['kopi']},{amountOperator:'gt',amount:'5'},{day:'weekday'}]){
  const query=splitQuery(patch);
  assert.equal(isCompleteBreakdownAnswer({...query,categoryTerms:[],amountCents:null}),false,JSON.stringify(patch));
  const checked=validateIntent(analyzeIntent(query),{...SPLIT_CTX,message:SPLIT_MESSAGE});
  assert.equal(checked.ok,true,JSON.stringify(patch));
  assert.equal(checked.intent.type,'clarify',JSON.stringify(patch));
  assert.equal(checked.intent.reason,'plan_complete_request_required');
  assert.equal(guardPlanResponse(SPLIT_MESSAGE,analyzeIntent(query),SPLIT_CTX).handled,true);
 }
});

test('a one-sided total for a recognised share question still clarifies with no figure',()=>{
 for(const [message,query] of [
   [SPLIT_MESSAGE,splitQuery({operation:'total',groupBy:null})],
   ['What did I spend this month, and what percentage was Kopi Runs?',splitQuery({operation:'total',groupBy:null,category:'kopi',category_terms:['Kopi Runs']})],
   ['What share of last 90 days spending was at "Campus shuttle"?',splitQuery({operation:'total',groupBy:null,period:'last_days',dayCount:90})]]){
  const checked=validateIntent(analyzeIntent(query),{...SPLIT_CTX,message});
  assert.equal(checked.ok,true,message);
  assert.equal(checked.intent.type,'clarify',message);
  assert.ok(!/\d/.test(checked.intent.question.replace(/\u201c[^\u201d]*\u201d/g,'')),'no figure may appear outside the quoted original request');
  assert.equal(guardPlanResponse(message,analyzeIntent(query),SPLIT_CTX).handled,true);
 }
});

test('an unparseable multipart share question still clarifies rather than answering one side',()=>{
 const message='What share of my spending this month went to each category, and what was my biggest single purchase?';
 assert.equal(recognizePlanRequest(message,SPLIT_CTX).recognized,true);
 assert.equal(recognizePlanRequest(message,SPLIT_CTX).ok,false);
 const narrowed=validateIntent(analyzeIntent(splitQuery({operation:'largest',groupBy:null})),{...SPLIT_CTX,message});
 assert.equal(narrowed.intent.type,'clarify');
});

/* A refused plan keeps its reason to itself in the REPLY and records it beside
   it, so the server has evidence of its own decision. The value is a fixed
   identifier from a closed list; nothing a caller or a model supplies can
   become one. New fictional vocabulary below. */
const DIAG_CATS=[{id:'ink',label:'Ink & Paper'},{id:'tram',label:'Tram Pass'}];
const DIAG_CTX={cats:DIAG_CATS,today:'2027-06-09'};
const DIAG_MESSAGE='what share of my last 30 days spending was at "Quill corner"?';
const diagStep=(patch={})=>planQuery({period:'last_days',dayCount:30,...patch});
const diagIntent=plan=>({type:'plan',plan,say:null,query:null,expense:null,filter:null,scope:null,question:null,options:null});
const diagPlan=(q1,q2,derived)=>({version:1,steps:[{id:'q1',query:q1},{id:'q2',query:q2}],
 derived:derived??[{id:'d1',operation:'percent_of',numerator:planRef('q2'),denominator:planRef('q1')}]});

test('planDiagnostic only ever returns a code from the closed list',()=>{
 for(const reason of PLAN_REASONS) assert.equal(planDiagnostic(reason),reason);
 /* Anything else is information lost, never information leaked. */
 for(const hostile of ['Quill corner','plan_','1234','plan_request_coverage ',
   'Ink & Paper',null,undefined,42,{},['plan_request_coverage'],'__proto__'])
  assert.equal(planDiagnostic(hostile),null,JSON.stringify(hostile));
 assert.equal(new Set(PLAN_REASONS).size,PLAN_REASONS.length);
 assert.ok(PLAN_REASONS.every(r=>/^plan_[a-z_]+$/.test(r)));
 assert.equal(PLAN_REASONS.includes('plan_complete_request_required'),false,
  'the user-facing limitation reason is not an internal diagnostic code');
});

test('a refused plan reports its specific reason beside an unchanged clarification',()=>{
 const expected=limitationClarification(INTENT_LIMITATION.PLAN,DIAG_MESSAGE);
 for(const [code,plan] of [
   ['plan_request_coverage',diagPlan(diagStep(),diagStep({descriptionTerms:['Quill']}))],
   ['plan_common_range',diagPlan(diagStep(),planQuery({period:'range',start:'2027-05-01',end:'2027-05-31',descriptionTerms:['Quill corner']}))],
   ['plan_redundant_step',diagPlan(diagStep({descriptionTerms:['Quill corner']}),diagStep({description:'Quill corner'}))],
   ['plan_derived_operation',diagPlan(diagStep(),diagStep({descriptionTerms:['Quill corner']}),
     [{id:'d1',operation:'sum',left:planRef('q1'),right:planRef('q2')}])],
   ['plan_share_scope',diagPlan(diagStep({descriptionTerms:['Quill corner']}),diagStep({category:'ink',category_terms:['Ink & Paper']}))],
 ]) {
  const checked=validateIntent(diagIntent(plan),{...DIAG_CTX,message:DIAG_MESSAGE});
  assert.equal(checked.ok,true,code);
  assert.deepEqual(checked.intent,expected,`${code} must not change one character of the clarification`);
  assert.deepEqual(checked.diagnostic,{plan:code},code);
 }
 /* A plan the contract rejects as INVALID rather than clarifying is still a
    502 with no semantic clarification and so no plan diagnostic. */
 const structural=validateIntent(diagIntent({version:1,steps:[{id:'q1',query:diagStep()}],derived:[]}),{...DIAG_CTX,message:DIAG_MESSAGE});
 assert.equal(structural.ok,false);
 assert.equal(structural.error.code,'intent_bad_field');
 assert.equal(structural.diagnostic,undefined);
 /* An accepted plan carries none, and neither does a non-plan refusal. */
 const accepted=validateIntent(diagIntent(diagPlan(diagStep(),diagStep({descriptionTerms:['Quill corner']}))),{...DIAG_CTX,message:DIAG_MESSAGE});
 assert.equal(accepted.intent.type,'plan');
 assert.equal(accepted.diagnostic,undefined);
 const oneSided=validateIntent({type:'analyze',query:planQuery({period:'last_days',dayCount:30}),say:null,plan:null,expense:null,filter:null,scope:null,question:null,options:null},{...DIAG_CTX,message:DIAG_MESSAGE});
 assert.equal(oneSided.intent.type,'clarify');
 assert.equal(oneSided.diagnostic,undefined);
});
