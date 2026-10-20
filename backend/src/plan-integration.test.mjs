import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIntentRequest,requestIntent,buildSchema,MODEL} from './provider.js';
import {handleIntent} from './routes.js';
import {validateIntent} from '../../src/lib/intent.js';
import {planContext,sharePlan,FOOD_REQUEST,DIFFERENCE_REQUEST,LITERAL_REQUEST} from '../../scripts/plan-fixture.js';
import {mockPlanIntent,wrapPlan} from '../../scripts/mocks/plan-intents.js';
const ctx=planContext(),context={today:ctx.today,categories:ctx.cats,expenseCount:6};
// Fail closed: these tests must never contact a real endpoint.
globalThis.fetch=async()=>{throw new Error('FORBIDDEN_REAL_NETWORK');};
for(const question of [FOOD_REQUEST,DIFFERENCE_REQUEST,LITERAL_REQUEST]) {
 test('mock server/client plan round-trip '+question,async()=>{
  let requests=0;
  const reply=await handleIntent({message:question,context},{request:async({message,context})=>{requests++;return mockPlanIntent(message,context);}});
  assert.equal(requests,1);assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'plan');
  const client=validateIntent(reply.body.intent,{...ctx,message:question});
  assert.equal(client.ok,true);assert.deepEqual(client.intent,reply.body.intent);
 });
}
test('bounded routing and request output budgets retain ordinary/comparison decoding',()=>{
 for(const message of [FOOD_REQUEST,DIFFERENCE_REQUEST,LITERAL_REQUEST]) {
  const body=buildIntentRequest({message,context});assert.equal(body.model,MODEL);assert.equal(body.max_output_tokens,4096);
  assert.deepEqual(body.text.format.schema.properties.type.enum,['plan','clarify']);
  assert.ok(!body.input[0].content.includes('Orchard lunch'));
 }
 for(const message of ['Hello','Total Food and Transit spending this month.','Compare spending this month with last month.','Food spending at Amazon']) {
  const body=buildIntentRequest({message,context});assert.equal(body.max_output_tokens,700);assert.equal(body.text.format.schema.properties.type.enum.includes('plan'),false);
 }
 assert.equal(buildIntentRequest({message:'Hello'}).max_output_tokens,700);
 const comparison=buildSchema(ctx.cats.map(c=>c.id),{message:'Compare spending this month with last month.',context});
 assert.ok(comparison.properties.query.anyOf.filter(q=>q.type!=='null').every(q=>q.properties.operation.enum[0]==='compare'));
});
test('SDK stub receives exactly one request, timeout and zero retries',async()=>{
 let calls=0;
 const result=await requestIntent({message:FOOD_REQUEST,context},{client:{responses:{create:async(body,options)=>{
  calls++;assert.equal(body.max_output_tokens,4096);assert.deepEqual(options,{timeout:10000,maxRetries:0});
  return {status:'completed',output_text:JSON.stringify(wrapPlan(sharePlan()))};
 }}}});assert.equal(calls,1);assert.equal(result.type,'plan');
});
test('truncated structured output stays a failure, even with parseable partial text',async()=>{
 await assert.rejects(()=>requestIntent({message:FOOD_REQUEST,context},{client:{responses:{create:async()=>({status:'incomplete',output_text:JSON.stringify(wrapPlan(sharePlan()))})}}}),e=>e.code==='truncated_response');
});
for(const [name,change] of [
 ['extra top-level field',p=>p.totalCents=4000],['extra plan field',p=>p.plan.totalCents=4000],
 ['unknown category',p=>p.plan.steps[1].query.category='missing'],['derived chain',p=>p.plan.derived[0].numerator.step='d1'],
 ['model label',p=>p.plan.steps[0].label='Total'],['conflicting list',p=>p.plan.steps[1].query.categories=['transit-p']],
])test('malformed plan rejected '+name,async()=>{
 const raw=wrapPlan(sharePlan());change(raw);const reply=await handleIntent({message:FOOD_REQUEST,context},{request:async()=>raw});
 assert.equal(reply.status,502);assert.equal(reply.body.error,'invalid_intent');assert.equal(reply.body.detail.field,'plan');
});
for(const [name,change] of [['omitted part',p=>p.derived=[]],['reversed operands',p=>{p.derived[0].numerator.step='q1';p.derived[0].denominator.step='q2';}],['unrequested date',p=>{p.steps.forEach(s=>s.query.period='lastmonth');}]])test('semantic whole-request clarification '+name,async()=>{
 const raw=sharePlan();change(raw);const reply=await handleIntent({message:FOOD_REQUEST,context},{request:async()=>wrapPlan(raw)});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');assert.ok(reply.body.intent.question.includes(FOOD_REQUEST));assert.equal(reply.body.intent.plan,undefined);
 assert.ok(!reply.body.intent.question.includes('plan_'));assert.deepEqual(validateIntent(reply.body.intent,{...ctx,message:FOOD_REQUEST}).intent,reply.body.intent);
});
test('one-sided ordinary total blocked but malformed output stays invalid',async()=>{
 for(const raw of [{type:'analyze',query:{operation:'total',period:'month'}},{type:'answer',query:{metric:'total',period:'month'}}]) {
  const reply=await handleIntent({message:FOOD_REQUEST,context},{request:async()=>raw});assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');
 }
 const reply=await handleIntent({message:FOOD_REQUEST,context},{request:async()=>({type:'analyze',query:{operation:'not_valid'}})});assert.equal(reply.status,502);
});
test('provider/network/auth failures are not rescued as successful plans',async()=>{
 for(const [code,status] of [['provider_timeout',504],['provider_key_rejected',503],['provider_connection_failed',502]]) {
  const reply=await handleIntent({message:FOOD_REQUEST,context},{request:async()=>{throw Object.assign(new Error('redacted'),{code,status});}});
  assert.equal(reply.status,status);assert.equal(reply.body.error,code);assert.equal(reply.body.intent,undefined);
 }
});
test('unknown-field/null sibling handling remains strict for plans and compatible for old intents',()=>{
 assert.equal(validateIntent({...wrapPlan(sharePlan()),query:{}},{...ctx,message:FOOD_REQUEST}).ok,false);
 assert.equal(validateIntent({type:'analyze',query:{operation:'total',period:'month'},plan:null},{...ctx,message:'Total spending this month.'}).ok,true);
 assert.equal(validateIntent({type:'analyze',query:{operation:'total',period:'month'},plan:sharePlan()},{...ctx,message:'Total spending this month.'}).ok,false);
});

