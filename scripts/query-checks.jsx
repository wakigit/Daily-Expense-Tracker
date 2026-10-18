import { validateQuery, validDate } from '../src/lib/queryContract.js';
import { executeQuery } from '../src/lib/queryEngine';
import { interpretOffline, answerOfflineQuery } from '../src/lib/queryOffline';
import { evidenceIsOutdated, markOutdatedAnswers } from '../src/lib/answerEvidence';
import { parseDateSearch } from '../src/lib/dateSearch';
import { filterAndSort } from '../src/lib/search';
import { validateIntent } from '../src/lib/intent';
export function queryChecks(check) {
  const cats=[{id:'custom-meals',label:'Food'},{id:'travel-42',label:'Public transport'},{id:'leisure',label:'Creative hobbies'}];
  const row=(id,date,description,amount,category='custom-meals')=>({id,date,description,amount,category});
  const expenses=[row('a','2026-10-01','Chicken rice',10),row('b','2026-10-02','Chicken rice',10.01),row('c','2026-10-03','Chicken rice',20),row('d','2026-10-04','Kopi',0.1),row('e','2026-10-05','Grab ride',15,'travel-42'),row('f','2026-10-06','GrabFood lunch',20),row('g','2026-10-07','Art class',15,'leisure'),row('h','2026-09-02','Chicken rice',8),row('future','2026-10-19','Chicken rice',999)];
  const ctx={expenses,cats,today:'2026-10-18',budgets:{'custom-meals':100,'leisure':20}};
  const run=(q={})=>executeQuery({operation:'total',period:'month',...q},ctx);
  const ids=r=>(r.evidence?.rows??[]).map(e=>e.id).sort();
  check('query total cents independent sum 1000+1001+2000+10+1500+2000+1500',run().text.includes('S$90.11'),true);
  check('query category and strict over boundary',ids(run({operation:'list',category:'custom-meals',amountOperator:'gt',amount:'10.00'})),['b','c','f']);
  check('query inclusive threshold',ids(run({operation:'list',amountOperator:'gte',amount:'15'})),['c','e','f','g']);
  check('query strict under threshold',ids(run({operation:'list',amountOperator:'lt',amount:'10'})),['d']);
  check('query at most exact cents',ids(run({operation:'list',amountOperator:'lte',amount:'10.01'})),['a','b','d']);
  check('query arbitrary text plus category plus threshold',ids(run({operation:'list',category:'custom-meals',description:'CHICKEN',amountOperator:'gte',amount:'10.01'})),['b','c']);
  check('query empty results',ids(run({description:'not recorded'})),[]);
  const types=run({operation:'day_types'});
  check('weekdays/weekends totals cents',types.comparison.sides.map(s=>s.totalCents),[7001,2010]);
  check('weekdays/weekends calendar denominator incl empty days',types.comparison.sides.map(s=>s.calendarDays),[12,6]);
  check('weekday evidence exact',types.comparison.sides[1].evidence.rows.map(e=>e.id),['c','d']);
  const usual=run({operation:'highest',groupBy:'weekday',aggregate:'daily_average'});
  check('usual weekday winning average per occurrence',usual.analysisGroups.find(g=>g.key==='Tuesday').value,2000/2);
  check('usual weekday winning rows',ids(usual),['f']);
  const top=run({operation:'highest',groupBy:'day'});
  check('highest day ties retain both exact groups',ids(top),['c','f']);
  check('highest group evidence competing edit invalidates',evidenceIsOutdated(top.evidence,expenses.map(e=>e.id==='a'?{...e,amount:99}:e),cats),true);
  const cmp=run({operation:'compare',description:'chicken rice'});
  check('description comparison totals',cmp.comparison.sides.map(s=>s.totalCents),[4001,800]);
  check('description comparison cents difference',cmp.comparison.differenceCents,3201);
  check('description comparison evidence both sides',cmp.comparison.sides.map(s=>s.evidence.rows.map(e=>e.id)),[['a','b','c'],['h']]);
  const zero=run({operation:'compare',category:'leisure'});
  check('comparison zero baseline percentage unavailable',zero.comparison.percentage,null);
  check('comparison missing logs limitation',zero.detail.includes('not a reliable spending trend'),true);
  const projection=run({operation:'projection',category:'custom-meals'});
  check('projection method actual elapsed days',projection.detail.includes('18 elapsed calendar days'),true);
  check('projection enough distinct dates has calculated date',projection.text.includes('2026-10-30'),true);
  check('projection budget edit stale',markOutdatedAnswers([projection],expenses,cats,{'custom-meals':99})[0].outdated,true);
  check('projection missing budget',executeQuery({operation:'projection',category:'travel-42',period:'month'},{...ctx,budgets:{}}).text.includes('No budget set'),true);
  check('projection already exceeded',executeQuery({operation:'projection',category:'custom-meals',period:'month'},{...ctx,budgets:{'custom-meals':5}}).text.includes('exceeded by S$55.11'),true);
  check('projection limited distinct history',run({operation:'projection',category:'leisure'}).text.includes('Too little history'),true);
  check('projection zero spend no division',executeQuery({operation:'projection',category:'leisure',period:'month'},{...ctx,expenses:[],budgets:{leisure:20}}).text.includes('no rate'),true);
  check('unknown category rejected',validateQuery({operation:'total',category:'made-up'},cats).ok,false);
  check('multi-category rejected',validateQuery({operation:'total',category:'custom-meals',category_terms:['Food','Creative hobbies']},cats).ok,false);
  check('query invented totals rejected',validateQuery({operation:'total',total:42},cats).ok,false);
  check('query invented IDs rejected',validateQuery({operation:'list',ids:['a']},cats).ok,false);
  check('unsupported compare not total',run({operation:'compare',period:'lastmonth'}).kind,'clarify');
  check('invalid date no rollover',validDate('2026-02-30'),false);
  check('valid leap day',validDate('2024-02-29'),true);
  for(const date of ['2026-10-03','3/10/2026','3 Oct','3 OCT 2026'])check(`date search ${date}`,parseDateSearch(date,'2026').date,'2026-10-03');
  check('search invalid dates no rows',filterAndSort(expenses,'31/2/2026','date',()=>null,'2026').length,0);
  check('date search exact rows',filterAndSort(expenses,'3 Oct','date',()=>null,'2026').map(e=>e.id),['c']);
  const scoped=run({description:'chicken rice'});
  check('description matching addition invalidates',evidenceIsOutdated(scoped.evidence,[...expenses,row('new','2026-10-08','Chicken rice',10)],cats),true);
  check('irrelevant addition stays current',evidenceIsOutdated(scoped.evidence,[...expenses,row('new','2026-10-08','Taxi',10)],cats),false);
  check('changed source invalidates',evidenceIsOutdated(scoped.evidence,expenses.map(e=>e.id==='a'?{...e,amount:11}:e),cats),true);
  check('deleted source invalidates',evidenceIsOutdated(scoped.evidence,expenses.filter(e=>e.id!=='a'),cats),true);
  const all=run({period:'all'});check('new earlier all-history row invalidates',evidenceIsOutdated(all.evidence,[...expenses,row('old','2026-08-01','Kopi',1)],cats),true);
  for(const [question,expected] of [
    ['Show Food expenses over S$10 this month',['b','c','f']],
    ['Find Grab transactions of at least S$15 this month',['e','f']],
    ['Show purchases under S$5 yesterday',[]],
    ['Show Creative hobbies transactions at most S$15 this month',['g']],
    ['Show chicken rice purchases from 2026-10-01 to 2026-10-03',['a','b','c']],
  ])check(`offline general variation ${question}`,ids(answerOfflineQuery(question,ctx)),expected);
  check('offline weekday family',answerOfflineQuery('Did I spend less money on weekdays or weekends this month?',ctx).intent,'day_types');
  check('offline usual weekday family',answerOfflineQuery('What day of the week do I usually spend the most money?',ctx).intent,'highest');
  check('offline comparison arbitrary term',answerOfflineQuery('Did I spend less on chicken rice this month than last month?',ctx).comparison?.differenceCents,3201);
  check('offline projection custom category',answerOfflineQuery('When will I run out of my Creative hobbies budget?',ctx).budgetEvidence?.category,'leisure');
  check('offline missing threshold clarifies',interpretOffline('Show purchases over last week',cats).kind,'clarify');
  check('offline unknown period clarifies',interpretOffline('Compare this year with last year',cats).kind,'clarify');
  const raw={type:'analyze',query:{operation:'list',category:'custom-meals',period:'month',amountOperator:'gt',amount:'10'}};
  const first=validateIntent(raw,{cats});check('shared query server validates',first.ok,true);check('shared query client revalidates',validateIntent(first.intent,{cats}).ok,true);
  check('quoted category word stays description only',interpretOffline('Show descriptions mentioning "Food" this month',cats).query?.category,null);
  check('quoted search retained verbatim',interpretOffline('Show descriptions mentioning "Food" this month',cats).query?.description,'food');
  check('malformed fractional cents rejected',validateQuery({operation:'list',amountOperator:'gt',amount:'1.001'},cats).ok,false);
  check('query invalid reversed dates',run({period:'range',start:'2026-10-10',end:'2026-10-01'}).kind,'clarify');
  check('unknown month-like word remains ordinary text',parseDateSearch('17 Octopus','2026').kind,'text');
  const differing=executeQuery({operation:'day_types',period:'range',start:'2026-10-05',end:'2026-10-11'},{...ctx,expenses:[...['05','06','07','08','09'].map(d=>row(d,`2026-10-${d}`,'Meal',10)),row('sat','2026-10-10','Meal',20),row('sun','2026-10-11','Meal',20)]});
  check('different total and daily-average conclusions explained',differing.detail.includes('conclusions differ'),true);
  check('beyond month end estimate explicitly disclosed',executeQuery({operation:'projection',period:'month',category:'custom-meals'},{...ctx,budgets:{'custom-meals':200}}).text.includes('month-end'),true);
  check('cent exact decimal sums',executeQuery({operation:'total',period:'month'},{...ctx,expenses:[row('x','2026-10-01','Kopi',0.1),row('y','2026-10-02','Kopi',0.2)]}).text.includes('S$0.30'),true);
  const zeroDays=executeQuery({operation:'day_types',period:'range',start:'2026-10-05',end:'2026-10-05'},ctx);
  check('no calendar weekends honest unavailable average',zeroDays.comparison.sides[1].averageCents,null);

  check('offline multiple descriptions never silently narrowed',interpretOffline('Show Grab and taxi transactions this month',cats).kind,'clarify');

  const weekCtx={...ctx,today:'2026-10-19',expenses:['11','12','18','19'].map(d=>row(d,`2026-10-${d}`,'Fictional tram',20,'travel-42'))};
  const lastWeek=executeQuery({operation:'list',period:'lastweek',description:'tram',amountOperator:'gte',amount:'20'},weekCtx);
  check('last week previous Monday through Sunday includes both boundaries',ids(lastWeek),['12','18']);
  check('last week exact visible range',lastWeek.interpretation.period.includes('2026-10-12 to 2026-10-18'),true);
  const shorter=executeQuery({operation:'compare',period:'month',description:'rice'},{...ctx,today:'2026-03-31',expenses:[row('mar','2026-03-31','Rice',0.3),row('feb','2026-02-28','Rice',0.1)]});
  check('shorter month never rolls over',shorter.comparison.sides[1].end,'2026-02-28');
  check('shorter month limitation disclosed',shorter.detail.includes('fewer days'),true);
  check('partial comparison exact cents',shorter.comparison.differenceCents,20);
  const partial=executeQuery({operation:'compare',period:'week'},{...ctx,today:'2026-10-01',expenses:[row('now','2026-10-01','Kopi',10),row('then','2026-09-24','Kopi',10),row('excluded','2026-09-25','Kopi',99)]});
  check('partial week corresponding Monday through Thursday',partial.comparison.sides.map(s=>[s.start,s.end]),[['2026-09-28','2026-10-01'],['2026-09-21','2026-09-24']]);
  check('equal totals exact zero difference',partial.comparison.differenceCents,0);
  check('equal totals zero percent',partial.comparison.percentage,0);
  const avg=run({operation:'average',aggregate:'daily_average',description:'chicken rice'});
  check('average includes all 18 calendar days',avg.text.includes('denominator 18'),true);
  check('projection exact budget is exhausted, not exceeded',executeQuery({operation:'projection',period:'month',category:'custom-meals'},{...ctx,budgets:{'custom-meals':60.11}}).text.includes('exactly exhausted'),true);
  const brief=executeQuery({operation:'projection',period:'month',category:'custom-meals'},{...ctx,today:'2026-10-06',budgets:{'custom-meals':100}});
  check('projection six elapsed days suppress date despite multiple spending dates',brief.text.includes('Too little history'),true);
  check('source addition on comparison earlier side stale',evidenceIsOutdated(cmp.comparison.sides[1].evidence,[...expenses,row('earlier-new','2026-09-10','Chicken rice',1)],cats),true);

  check('model cannot omit a second named category',validateIntent({type:'analyze',query:{operation:'total',category:'custom-meals',period:'month'}},{cats,message:'Food and Public transport spending this month'}).ok,false);

  const historyPattern=run({operation:'highest',groupBy:'weekday',aggregate:'daily_average',period:'all',category:'custom-meals'});
  check('earlier other-category row changes default history denominator and marks stale',evidenceIsOutdated(historyPattern.evidence,[...expenses,row('earlier-other','2026-08-01','Art',1,'leisure')],cats),true);

  // Regression: a leading number does not make a description a date.
  for (const text of ['7 Eleven', '20 dollars', '365 day pass', '2026 Annual pass', '2026-Annual pass', '7/11 sandwich', '17 October coffee']) {
    check(`date search ordinary description: ${text}`, parseDateSearch(text, '2026').kind, 'text');
  }
  for (const [text,date] of [
    ['2026-10-17','2026-10-17'], ['17/10/2026','2026-10-17'],
    ['17 oCt','2026-10-17'], ['17 OCTOBER','2026-10-17'],
    ['17 October 2025','2025-10-17'], ['29 fEb 2024','2024-02-29'],
  ]) check(`date search valid regression: ${text}`,parseDateSearch(text,'2026'),{kind:'date',date});
  check('date search uses selected header year',parseDateSearch('17 Oct','2030').date,'2030-10-17');
  for (const text of ['31 Feb', '31 APRIL', '29 Feb 2025', '2026-02-30', '31/4/2026', '2026-13-01', '17 Oct 20', '2026-10-', '17/10/']) {
    const parsed=parseDateSearch(text,'2026');
    check(`date search invalid genuine date: ${text}`,parsed.kind,'invalid');
    check(`date search clear error: ${text}`,Boolean(parsed.message?.includes('valid calendar date')),true);
  }
  const numberLeading=[row('shop','2026-10-17','7 Eleven',7),row('cash','2026-10-17','20 dollars',20)];
  for(const [text,id] of [['7 Eleven','shop'],['20 dollars','cash']]) {
    check(`number-leading text selects matching ledger row: ${text}`,filterAndSort(numberLeading,text,'date',()=>cats[0],'2026').map(e=>e.id),[id]);
  }

}
