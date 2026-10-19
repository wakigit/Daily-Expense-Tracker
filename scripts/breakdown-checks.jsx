import { renderToString } from 'react-dom/server';
import { validateQuery, generalQuerySchema } from '../src/lib/queryContract.js';
import { queryRange, executeQuery } from '../src/lib/queryEngine';
import { interpretOffline, answerOfflineQuery } from '../src/lib/queryOffline';
import { validateIntent } from '../src/lib/intent';
import { evidenceIsOutdated, markOutdatedAnswers } from '../src/lib/answerEvidence';
import AskView from '../src/views/AskView';

export function breakdownChecks(check) {
  const cats=[{id:'shop',label:'Shopping'},{id:'custom-books',label:'Books'},{id:'home-17',label:'Household'}];
  const row=(id,date,description,amount,category='shop')=>({id,date,description,amount,category});
  const expenses=[row('before','2026-07-21','Amazon',9),row('a','2026-07-22','Amazon',10.01),row('b','2026-09-01','Amazon',20.02,'custom-books'),row('c','2026-10-18','Amazon',30.03,'home-17'),row('other','2026-10-19','Another merchant',40.04)];
  const ctx={cats,expenses,today:'2026-10-19'};
  const q={operation:'breakdown',period:'last_days',dayCount:90,description:'Amazon',groupBy:'category'};
  const run=(changes={},context=ctx)=>executeQuery({...q,...changes},context);
  const result=run();
  check('breakdown inclusive 90 dates resolved locally',result.interpretation.period,'2026-07-22 to 2026-10-19 (inclusive, Singapore calendar dates)');
  check('breakdown oracle total/count', [result.breakdown.totalCents,result.breakdown.count],[6006,3]);
  check('breakdown oracle categories alphabetical custom IDs',result.breakdown.groups.map(g=>[g.key,g.totalCents,g.count]),[['custom-books',2002,1],['home-17',3003,1],['shop',1001,1]]);
  check('breakdown exact full evidence',result.evidence.rows.map(r=>r.id),['a','b','c']);
  check('breakdown group evidence partition',result.breakdown.groups.map(g=>g.evidence.rows.map(r=>r.id)),[['b'],['c'],['a']]);
  check('breakdown sum groups equals total',result.breakdown.groups.reduce((n,g)=>n+g.totalCents,0),6006);
  check('breakdown each row appears once',result.breakdown.groups.flatMap(g=>g.evidence.rows.map(r=>r.id)).sort(),['a','b','c']);
  const months=run({groupBy:'month'});
  check('breakdown month oracle chronological',months.breakdown.groups.map(g=>[g.key,g.totalCents]),[['2026-07',1001],['2026-09',2002],['2026-10',3003]]);
  check('breakdown month evidence exact rows and counts',months.breakdown.groups.map(g=>[g.count,g.evidence.rows.map(r=>r.id)]),[[1,['a']],[1,['b']],[1,['c']]]);
  check('breakdown month labels include year',months.breakdown.groups.map(g=>g.label),['July 2026','September 2026','October 2026']);
  check('breakdown optional category retains description',run({category:'custom-books'}).breakdown.totalCents,2002);
  const alternate=[...expenses,row('alt','2026-10-02','Acme Hardware',12.34,'home-17'),row('not-alt','2026-10-03','Other Hardware',100,'home-17')];
  check('breakdown arbitrary term custom category',run({description:'ACME',category:'home-17',period:'year',dayCount:null},{...ctx,expenses:alternate}).breakdown.totalCents,1234);
  check('breakdown date filter year starts January',run({period:'year',dayCount:null}).interpretation.period,'2026-01-01 to 2026-10-19 (inclusive, Singapore calendar dates)');
  const years=[row('y1','2025-10-01','Amazon',1),row('y2','2026-10-01','Amazon',2)];
  check('breakdown same month different years separate',run({period:'all',dayCount:null,groupBy:'month'},{...ctx,expenses:years}).breakdown.groups.map(g=>[g.key,g.totalCents]),[['2025-10',100],['2026-10',200]]);
  const missing=[...expenses,row('deleted-category','2026-10-18','Amazon',1.01,'gone'),row('null-category','2026-10-18','Amazon',0.02,null)];
  const unknown=run({}, {...ctx,expenses:missing});
  check('breakdown missing category never loses spending',unknown.breakdown.totalCents,6109);
  check('breakdown missing category honest labels',unknown.breakdown.groups.filter(g=>['gone',null].includes(g.key)).map(g=>g.label).sort(),['Uncategorised','Unknown category (gone)']);
  check('breakdown missing categories readable in evidence',unknown.evidence.rows.filter(r=>['deleted-category','null-category'].includes(r.id)).map(r=>r.categoryLabel),['Unknown category (gone)','Uncategorised']);
  /* A term the ledger has never contained is no longer answered as S$0.00:
     that reads as "you spent nothing on this" when the truth is "this was
     never recorded". An empty PERIOD is still a legitimate zero, so the honest
     empty-result path is exercised with a term that exists outside the range. */
  const neverSeen=run({description:'No Such Purchase'});
  check('breakdown unseen term clarifies instead of totalling zero',neverSeen.kind,'clarify');
  check('breakdown unseen term names the term',neverSeen.question.includes('No recorded purchase description contains “No Such Purchase”'),true);
  check('breakdown unseen term lists the categories',neverSeen.question.includes('Shopping, Books, Household'),true);
  const empty=run({period:'range',start:'2026-01-01',end:'2026-01-31',dayCount:null});
  check('breakdown empty exact totals',[empty.breakdown.totalCents,empty.breakdown.count,empty.breakdown.groups.length,empty.evidence.rows.length],[0,0,0,0]);
  check('breakdown empty useful message',empty.text.includes('No matching recorded expenses'),true);
  check('breakdown empty period says where the matches are',empty.detail.includes('outside this period'),true);
  const many=Array.from({length:15},(_,i)=>row(`many-${i}`,'2026-10-01','Amazon',1,`category-${i}`));
  const complete=run({}, {...ctx,expenses:many});
  check('breakdown never truncates groups or evidence',[complete.breakdown.groups.length,complete.evidence.rows.length,complete.breakdown.totalCents],[15,15,1500]);
  const checked=validateQuery(q,cats);
  check('breakdown normalized query validation round trip',validateQuery(checked.query,cats),checked);
  check('breakdown normalized cents are recomputed',validateQuery({...checked.query,amount:'1.01',amountOperator:'gte',amountCents:99999},cats).query.amountCents,101);
  const first=validateIntent({type:'analyze',query:q},{cats,message:'Amazon by category last 90 days'});
  check('breakdown intent client second validation',validateIntent(first.intent,{cats,message:'Amazon by category last 90 days'}),first);
  check('breakdown model schema required relative count',generalQuerySchema({type:['string','null']}).required.includes('dayCount'),true);
  for(const dayCount of [undefined,null,0,-1,1.5,3661,'90',NaN,Infinity]) {
    check(`breakdown invalid relative count ${String(dayCount)}`,validateQuery({...q,dayCount},cats).ok,false);
  }
  check('breakdown relative field cannot leak to month',validateQuery({...q,period:'month'},cats).field,'dayCount');
  check('breakdown range must not include relative field',validateQuery({...q,period:'range',start:'2026-01-01',end:'2026-10-19'},cats).ok,false);
  check('breakdown rejects unknown period not all-time',validateQuery({...q,period:'last_days_typo'},cats).ok,false);
  for(const groupBy of [null,'day','weekday',['category','month']]) check(`breakdown disallowed grouping ${groupBy}`,validateQuery({...q,groupBy},cats).ok,false);
  check('breakdown no group on plain total',validateQuery({...q,operation:'total'},cats).ok,false);
  check('breakdown explicit invalid date rejected',validateQuery({...q,period:'range',dayCount:null,start:'2026-02-30',end:'2026-03-01'},cats).ok,false);
  check('breakdown leap range independent oracle',queryRange({...q,dayCount:3},'2024-03-01',[]),{start:'2024-02-28',end:'2024-03-01'});
  check('breakdown non-leap oracle',queryRange({...q,dayCount:3},'2025-03-01',[]),{start:'2025-02-27',end:'2025-03-01'});
  check('breakdown last 1 day means today',queryRange({...q,dayCount:1},ctx.today,[]),{start:ctx.today,end:ctx.today});
  check('breakdown explicit dates preserved',run({period:'range',dayCount:null,start:'2026-09-01',end:'2026-10-18'}).breakdown.totalCents,5005);
  check('breakdown invalid reference date clarifies',run({}, {...ctx,today:'2026-02-30'}).kind,'clarify');
  check('breakdown relative underflow clarifies',run({}, {...ctx,today:'1900-01-01'}).kind,'clarify');
  check('breakdown future rows excluded',run({}, {...ctx,expenses:[...expenses,row('future','2026-10-20','Amazon',99)]}).breakdown.totalCents,6006);
  for (const [name,changed] of [
    ['add',[...expenses,row('new','2026-10-19','Amazon',1)]],
    ['delete',expenses.filter(e=>e.id!=='a')],
    ['amount',expenses.map(e=>e.id==='a'?{...e,amount:11}:e)],
    ['description out',expenses.map(e=>e.id==='a'?{...e,description:'Different'}:e)],
    ['description in',expenses.map(e=>e.id==='other'?{...e,description:'Amazon'}:e)],
    ['date out',expenses.map(e=>e.id==='a'?{...e,date:'2026-07-21'}:e)],
    ['date in',expenses.map(e=>e.id==='before'?{...e,date:'2026-07-22'}:e)],
    ['month group',expenses.map(e=>e.id==='a'?{...e,date:'2026-08-01'}:e)],
    ['category',expenses.map(e=>e.id==='a'?{...e,category:'home-17'}:e)],
  ]) {
    check(`breakdown stale ${name}`,markOutdatedAnswers([result],changed,cats)[0].outdated,true);
    check(`breakdown month stale ${name}`,markOutdatedAnswers([months],changed,cats)[0].outdated,true);
  }
  check('breakdown unrelated addition not stale',evidenceIsOutdated(result.evidence,[...expenses,row('unrelated','2026-10-01','Different shop',99)],cats),false);
  check('breakdown historical snapshot never rewritten',result.breakdown.groups.map(g=>g.totalCents),[2002,3003,1001]);
  check('breakdown renamed category stale',markOutdatedAnswers([result],expenses,cats.map(c=>({...c,label:c.label+' new'})))[0].outdated,true);
  for(const question of [
    'How much did I pay Amazon over the last90days, and what categories did those purchases fall into?',
    'Break down my Amazon spending by category over the last 90 days',
    'Show spending by category this month',
    'Give me a complete category breakdown of descriptions mentioning Amazon over the last 90 days',
    'Break down Amazon by category this year',
    'Show Amazon spending for each category this month',
    'Break down my Amazon spending by month this year',
    'Show "Acme Hardware" spending by month year-to-date',
  ]) check(`breakdown offline ${question}`,interpretOffline(question,cats).query?.operation,'breakdown');
  check('breakdown offline full oracle',answerOfflineQuery('How much did I pay Amazon over the last90days, and what categories did those purchases fall into?',ctx).breakdown?.totalCents,6006);
  check('breakdown offline month retains term',interpretOffline('Break down my Amazon spending by month this year',cats).query?.description,'amazon');
  for(const question of ['Show those transactions','Show these expenses','Show those transactions this month','Hello, show me those transactions','Please list all those purchases','Break that down by month','Exclude repairs']) check(`breakdown referential guard ${question}`,interpretOffline(question,cats).kind,'clarify');
  for(const question of ['Compare Amazon spending by category this month with last month','Average Amazon spending by month this year','Break down Amazon spending by week this year','Show spending by category and by month this year','Show spending by month last 0 days','Show spending by month last days','Show spending by category in the last -2 days','How much Amazon spending in the last ninety days','Show spending by month last 1.5 days']) check(`breakdown offline invalid ${question}`,interpretOffline(question,cats).kind,'clarify');
  check('breakdown quoted literal does not become grouping',interpretOffline('How much did I spend on \"Month by Month\" this year',cats).query?.description,'month by month');
  check('breakdown ordinary total preserved',executeQuery({operation:'total',period:'month'},ctx).text.includes('S$70.07'),true);
  check('breakdown comparison matching elapsed preserved',executeQuery({operation:'compare',period:'month',description:'Amazon'},ctx).comparison.sides.map(s=>s.totalCents),[3003,2002]);
  const html=renderToString(<AskView messages={[{from:'bot',...result}]} hasData onSend={()=>{}} />);
  check('breakdown UI every category subtotal', ['Books','Household','Shopping','S$20.02','S$30.03','S$10.01'].every(x=>html.includes(x)),true);
  check('breakdown UI collapsed full plus group evidence',(html.match(/<details class="answer-evidence"/g)||[]).length,4);
  check('breakdown UI no open evidence by default',html.includes('<details open'),false);
}
