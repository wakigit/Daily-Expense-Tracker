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

// Real category vocabulary, without changing the query shape or making provider calls.
test('category vocabulary: generic transport clarifies before provider, explicit types stay separate', async()=>{
 const {DEF_CATS}=await import('../../src/themes/themes.js');
 const context={today:'2026-10-19',categories:DEF_CATS.map(({id,label})=>({id,label}))};
 let calls=0;
 const reply=await handleIntent({message:'Transport spending last month?',context},{request:async()=>{calls++;throw 0;}});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');assert.equal(calls,0);
 assert.match(reply.body.intent.question,/Public Transport and Private Hire/);
 for(const [label,id] of [['Food','food'],['Public transport','pub'],['Private hire','hire']]) {
   const result=await handleIntent({message:`${label} spending this month`,context},{request:async()=>({type:'analyze',query:{operation:'total',period:'month',category:id,category_terms:[label]}})});
   assert.equal(result.status,200);assert.equal(validateIntent(result.body.intent,{cats:DEF_CATS,message:`${label} spending this month`}).ok,true);
 }
});
test('receipt vocabulary: all seven actual IDs available and fresh Food draft validates',async()=>{
 const {DEF_CATS}=await import('../../src/themes/themes.js');
 const {buildReceiptSchema}=await import('./provider.js');
 const {validateReceipt}=await import('../../src/lib/receipt.js');
 assert.deepEqual(buildReceiptSchema(DEF_CATS.map(c=>c.id)).properties.category.enum,[...DEF_CATS.map(c=>c.id),null]);
 const result=validateReceipt({isReceipt:true,description:'Fictional GrabFood lunch',amount:'5.40',currency:'SGD',date:'2026-10-19',category:'food'},{cats:DEF_CATS,today:'2026-10-19'});
 assert.equal(result.ok,true);assert.equal(result.draft.category,'food');
});


test('assistant: complete breakdown contract preserves relative dates through handler and client',async()=>{
 const message='Break down descriptions mentioning Acme by category over the last 90 days';
 const input={...query,operation:'breakdown',groupBy:'category',period:'last_days',dayCount:90,category:null,category_terms:[],description:'Acme'};
 const response=await handleIntent({message,context},{request:async()=>({type:'analyze',query:input})});
 assert.equal(response.status,200);
 const checked=validateIntent(response.body.intent,{message,cats:context.categories});
 assert.equal(checked.ok,true);assert.equal(checked.intent.query.dayCount,90);
 assert.equal(checked.intent.query.description,'Acme');assert.equal(checked.intent.query.groupBy,'category');
 const schema=buildSchema(['custom']).properties.query.anyOf[0];
 assert.ok(schema.properties.operation.enum.includes('breakdown'));
 assert.ok(schema.properties.period.enum.includes('last_days'));
 assert.ok(schema.properties.period.enum.includes('year'));
 assert.ok(schema.required.includes('dayCount'));
});
test('assistant: malformed relative fields fail safely rather than broadening range',async()=>{
 for(const dayCount of [null,0,-1,1.5,'90',3661]) {
  const response=await handleIntent({message:'Spending by month last 90 days',context},{request:async()=>({type:'analyze',query:{...query,operation:'breakdown',groupBy:'month',period:'last_days',dayCount}})});
  assert.equal(response.status,502);assert.equal(response.body.detail.field,'query.dayCount');
 }
});
test('assistant: referential request clarifies without a paid request',async()=>{
 let calls=0;
 const response=await handleIntent({message:'Show those transactions',context},{request:async()=>{calls++;throw 0;}});
 assert.equal(response.status,200);assert.equal(response.body.intent.type,'clarify');assert.equal(calls,0);
});

test('reviewed scope: strict schema and both normalization boundaries retain all rules',async()=>{
 const cats=[{id:'transport',label:'Transport'},{id:'insurance',label:'Insurance'}];
 const context={today:'2026-10-19',categories:cats};
 const spendingScope={label:'Car-related',includeCategories:['transport'],includeTerms:[' CAR   INSURANCE '],excludeCategories:[],excludeTerms:['MRT']};
 const query={operation:'breakdown',groupBy:'month',period:'year',spendingScope};
 const message='Car-related spending including whole Transport category and car insurance this year';
 const reply=await handleIntent({message,context},{request:async()=>({type:'propose_scope',query})});
 assert.equal(reply.status,200);
 const second=validateIntent(reply.body.intent,{message,cats});
 assert.deepEqual(second.intent,reply.body.intent);
 assert.deepEqual(second.intent.query.spendingScope,{label:'Car-related',includeCategories:['transport'],includeTerms:['car insurance'],excludeCategories:[],excludeTerms:['mrt']});
 const schema=buildSchema(cats.map(c=>c.id));
 assert.ok(schema.properties.type.enum.includes('propose_scope'));
 const scopeSchema=schema.properties.query.anyOf[0].properties.spendingScope.anyOf[1];
 assert.equal(scopeSchema.additionalProperties,false);
 assert.deepEqual(scopeSchema.required,Object.keys(scopeSchema.properties));
 assert.deepEqual(scopeSchema.properties.includeCategories.items.enum,['transport','insurance']);
});
test('reviewed scope: model cannot bypass review with analyze; invalid category fails safely',async()=>{
 const spendingScope={label:'Scope',includeCategories:['custom'],includeTerms:[],excludeCategories:[],excludeTerms:[]};
 const q={operation:'total',period:'year',spendingScope};
 const reply=await handleIntent({message:'Review Creative hobbies spending scope',context},{request:async()=>({type:'analyze',query:q})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'propose_scope');
 const invalid=await handleIntent({message:'Review this scope',context},{request:async()=>({type:'propose_scope',query:{...q,spendingScope:{...spendingScope,excludeCategories:['PRIVATE_CANARY']}}})});
 assert.equal(invalid.status,502);
 assert.deepEqual(invalid.body,{error:'invalid_intent',detail:{code:'intent_bad_field',field:'query.spendingScope'}});
 assert.equal(JSON.stringify(invalid).includes('PRIVATE_CANARY'),false);
});
test('reviewed scope: broad related request cannot silently become one substring total',async()=>{
 const reply=await handleIntent({message:'Car-related expenses including fuel insurance and repair this year',context},{request:async()=>({type:'analyze',query:{operation:'total',period:'year',description:'fuel'}})});
 assert.equal(reply.status,502);assert.equal(reply.body.detail.field,'query.spendingScope');
});
test('reviewed scope: unmentioned whole categories remain review-only, never an automatic read',async()=>{
 const query={operation:'total',period:'year',spendingScope:{label:'Related',includeCategories:['custom'],includeTerms:['coffee'],excludeCategories:[],excludeTerms:[]}};
 const reply=await handleIntent({message:'Related purchases including coffee this year',context},{request:async()=>({type:'propose_scope',query})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'propose_scope');
 assert.deepEqual(reply.body.intent.query.spendingScope.includeCategories,['custom']);
 assert.equal(validateIntent(reply.body.intent,{message:'Related purchases including coffee this year',cats:context.categories}).ok,true);
});
