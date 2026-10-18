import assert from 'node:assert/strict';
import {test} from 'node:test';
import {handleIntent} from './routes.js';
import {buildSchema} from './provider.js';
import {validateIntent} from '../../src/lib/intent.js';
const context={today:'2026-10-18',categories:[{id:'custom',label:'Creative hobbies'}]};
const query={operation:'largest',period:'month',start:null,end:null,category:'custom',description:null,amountOperator:null,amount:null,day:'all',groupBy:null,aggregate:'total',category_terms:['Creative hobbies']};
test('assistant: strict model schema includes help and largest single operation',()=>{
 const schema=buildSchema(['custom']);
 assert.ok(schema.properties.type.enum.includes('help'));
 assert.ok(schema.properties.query.anyOf[0].properties.operation.enum.includes('largest'));
 assert.equal(schema.properties.query.anyOf[0].additionalProperties,false);
});
test('assistant: greeting and ambiguity never call model or produce figures',async()=>{
 let calls=0; const request=async()=>{calls++;throw 0;};
 const greeting=await handleIntent({message:'hello',context},{request});
 assert.equal(greeting.status,200); assert.equal(greeting.body.intent.type,'help');
 const highest=await handleIntent({message:'what is my highest expenditure',context},{request});
 assert.equal(highest.status,200); assert.equal(highest.body.intent.type,'clarify');
 assert.equal(highest.body.intent.options.length,3);
 assert.ok(highest.body.intent.options.every(q=>q.includes('this month')));
 assert.equal(calls,0);
});
test('assistant: greeting with financial request reaches interpreter; schema output validates twice',async()=>{
 let calls=0;
 const message='Hello, largest single Creative hobbies expense this month?';
 const reply=await handleIntent({message,context},{request:async()=>{calls++;return {type:'analyze',query};}});
 assert.equal(reply.status,200);assert.equal(calls,1);
 const second=validateIntent(reply.body.intent,{message,cats:context.categories});
 assert.equal(second.ok,true);assert.equal(second.intent.query.operation,'largest');
});
test('assistant: invalid highest group produces safe fixed code and field',async()=>{
 const reply=await handleIntent({message:'Largest single expense this month?',context},{request:async()=>({type:'analyze',query:{...query,operation:'highest',groupBy:null}})});
 assert.equal(reply.status,502);
 assert.deepEqual(reply.body,{error:'invalid_intent',detail:{code:'intent_bad_field',field:'query.groupBy'}});
});
test('assistant: invalid model values are not copied into validation diagnostics',async()=>{
 const reply=await handleIntent({message:'Largest single expense this month?',context},{request:async()=>({type:'analyze',query:{...query,operation:'PRIVATE_CANARY'}})});
 assert.equal(reply.status,502);assert.equal(reply.body.detail.field,'query.operation');
 assert.equal(JSON.stringify(reply).includes('PRIVATE_CANARY'),false);
});


test('assistant: weekday and description requests validate without fabricated category terms',async()=>{
 for(const query of [
  {operation:'highest',groupBy:'weekday',aggregate:'daily_average',period:'month',description:null},
  {operation:'compare',groupBy:null,aggregate:'total',period:'month',description:'Arbitrary Merchant'},
 ]) {
  const request=async()=>({type:'analyze',query:{...query,category:null,category_terms:[],day:'all',start:null,end:null,amountOperator:null,amount:null}});
  const reply=await handleIntent({message:'Interpret this spending question',context},{request});
  assert.equal(reply.status,200);assert.equal(validateIntent(reply.body.intent,{cats:context.categories}).ok,true);
 }
 const invalid=await handleIntent({message:'Highest weekday average this month?',context},{request:async()=>({type:'analyze',query:{...query,operation:'highest',groupBy:'weekday',aggregate:'daily_average',category:null,category_terms:['context label not requested']}})});
 assert.equal(invalid.status,502);assert.equal(invalid.body.detail.field,'query.category_terms');
});

/* ---- latest: the recency operation the model used to substitute away ---- */
test('assistant: schema exposes latest, and the prompt separates it from largest',async()=>{
 const schema=buildSchema(['custom']);
 assert.ok(schema.properties.query.anyOf[0].properties.operation.enum.includes('latest'));
 const {SYSTEM_PROMPT}=await import('./provider.js');
 assert.match(SYSTEM_PROMPT,/- latest: most recent SINGLE transaction BY DATE/);
 assert.match(SYSTEM_PROMPT,/largest SINGLE transaction BY AMOUNT/);
 // The rule that closed the bug: no substituting a different question's answer.
 assert.match(SYSTEM_PROMPT,/If NO supported operation genuinely answers the question asked, you MUST use type clarify/);
});
test('assistant: a latest intent validates twice and keeps its operation',async()=>{
 let calls=0;
 const message='how much is my most recent expenditure';
 const latest={...query,operation:'latest',period:'all',category:null,category_terms:[]};
 const reply=await handleIntent({message,context},{request:async()=>{calls++;return {type:'analyze',query:latest};}});
 assert.equal(reply.status,200);assert.equal(calls,1);
 assert.equal(reply.body.intent.query.operation,'latest');
 const second=validateIntent(reply.body.intent,{message,cats:context.categories});
 assert.equal(second.ok,true);assert.equal(second.intent.query.operation,'latest');
});
test('assistant: latest rejects a groupBy, like every non-highest operation',async()=>{
 const reply=await handleIntent({message:'what was my last expense',context},
   {request:async()=>({type:'analyze',query:{...query,operation:'latest',groupBy:'day'}})});
 assert.equal(reply.status,502);
 assert.deepEqual(reply.body,{error:'invalid_intent',detail:{code:'intent_bad_field',field:'query.groupBy'}});
});
test('assistant: latest carries category and description filters through validation',async()=>{
 for(const patch of [{category:'custom',category_terms:['Creative hobbies']},{category:null,category_terms:[],description:'Grab'}]) {
  const reply=await handleIntent({message:'what was my last Grab ride',context},
    {request:async()=>({type:'analyze',query:{...query,operation:'latest',period:'all',...patch}})});
  assert.equal(reply.status,200);
  assert.equal(reply.body.intent.query.operation,'latest');
 }
});