test('unsupported additional component never narrows to an ordinary total',async()=>{
 for(const message of ['Show my total spending and my transaction count.','What did I spend this month, and how many transactions?','Show my total spending and my average expense.']) {
  const reply=await handleIntent({message,context},{request:async()=>({type:'analyze',query:{operation:'total',period:'month'}})});
  assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');assert.ok(reply.body.intent.question.includes(message));
 }
});
test('ordinary routing survives grammar-like configured labels and quoted conjunctions',()=>{
 for(const message of ['Total spending this month.','Compare spending this month with last month.','Show purchases mentioning "share and percent" this month.']) {
  const body=buildIntentRequest({message,context:{...context,categories:[...context.categories,{id:'calendar',label:'This month'}]}});
  assert.equal(body.max_output_tokens,700);
 }
 assert.equal(buildIntentRequest({message:'Total Food and Transit spending this month.',context}).max_output_tokens,700);
});
test('plan-capable schema is recursively closed with all fields required',()=>{
 const schema=buildSchema(ctx.cats.map(c=>c.id),{message:FOOD_REQUEST,context});
 const visit=node=>{
  if(!node||typeof node!=='object')return;
  if(node.type==='object'||Array.isArray(node.type)&&node.type.includes('object')) {
   assert.equal(node.additionalProperties,false);assert.deepEqual([...node.required].sort(),Object.keys(node.properties).sort());
  }
  Object.values(node).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));
 };visit(schema);
});
test('help cannot hide an active malformed plan or satisfy the multipart request',()=>{
 assert.equal(validateIntent({type:'help',plan:sharePlan()},{...ctx,message:FOOD_REQUEST}).ok,false);
 assert.equal(validateIntent({type:'help'},{...ctx,message:FOOD_REQUEST}).intent.type,'clarify');
});
