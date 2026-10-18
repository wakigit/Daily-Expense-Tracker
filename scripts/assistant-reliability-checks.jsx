import { reliabilityFixture as ctx } from './assistant-fixture';
import { dialogueIntent, completeQuestionChoices } from '../src/lib/assistantDialogue';
import { answerOfflineQuery, interpretOffline } from '../src/lib/queryOffline';
import { executeQuery } from '../src/lib/queryEngine';
import { validateIntent, intentDiagnostic } from '../src/lib/intent';
import { planFromIntent } from '../src/lib/assistant';
import { requestIntent } from '../src/lib/assistantClient';
import { evidenceIsOutdated } from '../src/lib/answerEvidence';
import { renderToString } from 'react-dom/server';
import AskView from '../src/views/AskView';
export async function assistantReliabilityChecks(check) {
 const run=q=>executeQuery({operation:'total',period:'month',...q},ctx);
 const ids=p=>p.evidence.rows.map(e=>e.id).sort();
 for(const question of ['hello','Hi!','Hey there','Good morning, TallyAI!','help','What can I ask?']) {
   const answer=answerOfflineQuery(question,ctx);
   check(`greeting/help ${question}: no financial figure or evidence`,[/S\$|\d/.test(answer.text),Boolean(answer.evidence)],[false,false]);
   let calls=0; const client=await requestIntent(question,{...ctx,fetchImpl:async()=>{calls++;throw 0;}});
   check(`greeting/help ${question}: intentional builtin, no model call`,[client.ok,client.source,calls],[true,'builtin',0]);
 }
 check('greeting plus financial question is not help',dialogueIntent('Hello, how much did I spend this month?'),null);
 check('offline greeting plus financial question keeps total',answerOfflineQuery('Hi, how much did I spend this month?',ctx).text.includes('S$145.50'),true);
 for(const q of ['What is my highest expenditure?','What was my biggest expense?','What is my highest spending this month?']) {
   const plan=answerOfflineQuery(q,ctx);
   check(`ambiguous highest clarifies ${q}`,plan.kind,'clarify');
   check(`highest clarification has three full scoped choices ${q}`,completeQuestionChoices(plan.suggestions).length,3);
   for(const choice of plan.suggestions)check(`highest choice executes offline ${choice}`,answerOfflineQuery(choice,ctx).kind,'answer');
 }
 check('unknown filters in ambiguity retained for edit, never dropped into broad buttons',dialogueIntent('What is my highest expenditure on Zephyr this month?').options,[]);
 check('one-word model clarification options never rendered',completeQuestionChoices(['Food','Day','Largest transaction']),[]);
 check('explicit custom category highest is not ambiguous',dialogueIntent('Which category had the highest total spending this month?'),null);
 for(const question of ['What was my largest single expense this month?','Find my biggest individual transaction this month.','What was my most expensive purchase this month?']) {
   const plan=answerOfflineQuery(question,ctx);
   check(`largest alternate wording ${question}`,ids(plan),['c','d']);
   check(`largest tied amount visible ${question}`,plan.text.includes('S$40.00')&&plan.text.includes('2026-10-03')&&plan.text.includes('2026-10-05'),true);
 }
 const largest=run({operation:'largest'});
 check('largest evidence basis includes losing candidates',largest.evidence.basis.length,8);
 check('largest candidate edit invalidates old answer',evidenceIsOutdated(largest.evidence,ctx.expenses.map(e=>e.id==='a'?{...e,amount:41}:e),ctx.cats),true);
 check('largest new candidate invalidates old answer',evidenceIsOutdated(largest.evidence,[...ctx.expenses,{id:'new',date:ctx.today,description:'Fictional',amount:41,category:'food'}],ctx.cats),true);
 check('largest source deletion invalidates old answer',evidenceIsOutdated(largest.evidence,ctx.expenses.filter(e=>e.id!=='c'),ctx.cats),true);
 check('largest custom category filter',ids(run({operation:'largest',category:'custom-art'})),['c']);
 check('largest arbitrary description filter',ids(run({operation:'largest',description:'KFC'})),['a']);
 check('largest amount and day filter exact',ids(run({operation:'largest',day:'weekend',amountOperator:'lte',amount:'20'})),['f']);
 check('largest future-dated candidate is excluded',ids(executeQuery({operation:'largest',period:'month'},{...ctx,expenses:[...ctx.expenses,{id:'future',date:'2026-10-19',description:'Future',amount:999,category:'food'}]})),['c','d']);
 check('largest empty does not invent winner',run({operation:'largest',description:'Not recorded'}).evidence.rows,[]);
 check('largest previous month tied support',ids(executeQuery({operation:'largest',period:'lastmonth'},ctx)),['g']);
 const types=run({operation:'day_types'});
 check('fixture weekdays/weekends totals independent 8550/6000',types.comparison.sides.map(s=>s.totalCents),[8550,6000]);
 check('fixture calendar denominators 12/6 incl zero days',types.comparison.sides.map(s=>s.calendarDays),[12,6]);
 check('fixture differing total and daily-average conclusion',types.detail.includes('conclusions differ'),true);
 check('fixture strict over S$20 excludes boundary',ids(run({operation:'list',amountOperator:'gt',amount:'20'})),['a','c','d']);
 check('fixture inclusive S$20 includes boundary',ids(run({operation:'list',amountOperator:'gte',amount:'20'})),['a','c','d','f']);
 check('fixture custom category under S$10',ids(answerOfflineQuery('Show Creative hobbies transactions under S$10 this month',ctx)),['i','j']);
 const usual=answerOfflineQuery('What day of the week do I usually spend the most money this month?',ctx);
 check('fixture highest average weekday Monday with 2 calendar occurrences',usual.text.includes('Monday: S$25.00 per calendar occurrence')&&usual.text.includes('2 calendar occurrences'),true);
 check('fixture weekday winning evidence',ids(usual),['d','e']);
 for(const term of ['KFC','kfc']) {
   const cmp=answerOfflineQuery(`Compare all descriptions mentioning ${term} this month with last month`,ctx);
   check(`fixture comparison ${term} 3300 vs 2000 cents`,cmp.comparison.sides.map(s=>s.totalCents),[3300,2000]);
   check(`fixture comparison ${term} cent difference`,cmp.comparison.differenceCents,1300);
   check(`fixture comparison ${term} actual matching ranges`,cmp.comparison.sides.map(s=>[s.start,s.end]),[['2026-10-01','2026-10-18'],['2026-09-01','2026-09-18']]);
   check(`fixture comparison ${term} evidence`,cmp.comparison.sides.map(s=>s.evidence.rows.map(e=>e.id)),[['a','e'],['g','h']]);
 }
 const renamed={...ctx,cats:ctx.cats.map(c=>c.id==='custom-art'?{...c,label:'Climbing gear'}:c)};
 check('custom label variation uses real category ID',ids(answerOfflineQuery('Largest single Climbing gear expense this month?',renamed)),['c']);
 const alternate=answerOfflineQuery('Compare all descriptions mentioning Grab ride this month with last month',ctx);
 check('different merchant zero baseline remains honest',[alternate.comparison.sides[0].totalCents,alternate.comparison.percentage,alternate.detail.includes('not a reliable spending trend')],[4000,null,true]);
 const pace=answerOfflineQuery('Based on my current spending pace, when will I run out of my Creative hobbies budget?',ctx);
 check('fixture custom category pace total S$50 rate 50/18, beyond month-end',pace.detail.includes('S$50.00 ÷ 18')&&pace.text.includes('month-end'),true);
 check('fixture total independent 23+2.5+40+40+10+20+5+5',run().text.includes('S$145.50'),true);
 check('fixture count 8',run({operation:'count'}).text.startsWith('8 recorded'),true);
 check('fixture per-transaction average 145.5/8',run({operation:'average',aggregate:'per_transaction'}).text.includes('S$18.19'),true);
 const raw={type:'analyze',query:{operation:'largest',period:'month',start:null,end:null,category:null,description:null,amountOperator:null,amount:null,day:'all',groupBy:null,aggregate:'total',category_terms:[]}};
 const first=validateIntent(raw,{cats:ctx.cats,message:'Largest single expense this month?'});
 const second=validateIntent(first.intent,{cats:ctx.cats,message:'Largest single expense this month?'});
 check('largest strict raw/canonical second validation agree',[first.ok,second.ok,ids(planFromIntent(second.intent,ctx))],[true,true,['c','d']]);
 const invalid=validateIntent({...raw,query:{...raw.query,operation:'highest',groupBy:null}},{cats:ctx.cats,message:'Highest single expense?'});
 check('synthetic invalid grouping retains safe field diagnostic',intentDiagnostic(invalid.error),{code:'intent_bad_field',field:'query.groupBy'});
 const failed=await requestIntent('Largest single expense this month?',{...ctx,fetchImpl:async()=>new Response(JSON.stringify({error:'invalid_intent',detail:invalid.error}),{status:502})});
 check('failed AI validation remains explicitly failed, not live success',[failed.ok,failed.reason,failed.diagnostic.field],[false,'invalid_intent','query.groupBy']);
 const html=renderToString(<AskView messages={[{from:'bot',text:'Clarify',suggestions:dialogueIntent('Highest expenditure?').options}]} hasData={true}/>);
 check('clarification UI renders complete questions',html.includes('What was my largest single expense this month?')&&html.includes('Which day had the highest total spending this month?'),true);
}
