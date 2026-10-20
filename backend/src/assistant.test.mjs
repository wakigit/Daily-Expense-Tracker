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
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');
 assert.equal(reply.body.intent.reason,'scope_rules_required');assert.equal(reply.body.intent.query,undefined);
});
test('reviewed scope: unmentioned whole categories remain review-only, never an automatic read',async()=>{
 const query={operation:'total',period:'year',spendingScope:{label:'Related',includeCategories:['custom'],includeTerms:['coffee'],excludeCategories:[],excludeTerms:[]}};
 const reply=await handleIntent({message:'Related purchases including coffee this year',context},{request:async()=>({type:'propose_scope',query})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'propose_scope');
 assert.deepEqual(reply.body.intent.query.spendingScope.includeCategories,['custom']);
 assert.equal(validateIntent(reply.body.intent,{message:'Related purchases including coffee this year',cats:context.categories}).ok,true);
});

// Roadmap Step3A, fictional vocabulary independent of the MAIN fixture.
const step3aCats=[{id:'hobby-a',label:'Pottery'},{id:'travel-b',label:'Cycle repairs'},{id:'meal-c',label:'Canteen'}];
const step3aContext={today:'2026-09-18',categories:step3aCats,expenseCount:4};
const step3aQuery={operation:'total',period:'month',category:null,category_terms:[]};
for(const [label,message,patch,reason] of [
 ['two explicit categories','Pottery and Cycle repairs spending last month, weekends only, over S$14?',{period:'lastmonth',day:'weekend',amountOperator:'gt',amount:'14'},'multiple_categories'],
 ['structured multiple labels','Compare Pottery with Canteen for this month.',{operation:'compare',category_terms:['Pottery','Canteen']},'category_comparison_unsupported'],
 ['scope rules omitted','Study-related purchases this year including paper and ink?',{period:'year',description:'paper'},'scope_rules_required'],
 ['multipart','Give my spending total and also the percentage for Pottery this week.',{period:'week'},'plan_complete_request_required'],
 ['arbitrary comparison','Compare April with September spending.',{operation:'compare',period:'range',start:'2026-04-01',end:'2026-09-18'},'comparison_period_unsupported'],
]) {
 test('Step3A valid semantic limitation: '+label,async()=>{
  let requests=0;
  const reply=await handleIntent({message,context:step3aContext},{request:async()=>{requests++;return {type:'analyze',query:{...step3aQuery,...patch}};}});
  assert.equal(requests,1);assert.equal(reply.status,200);
  assert.equal(reply.body.intent.type,'clarify');assert.equal(reply.body.intent.reason,reason);
  assert.ok(reply.body.intent.question.includes(message));assert.equal(reply.body.intent.query,undefined);
  assert.deepEqual(validateIntent(reply.body.intent,{cats:step3aCats,message}).intent,reply.body.intent);
 });
}
for(const [label,patch] of [
 ['invalid amount',{amountOperator:'gt',amount:'PRIVATE_CANARY'}],
 ['unknown operation',{operation:'PRIVATE_CANARY'}],
 ['unknown category',{category:'PRIVATE_CANARY'}],
 ['invalid date',{period:'range',start:'2026-02-30',end:'2026-09-01'}],
 ['invalid group',{groupBy:'PRIVATE_CANARY'}],
 ['extra field',{privateFigure:12345}],
 ['invalid terms',{category_terms:['Pottery',7]}],
 ['invalid scope',{spendingScope:{label:'Study',includeCategories:[],includeTerms:[],excludeCategories:[],excludeTerms:[]}}],
]) {
 test('Step3A structural rejection precedes semantic handling: '+label,async()=>{
  const reply=await handleIntent({message:'Pottery and Canteen related spending this month?',context:step3aContext},{request:async()=>({type:'analyze',query:{...step3aQuery,...patch}})});
  assert.equal(reply.status,502);assert.equal(reply.body.error,'invalid_intent');
  assert.equal(JSON.stringify(reply).includes('PRIVATE_CANARY'),false);
 });
}
for(const [code,status] of [['provider_timeout',504],['provider_key_rejected',401],['provider_connection_failed',503]]) {
 test('Step3A provider error remains an error: '+code,async()=>{
  const reply=await handleIntent({message:'Pottery and Canteen spending last month?',context:step3aContext},{request:async()=>{throw Object.assign(Error('PRIVATE_CANARY'),{code,status});}});
  assert.deepEqual(reply,{status,body:{error:code}});
 });
}
test('Step3A financial assessment is a useful built-in clarification',async()=>{
 let calls=0;
 for(const message of ['Am I handling my finances well?','Is my spending healthy?','How am I doing financially?']) {
  const reply=await handleIntent({message,context:step3aContext},{request:async()=>{calls++;throw Error('unexpected');}});
  assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');
  assert.equal(reply.body.intent.reason,'financial_assessment_needs_scope');
  assert.match(reply.body.intent.question,/budget/);assert.match(reply.body.intent.question,/previous period/);
  assert.equal(validateIntent(reply.body.intent,{message,cats:step3aCats}).ok,true);
 }
 assert.equal(calls,0);
});
test('Step3A valid reviewed scope on unsupported operation clarifies without executing',async()=>{
 const scope={label:'Study purchases',includeCategories:[],includeTerms:['paper','ink'],excludeCategories:[],excludeTerms:[]};
 const reply=await handleIntent({message:'Average study-related spending this year?',context:step3aContext},{request:async()=>({type:'propose_scope',query:{...step3aQuery,operation:'average',aggregate:'per_transaction',period:'year',spendingScope:scope}})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.reason,'scope_operation_unsupported');
 assert.equal(reply.body.intent.query,undefined);
});
test('Step3A incomplete category coverage is semantic only after structural validation',async()=>{
 const scope={label:'Hobbies',includeCategories:['hobby-a'],includeTerms:[],excludeCategories:[],excludeTerms:[]};
 const message='Pottery and Cycle repairs totals last month, on weekends, over S$14?';
 const q={...step3aQuery,period:'lastmonth',day:'weekend',amountOperator:'gt',amount:'14',spendingScope:scope,category_terms:['Pottery','Cycle repairs']};
 const reply=await handleIntent({message,context:step3aContext},{request:async()=>({type:'propose_scope',query:q})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.reason,'scope_categories_incomplete');
 assert.ok(reply.body.intent.question.includes(message));assert.equal(reply.body.intent.query,undefined);
 assert.deepEqual(validateIntent(reply.body.intent,{message,cats:step3aCats}).intent,reply.body.intent);
 const invalid=await handleIntent({message,context:step3aContext},{request:async()=>({type:'propose_scope',query:{...q,amount:'invalid'}})});
 assert.equal(invalid.status,502);assert.equal(invalid.body.detail.field,'query.amount');
});
test('Step3A category comparison cannot be substituted with an approved union total',async()=>{
 const message='Did I spend more on Pottery or Cycle repairs last month?';
 const scope={label:'Both categories',includeCategories:['hobby-a','travel-b'],includeTerms:[],excludeCategories:[],excludeTerms:[]};
 const reply=await handleIntent({message,context:step3aContext},{request:async()=>({type:'propose_scope',query:{...step3aQuery,period:'lastmonth',spendingScope:scope}})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');
 assert.equal(reply.body.intent.reason,'category_comparison_unsupported');assert.equal(reply.body.intent.query,undefined);
});
test('Step3A unmapped category-word metadata clarifies only an established user limitation',async()=>{
 const raw={type:'analyze',query:{...step3aQuery,category_terms:['hobby-a','travel-b']}};
 const message='Did I spend more on Pottery or Cycle repairs last month?';
 const reply=await handleIntent({message,context:step3aContext},{request:async()=>raw});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.reason,'category_comparison_unsupported');
 assert.ok(reply.body.intent.question.includes(message));assert.equal(reply.body.intent.query,undefined);
 const invalid=await handleIntent({message:'Pottery spending this month?',context:step3aContext},{request:async()=>raw});
 assert.equal(invalid.status,502);assert.equal(invalid.body.detail.field,'query.category_terms');
 const invalidId=await handleIntent({message,context:step3aContext},{request:async()=>({...raw,query:{...raw.query,category:'unknown-id'}})});
 assert.equal(invalidId.status,502);assert.equal(invalidId.body.detail.field,'query.category');
});

// Step3B1 uses independent custom vocabulary, no MAIN expectations or rows.
const orCats=[{id:'art-k',label:'Art tools'},{id:'bike-r',label:'Wheel repairs'},{id:'meal-m',label:'Hall meals'}];
const orContext={today:'2026-10-19',categories:orCats,expenseCount:10};
const orQuery={operation:'total',period:'month',category:null,description:null,categories:['art-k','bike-r'],descriptionTerms:['  TEAL CAB ','Quick Van'],category_terms:['Art tools','Wheel repairs']};
test('OR schema is closed, bounded and includes configured category IDs',()=>{
 const schema=buildSchema(orCats.map(c=>c.id)).properties.query.anyOf.find(s=>s.properties?.categories.maxItems===8&&s.properties?.descriptionTerms.maxItems===8);
 assert.equal(schema.properties.categories.maxItems,8);assert.equal(schema.properties.descriptionTerms.maxItems,8);
 assert.equal(schema.properties.descriptionTerms.items.maxLength,80);
 assert.deepEqual(schema.properties.categories.items.enum,['art-k','bike-r','meal-m']);
 assert.ok(schema.required.includes('categories'));assert.ok(schema.required.includes('descriptionTerms'));
});
test('OR handler/client normalisation round-trip preserves all explicit filters',async()=>{
 const message='Total Art tools and Wheel repairs purchases mentioning Teal Cab or Quick Van this month.';
 const reply=await handleIntent({message,context:orContext},{request:async()=>({type:'analyze',query:orQuery})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'analyze');
 assert.deepEqual(reply.body.intent.query.categories,['art-k','bike-r']);
 assert.deepEqual(reply.body.intent.query.descriptionTerms,['quick van','teal cab']);
 assert.deepEqual(validateIntent(reply.body.intent,{cats:orCats,message}).intent,reply.body.intent);
});
for(const [label,patch,field]of [
 ['unknown category',{categories:['CANARY_ID']},'query.categories'],
 ['non-array category',{categories:'art-k'},'query.categories'],
 ['category overflow',{categories:Array(9).fill('art-k')},'query.categories'],
 ['term overflow',{descriptionTerms:Array(9).fill('a')},'query.descriptionTerms'],
 ['term length',{descriptionTerms:['x'.repeat(81)]},'query.descriptionTerms'],
 ['invalid member',{descriptionTerms:['teal',42]},'query.descriptionTerms'],
 ['empty term',{descriptionTerms:['  ']},'query.descriptionTerms'],
 ['null list',{descriptionTerms:null},'query.descriptionTerms'],
 ['conflicting scalar',{category:'art-k'},'query.categories'],
])test('OR malformed output remains rejected: '+label,async()=>{
 const reply=await handleIntent({message:'Art tools and Wheel repairs spending this month?',context:orContext},{request:async()=>({type:'analyze',query:{...orQuery,...patch}})});
 assert.equal(reply.status,502);assert.deepEqual(reply.body,{error:'invalid_intent',detail:{code:'intent_bad_field',field}});
 assert.equal(JSON.stringify(reply).includes('CANARY_ID'),false);
});
for(const [label,message,patch,reason]of [
 ['missing category','Art tools and Wheel repairs total this month.',{categories:['art-k'],category_terms:[]},'explicit_filter_coverage_incomplete'],
 ['missing literal term','Show purchases mentioning Teal Cab or Quick Van this month.',{categories:[],category_terms:[],descriptionTerms:['teal cab']},'explicit_filter_coverage_incomplete'],
 ['unknown coordinated subject','Art tools and bubble tea total this month.',{categories:['art-k'],category_terms:['Art tools'],descriptionTerms:['bubble tea']},'explicit_filter_coverage_incomplete'],
 ['category comparison','Did I spend more on Art tools or Wheel repairs this month?',{},'category_comparison_unsupported'],
 ['projection','Budget pace for Art tools and Wheel repairs this month.',{operation:'projection'},'or_operation_unsupported'],
 ['period comparison','Combined Art tools and Wheel repairs total this month versus last month.',{operation:'compare'},'category_comparison_unsupported'],
 ['concept','Art-related purchases this month.',{},'scope_rules_required'],
])test('OR narrow semantic clarification: '+label,async()=>{
 const reply=await handleIntent({message,context:orContext},{request:async()=>({type:'analyze',query:{...orQuery,...patch}})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');assert.equal(reply.body.intent.reason,reason);
 assert.equal(reply.body.intent.query,undefined);assert.ok(reply.body.intent.question.includes(message));
 assert.deepEqual(validateIntent(reply.body.intent,{cats:orCats,message}).intent,reply.body.intent);
});
test('OR explicit description words that equal categories stay description filters',async()=>{
 const message='Show purchases mentioning Art tools or Hall meals this month.';
 const reply=await handleIntent({message,context:orContext},{request:async()=>({type:'analyze',query:{operation:'list',period:'month',descriptionTerms:['Art tools','Hall meals']}})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'analyze');
 assert.deepEqual(reply.body.intent.query.categories,[]);
 assert.deepEqual(reply.body.intent.query.descriptionTerms,['art tools','hall meals']);
});
test('OR model scope remains a proposal alongside explicit lists',async()=>{
 const message='Review art-related rules this month.';
 const scope={label:'Review terms',includeCategories:[],includeTerms:['paint'],excludeCategories:[],excludeTerms:[]};
 const reply=await handleIntent({message,context:orContext},{request:async()=>({type:'analyze',query:{...orQuery,category_terms:[],spendingScope:scope}})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'propose_scope');
 assert.deepEqual(reply.body.intent.query.categories,['art-k','bike-r']);
});
test('OR provider failure keeps its error status and never becomes a clarification',async()=>{
 const reply=await handleIntent({message:'Art tools and Wheel repairs total this month.',context:orContext},{request:async()=>{throw Object.assign(Error('PRIVATE_CANARY'),{code:'provider_timeout',status:504});}});
 assert.deepEqual(reply,{status:504,body:{error:'provider_timeout'}});
});
test('OR recognised ambiguity uses the same safe clarification for model help/clarify',async()=>{
 const message='Total Art tools and bubble tea spending this month.';
 for(const type of ['help','clarify']){
  const reply=await handleIntent({message,context:orContext},{request:async()=>({type,question:'Should I use Hall meals?'})});
  assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');
  assert.equal(reply.body.intent.reason,'explicit_filter_coverage_incomplete');
  assert.ok(reply.body.intent.question.includes(message));assert.equal(reply.body.intent.question.includes('Hall meals'),false);
  assert.deepEqual(validateIntent(reply.body.intent,{cats:orCats,message}).intent,reply.body.intent);
 }
});

// Step3B2 independent vocabulary; no MAIN fixtures or expectation changes.
const compareCats=[{id:'ceramic-v',label:'Ceramics'},{id:'rail-v',label:'Rail passes'},{id:'supplies-v',label:'Field supplies'}];
const compareContext={today:'2026-10-20',categories:compareCats,expenseCount:12};
const comparePeriod={operation:'compare',period:'all',category:'ceramic-v',comparison:{kind:'periods',categories:[],periods:[{period:'named_month',month:'2026-09'},{period:'named_month',month:'2026-07'}]}};
const compareCategory={operation:'compare',period:'month',comparison:{kind:'categories',periods:[],categories:['ceramic-v','rail-v']},category_terms:['Ceramics','Rail passes']};
test('B2 strict schema has one bounded comparison descriptor',()=>{
 const schema=buildSchema(compareCats.map(c=>c.id)).properties.query.anyOf[0];
 assert.ok(schema.required.includes('comparison'));
 const variants=buildSchema(compareCats.map(c=>c.id)).properties.query.anyOf;
 const comparison=variants.find(q=>q.properties?.comparison.properties?.kind.enum[0]==='periods').properties.comparison;
 assert.equal(comparison.additionalProperties,false);
 assert.equal(comparison.properties.periods.maxItems,2);assert.equal(comparison.properties.categories.maxItems,0);
 assert.equal(comparison.properties.periods.items.additionalProperties,false);
});
for(const [message,query]of [
 ['Compare Ceramics in September with July.',comparePeriod],
 ['Did I spend more on Ceramics or Rail passes this month?',compareCategory],
 ['Compare purchases mentioning Falcon Cab or River Bus last month with this month.',{...comparePeriod,category:null,descriptionTerms:['Falcon Cab','River Bus'],comparison:{kind:'periods',categories:[],periods:[{period:'lastmonth'},{period:'month'}]}}],
])test('B2 handler/client round trip '+message,async()=>{
 const reply=await handleIntent({message,context:compareContext},{request:async()=>({type:'analyze',query})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'analyze');assert.equal(reply.body.intent.query.operation,'compare');
 assert.deepEqual(validateIntent(reply.body.intent,{cats:compareCats,message}).intent,reply.body.intent);
});
for(const [label,comparison]of [
 ['third category',{kind:'categories',categories:['ceramic-v','rail-v','supplies-v'],periods:[]}],
 ['missing category',{kind:'categories',categories:['ceramic-v'],periods:[]}],
 ['unknown category',{kind:'categories',categories:['ceramic-v','SECRET_CANARY'],periods:[]}],
 ['duplicate category',{kind:'categories',categories:['ceramic-v','ceramic-v'],periods:[]}],
 ['third period',{kind:'periods',categories:[],periods:[{period:'month'},{period:'lastmonth'},{period:'year'}]}],
 ['invalid date',{kind:'periods',categories:[],periods:[{period:'range',start:'2026-02-30',end:'2026-03-01'},{period:'month'}]}],
 ['invented operation',{kind:'periods',categories:[],periods:[{period:'month',operation:'count'},{period:'lastmonth'}]}],
 ['invented figure',{kind:'periods',categories:[],periods:[{period:'month',total:100},{period:'lastmonth'}]}],
 ['invalid named month',{kind:'periods',categories:[],periods:[{period:'named_month',month:'2026-13'},{period:'month'}]}],
 ['mixed side dimensions',{kind:'periods',categories:['ceramic-v'],periods:[{period:'month'},{period:'lastmonth'}]}],
])test('B2 malformed comparison remains rejected '+label,async()=>{
 const reply=await handleIntent({message:'Compare Ceramics in September with July.',context:compareContext},{request:async()=>({type:'analyze',query:{...comparePeriod,comparison}})});
 assert.equal(reply.status,502);assert.equal(reply.body.detail.field,'query.comparison');assert.equal(JSON.stringify(reply).includes('SECRET_CANARY'),false);
});
test('B2 third requested side cannot be silently discarded',async()=>{
 const message='Compare Ceramics versus Rail passes versus Field supplies this month.';
 const reply=await handleIntent({message,context:compareContext},{request:async()=>({type:'analyze',query:compareCategory})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');assert.ok(reply.body.intent.question.includes(message));
});
test('B2 combined total cannot be reinterpreted as category comparison',async()=>{
 const message='Total Ceramics and Rail passes spending this month.';
 const reply=await handleIntent({message,context:compareContext},{request:async()=>({type:'analyze',query:compareCategory})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');
});
test('B2 reviewed concept comparison still needs separate approved totals',async()=>{
 const scope={label:'Related',includeCategories:[],includeTerms:['clay'],excludeCategories:[],excludeTerms:[]};
 const reply=await handleIntent({message:'Compare art-related spending in September with July.',context:compareContext},{request:async()=>({type:'analyze',query:{...comparePeriod,spendingScope:scope}})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');assert.equal(reply.body.intent.reason,'scope_operation_unsupported');
});
test('B2 provider failures are not successful comparisons',async()=>{
 const reply=await handleIntent({message:'Compare Ceramics September with July.',context:compareContext},{request:async()=>{throw Object.assign(Error('PRIVATE_CANARY'),{code:'provider_timeout',status:504});}});
 assert.deepEqual(reply,{status:504,body:{error:'provider_timeout'}});
});

test('B2 provider decoding prevents duplicate scalar/list and side/root scopes',()=>{
 const variants=buildSchema(compareCats.map(c=>c.id)).properties.query.anyOf.filter(q=>q.properties);
 assert.equal(variants.length,10);
 for(const {properties:p}of variants){
  assert.ok(p.category.type==='null'||p.categories.maxItems===0);
  assert.ok(p.description.type==='null'||p.descriptionTerms.maxItems===0);
  const kind=p.comparison.properties?.kind.enum[0];
  if(kind==='periods'){assert.deepEqual(p.period.enum,['all']);assert.equal(p.start.type,'null');assert.equal(p.end.type,'null');assert.equal(p.comparison.properties.periods.minItems,2);}
  if(kind==='categories'){assert.equal(p.category.type,'null');assert.equal(p.categories.maxItems,0);assert.equal(p.comparison.properties.categories.minItems,2);assert.equal(p.comparison.properties.periods.maxItems,0);}
 }
});

test('B2 a one-period interpretation cannot answer a two-range comparative question',async()=>{
 const message='Was my Ceramics spending higher between January1–15 or February1–15?';
 const reply=await handleIntent({message,context:compareContext},{request:async()=>({type:'analyze',query:{operation:'total',period:'range',start:'2026-01-01',end:'2026-01-15',category:'ceramic-v'}})});
 assert.equal(reply.status,200);assert.equal(reply.body.intent.type,'clarify');assert.equal(reply.body.intent.query,undefined);assert.ok(reply.body.intent.question.includes(message));
 assert.deepEqual(validateIntent(reply.body.intent,{cats:compareCats,message}).intent,reply.body.intent);
});
