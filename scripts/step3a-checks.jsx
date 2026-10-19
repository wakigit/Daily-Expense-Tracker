import { validateIntent } from '../src/lib/intent';
import { INTENT_LIMITATION as L } from '../src/lib/intentLimitations';
import { requestIntent } from '../src/lib/assistantClient';
import { planFromIntent } from '../src/lib/assistant';
import { createAssistantSession, resolveFollowup } from '../src/lib/assistantFollowup';
import { previewSpendingScope, confirmSpendingScope } from '../src/lib/spendingScope';

export async function step3aChecks(check) {
  const cats=[{id:'meal-x',label:'Lunches'},{id:'kit-x',label:'Craft supplies'},{id:'rail-x',label:'Rail fares'}];
  const row=(id,date,category,description,amount)=>({id,date,category,description,amount,notes:''});
  const ctx={cats,today:'2026-09-18',budgets:{'meal-x':40},expenses:[
    row('x1','2026-09-04','meal-x','Fictional noon meal',12.34),
    row('x2','2026-09-05','kit-x','Fictional notebook',18.76),
    row('x3','2026-08-04','meal-x','Fictional noon meal',1.11),
    row('x4','2026-09-08','rail-x','Fictional rail ticket',4.56),
  ]};
  const query={operation:'total',period:'month',category:null,category_terms:[]};
  const interpret=(message,q=query,type='analyze')=>validateIntent({type,query:q},{cats,message});
  const cases=[
    ['Lunches and Craft supplies totals in September, only weekends above S$9?',{...query,day:'weekend',amountOperator:'gt',amount:'9'},L.MULTIPLE_CATEGORIES],
    ['Compare Lunches with Rail fares during the previous month.',{...query,operation:'compare',category_terms:['Lunches','Rail fares']},L.CATEGORY_COMPARISON],
    ['How much for workshop-related purchases this year?',{...query,period:'year'},L.SCOPE_REQUIRED],
    ['Give the total this week and also the percentage spent on Lunches.',query,L.MULTIPART_PERCENTAGE],
    ['Combine Lunches and Craft supplies for September.',{...query,category_terms:['Lunches','Craft supplies'],spendingScope:{label:'Workshop',includeCategories:['meal-x'],includeTerms:[],excludeCategories:[],excludeTerms:[]}},L.SCOPE_CATEGORY_COVERAGE],
    ['Compare March with June spending.',{...query,operation:'compare',period:'range',start:'2026-03-01',end:'2026-06-30'},L.COMPARISON_PERIOD],
  ];
  for(const [message,q,reason] of cases) {
    const first=interpret(message,q);
    check('Step3A semantic reason '+reason,[first.ok,first.intent?.type,first.intent?.reason],[true,'clarify',reason]);
    check('Step3A full request retained '+reason,first.intent.question.includes(message),true);
    check('Step3A no executable query '+reason,'query' in first.intent,false);
    check('Step3A round-trip '+reason,validateIntent(first.intent,{cats,message}).intent,first.intent);
    check('Step3A planner clarifies '+reason,planFromIntent(first.intent,ctx).kind,'clarify');
  }
  for(const bad of [
    {...query,untrustedField:'not allowed'}, {...query,category:'unknown'},
    {...query,start:'2026-09-01'}, {...query,amountOperator:'gt',amount:9},
    {...query,day:'not-a-day'}, {...query,operation:'invented'},
    {...query,category_terms:['Lunches',42]},
    {...query,spendingScope:{label:'Workshop',includeCategories:[],includeTerms:[],excludeCategories:[],excludeTerms:[]}},
  ]) {
    check('Step3A malformed stays rejected '+JSON.stringify(bad),interpret('Lunches and Craft supplies related purchases this month?',bad).ok,false);
  }
  check('Step3A invented extra words on single-category question rejected',interpret('Lunches spending this month?',{...query,category_terms:['Lunches','Unknown label']}).ok,false);
  check('Step3A category-word metadata cannot execute IDs or narrow two subjects',interpret('Lunches and Craft supplies spending this month?',{...query,category_terms:['meal-x','kit-x']}).intent.type,'clarify');
  check('Step3A unknown clarification reason rejected',validateIntent({type:'clarify',reason:'invented',question:'Do this?'},{cats}).ok,false);
  const total=interpret('Recorded spending this month?');
  const plan=planFromIntent(total.intent,ctx);
  check('Step3A supported independent total',[plan.kind,plan.evidence.rows.length,plan.text.includes('S$35.66')],['answer',3,true]);
  const breakdown=planFromIntent(interpret('Spending by category this month?',{...query,operation:'breakdown',groupBy:'category'}).intent,ctx);
  check('Step3A complete breakdown',[breakdown.breakdown.totalCents,breakdown.breakdown.groups.length],[3566,3]);
  const comparison=planFromIntent(interpret('Spending this month versus last month?',{...query,operation:'compare'}).intent,ctx);
  check('Step3A supported comparison',comparison.comparison.sides.map(s=>s.totalCents),[3566,111]);
  const scoped={...query,spendingScope:{label:'Workshop purchases',includeCategories:[],includeTerms:['Fictional noon','Fictional notebook'],excludeCategories:[],excludeTerms:[]}};
  const scopeIntent=interpret('Propose explicit workshop rules this month.',scoped);
  const preview=previewSpendingScope(scopeIntent.intent.query,ctx);
  const approved=confirmSpendingScope({query:preview.query,preview},ctx);
  check('Step3A supported scope still requires approval',[scopeIntent.intent.type,preview.count,approved.kind,approved.plan.text.includes('S$31.10')],['propose_scope',2,'confirmed',true]);
  const session=createAssistantSession(),ticket=session.begin();session.accept(ticket,total.intent.query,plan,ctx);
  const clarifyTicket=session.begin();
  // App publishes a clarification without accept/failed: the canonical read survives.
  planFromIntent(interpret(cases[0][0],cases[0][1]).intent,ctx);
  check('Step3A clarification ticket current',session.current(clarifyTicket),true);
  const follow=resolveFollowup('Break that down by category.',session.getContext(),ctx);
  check('Step3A clarification preserves follow-up',[follow.plan.kind,follow.plan.breakdown.totalCents,follow.plan.breakdown.groups.length],['answer',3566,3]);
  for(const message of ['Am I managing my money well?','Is my spending healthy?','How am I doing financially?','Are my finances on track?']) {
    let requests=0;
    const result=await requestIntent(message,{...ctx,fetchImpl:async()=>{requests++;throw Error('must not call');}});
    check('Step3A broad assessment '+message,[result.source,result.intent.type,result.intent.reason,requests],['builtin','clarify',L.FINANCIAL_ASSESSMENT,0]);
  }
  check('Step3A quoted descriptions do not create semantic limitations',interpret('Spending on descriptions mentioning \"Related and percent\" this month?',{...query,description:'Related and percent'}).intent.type,'analyze');
  check('Step3A greeting stays help',(await requestIntent('Hello!',ctx)).intent.type,'help');
  const help=interpret('???? 🎨🎨 ....',query,'help');
  check('Step3A model noise help stays help',[help.ok,help.intent.type],[true,'help']);
  const failure=await requestIntent('What did I spend on Lunches this week?',{...ctx,fetchImpl:async()=>({ok:false,status:503,json:async()=>({error:'provider_timeout'})})});
  check('Step3A provider failure not converted',[failure.ok,failure.reason],[false,'provider_timeout']);
}
