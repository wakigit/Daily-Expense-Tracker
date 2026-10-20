import {renderToString} from 'react-dom/server';
import AnswerEvidence from '../src/components/AnswerEvidence';
import PlanAnswer from '../src/components/PlanAnswer';
import AskView from '../src/views/AskView';
import {requestIntent,explainIntentFailure} from '../src/lib/assistantClient';
import {handleIntent} from '../backend/src/routes';
import {validateIntent} from '../src/lib/intent';
import {planFromIntent} from '../src/lib/assistant';
import {interpretOffline} from '../src/lib/queryOffline';
import {createAssistantSession,resolveFollowup,interpretationPublication} from '../src/lib/assistantFollowup';
import {markOutdatedAnswers,planIsStale} from '../src/lib/answerEvidence';
import {planEvidenceSelection,formatPlanMoney} from '../src/lib/planPresentation';
import {extractPlanResult,scorePlanResult} from './eval/plan-results.mjs';
import {mockPlanIntent,wrapPlan} from './mocks/plan-intents';
import {planContext,sharePlan,FOOD_REQUEST,DIFFERENCE_REQUEST,LITERAL_REQUEST} from './plan-fixture';

export async function planIntegrationChecks(check) {
 const ctx={...planContext(),budgets:{}},clone=x=>structuredClone(x);
 let mockCalls=0;
 const transport=async(_url,options)=>{
  mockCalls++;const reply=await handleIntent(JSON.parse(options.body),{request:async({message,context})=>mockPlanIntent(message,context)});
  return {ok:reply.status===200,status:reply.status,json:async()=>reply.body};
 };
 const interpret=async message=>requestIntent(message,{...ctx,url:'http://mock.invalid',fetchImpl:transport});
 const execute=async message=>{const r=await interpret(message);return r.ok?planFromIntent(r.intent,{...ctx,message}):r;};
 const a=await execute(FOOD_REQUEST),b=await execute(DIFFERENCE_REQUEST),c=await execute(LITERAL_REQUEST);
 check('PI mock HTTP client/server real calculator A',[a.kind,a.planResult.base.map(p=>[p.totalCents,p.count]),a.planResult.derived[0].display],['answer',[[4000,3],[1000,1]],'25.00%']);
 check('PI mock HTTP real calculator B',[b.planResult.base.map(p=>p.totalCents),b.planResult.derived[0].totalCents],[[4000,1200],2800]);
 check('PI mock HTTP real calculator C',[c.planResult.base.map(p=>[p.totalCents,p.count]),c.planResult.derived[0].display,c.planResult.base[0].range],[[[7000,6],[1800,1]],'25.71%',{start:'2026-12-11',end:'2027-03-10'}]);
 check('PI no hidden transport calls for three requests',mockCalls,3);
 check('PI exact rendering retains large safe cents',[formatPlanMoney(9007199254740990),formatPlanMoney(-2800)],['S$90071992547409.90','−S$28.00']);
 const expected={shape:'plan',referenceDate:'2027-03-10',base:[
  {id:'q1',totalCents:4000,count:3,ids:['p1','p2','p3'],query:{operation:'total',period:'month',start:null,end:null,dayCount:null,category:null,categories:[],description:null,descriptionTerms:[],day:'all',amountOperator:null,amount:null,groupBy:null,aggregate:'total',comparison:null,spendingScope:null,category_terms:[]},unit:{kind:'money',currency:'SGD',scale:'cents'},provenance:{source:'application_calculation',referenceDate:'2027-03-10'},range:{start:'2027-03-01',end:'2027-03-10'}},
  {id:'q2',totalCents:1000,count:1,ids:['p1'],query:{operation:'total',period:'month',start:null,end:null,dayCount:null,category:'meal-p',categories:[],description:null,descriptionTerms:[],day:'all',amountOperator:null,amount:null,groupBy:null,aggregate:'total',comparison:null,spendingScope:null,category_terms:['Food & Drinks']},unit:{kind:'money',currency:'SGD',scale:'cents'},provenance:{source:'application_calculation',referenceDate:'2027-03-10'},range:{start:'2027-03-01',end:'2027-03-10'}}],
  derived:[{id:'d1',operation:'percent_of',numeratorCents:1000,denominatorCents:4000,hundredthsPercent:2500,display:'25.00%',
   provenance:{dependencies:['q2','q1'],inputs:{numerator:{reference:{step:'q2',field:'totalCents'},totalCents:1000,evidenceStep:'q2'},denominator:{reference:{step:'q1',field:'totalCents'},totalCents:4000,evidenceStep:'q1'}}}}]};
 check('PI independent plan oracle all parts/roles/figures/evidence',scorePlanResult(a,expected).pass,true);
 for(const [name,change] of [['omitted part',r=>r.base.pop()],['wrong scope',r=>r.base[1].query.category='transit-p'],['wrong dates',r=>r.base[0].range.start='2027-02-01'],['wrong operand',r=>r.derived[0].provenance.inputs.numerator.reference.step='q1'],['wrong unit',r=>r.base[0].unit.currency='USD'],['invented amount filter',r=>r.base[0].query.amountOperator='gt'],['wrong figures',r=>r.derived[0].hundredthsPercent=2600],['wrong evidence',r=>r.base[1].evidence.rows=[]]]) {
  const changed=clone(a);change(changed.planResult);check('PI scorer rejects '+name,scorePlanResult(changed,expected).pass,false);
 }
 check('PI clarification never capability pass',scorePlanResult({kind:'clarify'},expected).pass,false);
 check('PI typed extraction contains provenance',extractPlanResult(a).derived[0].provenance.source,'application_calculation');
 const zeroMessage='What did I spend from 2027-01-01 to 2027-01-05, and what percentage was Food & Drinks?';
 const zero=await execute(zeroMessage);
 check('PI zero denominator typed unavailable',[zero.kind,zero.planResult.derived[0].status,Object.hasOwn(zero.planResult.derived[0],'hundredthsPercent')],['answer','unavailable_zero_denominator',false]);
 const html=renderToString(<PlanAnswer result={a.planResult} answerId={1} source="mock"/>);
 for(const word of ['S$10.00 ÷ S$40.00 × 100 = 25.00%','2027-03-01','Food &amp; Drinks','Mock interpretation','See transactions','href="#plan-1-q2"'])check('PI render '+word,html.includes(word),true);
 check('PI zero unavailable visible',renderToString(<PlanAnswer result={zero.planResult}/>).includes('Percentage unavailable'),true);
 check('PI signed difference visible',renderToString(<PlanAnswer result={b.planResult}/>).includes('+S$28.00'),true);
 const literals=renderToString(<PlanAnswer result={c.planResult}/>);check('PI literal matching disclosed',literals.includes('case-insensitive substring')&&literals.includes('Amazon'),true);
 for(const message of [FOOD_REQUEST,DIFFERENCE_REQUEST,LITERAL_REQUEST,'Show my total spending and my Transit spending, then sum them.']) {
  const reply=interpretOffline(message,ctx.cats,ctx.today);check('PI offline complete clarification '+message,[reply.kind,reply.query],[ 'clarify',undefined]);
 }
 check('PI provider timeout label remains honest',explainIntentFailure('provider_timeout').startsWith('Answered offline.'),true);
 const unsupported=await execute('What did I spend this month, and what percentage was Food & Drinks, then forecast next year?');
 check('PI unsupported whole request no partial figures',[unsupported.kind,unsupported.planResult],['clarify',undefined]);
 const removedCategory={...ctx,cats:ctx.cats.filter(c=>c.id!=='meal-p')};
 const invalidCurrent=planFromIntent({type:'plan',plan:sharePlan()},{...removedCategory,message:FOOD_REQUEST});
 check('PI current category removal blocks whole execution',[invalidCurrent.kind,invalidCurrent.planResult],['clarify',undefined]);
 const narrowed=validateIntent({type:'analyze',query:{operation:'total',period:'month'}},{...ctx,message:FOOD_REQUEST});
 check('PI one-sided answer blocked before execution',[narrowed.ok,narrowed.intent.type,planFromIntent(narrowed.intent,ctx).kind],[true,'clarify','clarify']);
 const original={...a,from:'bot',answerId:1};
 const mutations=[
  ['description edit',x=>x.expenses[0].description+=' changed'],['category edit equal total',x=>x.expenses[0].category='material-p'],
  ['addition',x=>x.expenses.push({...x.expenses[0],id:'new'})],['deletion',x=>x.expenses.shift()],['currency',x=>x.expenses[0].currency='USD'],
  ['category rename',x=>x.cats[0].label='Meals renamed'],['category removal',x=>x.cats.shift()]];
 for(const [name,mutate] of mutations) {
  const current=clone(ctx);mutate(current);const result=markOutdatedAnswers([original],current.expenses,current.cats)[0];
  check('PI stale base and derived '+name,[result.outdated,result.planResult.base.some(p=>p.outdated),result.planResult.derived[0].outdated],[true,true,true]);
  check('PI frozen figures and input evidence '+name,[result.planResult.base.map(p=>p.totalCents),result.planResult.derived[0].display,result.planResult.base[1].evidence.rows.map(p=>p.id)],[[4000,1000],'25.00%',['p1']]);
  check('PI sticky stale after undo '+name,markOutdatedAnswers([result],ctx.expenses,ctx.cats)[0].outdated,true);
 }
 const materialEdit=clone(ctx);materialEdit.expenses[2].description='Changed paper';
 const partStale=markOutdatedAnswers([original],materialEdit.expenses,materialEdit.cats)[0];
 check('PI individual part staleness remains selective',partStale.planResult.base.map(p=>!!p.outdated),[true,false]);
 check('PI selected unaffected part keeps correct stale status',planIsStale(planEvidenceSelection(partStale.planResult,'q2')),false);
 const secondEdit=clone(materialEdit);secondEdit.expenses[0].description='New meal';
 check('PI already-stale answer still traverses other parts',markOutdatedAnswers([partStale],secondEdit.expenses,secondEdit.cats)[0].planResult.base.map(p=>!!p.outdated),[true,true]);
 const empty={...zero,from:'bot'};const added=clone(ctx);added.expenses.push({id:'jan',date:'2027-01-02',category:'meal-p',description:'Added meal',amount:10});
 check('PI initially empty scope addition stale',markOutdatedAnswers([empty],added.expenses,added.cats)[0].outdated,true);
 check('PI immutable original never gains stale flags',a.planResult.base.some(p=>p.outdated),false);
 const session=createAssistantSession(),ticket=session.begin();
 check('PI accept tagged plan',session.accept(ticket,{type:'plan',plan:a.planResult.plan},a,ctx),1);
 check('PI plan context has no chosen query',[session.getContext().kind,session.getContext().query],['plan',undefined]);
 const follow=resolveFollowup('Show those transactions',session.getContext(),ctx);
 check('PI plan evidence asks labelled choices',[follow.handled,follow.plan.kind,follow.plan.planChoices.answerId,follow.plan.planChoices.parts.map(p=>p.id)],[true,'clarify',1,['q1','q2','d1']]);
 for(const message of ['What about last month?','Only purchases over S$10','Break that down by category','Exclude paper'])check('PI plan amendment clarifies '+message,resolveFollowup(message,session.getContext(),ctx).plan.kind,'clarify');
 const selected=planEvidenceSelection(a.planResult,'d1');check('PI derived choice keeps both historical inputs',[selected.base.map(p=>p.id),selected.derived[0].display],[['q1','q2'],'25.00%']);
 check('PI unknown historical part rejected',planEvidenceSelection(a.planResult,'q9'),null);
 const choicesHtml=renderToString(<AskView hasData messages={[{from:'bot',text:follow.plan.question,planChoices:follow.plan.planChoices}]} onSend={()=>{}}/>);
 check('PI choices bound to historical answer',choicesHtml.includes('Evidence choices for answer 1'),true);
 const oldContext=session.getContext();session.failed(ticket,false);check('PI failed clarification preserves tagged context',session.getContext().answerId,oldContext.answerId);
 const ordinary=await execute('Total spending this month.'),t2=session.begin();
 session.accept(t2,{operation:'total',period:'month'},ordinary,ctx);
 check('PI independent ordinary restores normal context',session.getContext().query.operation,'total');
 check('PI ordinary follow-up remains supported',resolveFollowup('Show those transactions',session.getContext(),ctx).plan.evidence.rows.map(p=>p.id),['p1','p2','p3']);
 const historicalAfterNew=planEvidenceSelection(a.planResult,'q2');check('PI old choice still original evidence',historicalAfterNew.base[0].evidence.rows.map(p=>p.id),['p1']);
 for(const [name,action] of [['Stop',s=>s.cancel()],['Clear',s=>s.reset()],['newer request',s=>s.begin()]]) {
  const s=createAssistantSession(),old=s.begin();action(s);
  check('PI late response cannot publish '+name,[s.current(old),s.accept(old,{type:'plan'},a,ctx)],[false,null]);
 }
 // Deferred transport uses the actual client and publication barrier. It deliberately ignores abort.
 for(const action of ['Stop','Clear','newer','midnight','ledger edit']) {
  const s=createAssistantSession(),t=s.begin(),current=clone(ctx);let release;
  const response=requestIntent(FOOD_REQUEST,{...ctx,signal:t.signal,url:'http://mock.invalid',fetchImpl:async(_url,options)=>{
   await new Promise(resolve=>release=resolve);return transport(_url,options);
  }});
  if(action==='Stop')s.cancel();if(action==='Clear')s.reset();if(action==='newer')s.begin();
  if(action==='midnight')current.today='2027-03-11';
  if(action==='ledger edit')current.expenses[0].amount=11;
  release();const result=await response;
  const gate=interpretationPublication(s,t,ctx.today,current.today);
  if(action==='ledger edit') {
   const fresh=planFromIntent(result.intent,{...current,message:FOOD_REQUEST});
   check('PI pending interpretation uses one current ledger snapshot',[gate.publish,fresh.planResult.base.map(p=>p.totalCents),fresh.planResult.derived[0].display],[true,[4100,1100],'26.83%']);
  } else check('PI deferred response blocked '+action,[gate.publish,gate.reason],[false,action==='midnight'?'reference_date_changed':'cancelled']);
 }
 const manyRows=Array.from({length:151},(_,i)=>({...a.planResult.base[0].evidence.rows[0],id:'page-'+i}));
 const page=renderToString(<AnswerEvidence evidence={{rows:manyRows}} pageSize={50}/>).replace(/<!--.*?-->/g,'');
 check('PI initial evidence page bounded without changing complete source count',[(page.match(/<li/g)??[]).length,page.includes('(151)'),page.includes('50 of 151 shown'),manyRows.length],[50,true,true,151]);
 const selectedHtml=renderToString(<PlanAnswer result={planEvidenceSelection(a.planResult,'q2')}/>);
 check('PI selected historical part retains original numbering',selectedHtml.includes('2. Food &amp; Drinks spending'),true);
 const originalScope=session.getContext();
 const failedPlan=planFromIntent({type:'clarify',question:'Specify every part.'},ctx);
 check('PI plan clarification does not overwrite ordinary context',[failedPlan.kind,session.getContext().answerId===originalScope.answerId],['clarify',true]);
 const irrelevant=clone(ctx);irrelevant.expenses[3].description='Previous month irrelevant edit';
 check('PI outside all plan scopes remains current',!!markOutdatedAnswers([original],irrelevant.expenses,irrelevant.cats)[0].outdated,false);
 const compare=await execute('Compare spending this month with last month.');check('PI mock legacy comparison remains exact',compare.comparison.sides.map(p=>p.totalCents),[4000,3000]);
 const union=await execute('Total Food and Transit spending this month.');check('PI mock OR filter unchanged',union.evidence.rows.map(p=>p.id),['p1','p2']);
 const proposal=await interpret('How much did I spend on study-related purchases including paper and ink this month?');
 check('PI scope still requires approval',[proposal.intent.type,planFromIntent(proposal.intent,ctx).kind],['propose_scope','clarify']);
}
