import {validateQuery} from '../src/lib/queryContract';
import {validateIntent} from '../src/lib/intent';
import {executeQuery} from '../src/lib/queryEngine';
import {evidenceIsOutdated,markOutdatedAnswers} from '../src/lib/answerEvidence';
import {captureQueryContext,resolveFollowup} from '../src/lib/assistantFollowup';
import {interpretOffline,answerOfflineQuery} from '../src/lib/queryOffline';
import {comparisonRanges} from '../src/lib/comparison';
import {requestIntent} from '../src/lib/assistantClient';
import {comparisonContext,namedPeriod as month,rangePeriod as range,periodQuery as periods,categoryQuery as categories} from './comparison-v2-fixture';
export async function comparisonV2Checks(check){
 const ctx=comparisonContext(),cats=ctx.cats;
 const q=periods(month('2026-09'),month('2026-07'),{category:'art-v'});
 const run=(query,extra={})=>executeQuery(query,{...ctx,...extra});
 const sides=p=>p.comparison.sides.map(s=>[s.totalCents,s.count,s.evidence.rows.map(r=>r.id).sort()]);
 const named=run(q,{message:'Compare Art lab spending in September with July.'});
 check('B2 nonadjacent exact figures/count/evidence',sides(named),[[4000,2,['v3','v4']],[2000,2,['v1','v2']]]);
 check('B2 full completed months',named.comparison.sides.map(s=>[s.start,s.end,s.calendarDays]),[['2026-09-01','2026-09-30',30],['2026-07-01','2026-07-31',31]]);
 check('B2 difference and named percentage baseline',[named.comparison.differenceCents,named.comparison.percentage,named.comparison.baselineKey,named.detail.includes('baseline July 2026')],[2000,100,'second',true]);
 check('B2 unequal durations disclosed',named.detail.includes('Unequal intervals'),true);
 const explicit=run(periods(range('2026-01-01','2026-01-15'),range('2026-02-01','2026-02-15'),{category:'art-v'}));
 check('B2 two ranges tie exact evidence',sides(explicit),[[1000,2,['v10','v9']],[1000,2,['v12','v13']]]);
 check('B2 tie exact zero difference',[explicit.comparison.differenceCents,explicit.comparison.larger,explicit.comparison.percentage],[0,'tie',0]);
 const catq=categories('art-v','cycle-v'),cat=run(catq,{message:'Did I spend more on Art lab or Cycle club this month?'});
 check('B2 category sides stay separate',sides(cat),[[1444,2,['v6','v8']],[2222,1,['v7']]]);
 check('B2 symmetric category no arbitrary baseline',[cat.comparison.differenceCents,cat.comparison.percentage,cat.comparison.baselineKey],[-778,null,null]);
 check('B2 both side labels and filters',cat.comparison.sides.map(s=>[s.label,s.filters.includes(s.label)]),[['Art lab',true],['Cycle club',true]]);
 const orq=periods({period:'lastmonth'},{period:'month'},{descriptionTerms:['MetroFox','CloudCab']}),or=run(orq);
 check('B2 OR periods retain every row once',sides(or),[[4725,3,['v3','v4','v5']],[3666,3,['v6','v7','v8']]]);
 check('B2 OR disclosure both sides',or.comparison.sides.every(s=>s.filters.includes('metrofox')&&s.filters.includes('cloudcab')),true);
 const both=run({...orq,categories:['art-v','cycle-v'],day:'weekday',amountOperator:'gte',amount:'10'});
 check('B2 category OR description OR weekday amount intersection',sides(both),[[4000,2,['v3','v4']],[3333,2,['v6','v7']]]);
 const alignedOr=run({operation:'compare',period:'month',descriptionTerms:['MetroFox','CloudCab']});
 check('B2 implicit OR comparison retains elapsed alignment',alignedOr.comparison.sides.map(s=>[s.start,s.end,s.totalCents]),[['2026-10-01','2026-10-20',3666],['2026-09-01','2026-09-20',3666]]);
 const zero=run(periods(month('2026-06'),month('2026-07'),{category:'art-v'}));
 check('B2 zero/empty baseline',[zero.comparison.percentage,zero.comparison.sides[0].count,zero.detail.includes('undefined'),zero.detail.includes('not proof')],[null,0,true,true]);
 const overlap=run(periods(range('2026-07-01','2026-07-15'),range('2026-07-10','2026-07-31'),{category:'art-v'}));
 check('B2 overlap keeps shared row independently',sides(overlap),[[2000,2,['v1','v2']],[683,1,['v2']]]);
 check('B2 overlap no baseline and disclosure',[overlap.comparison.percentage,overlap.comparison.overlap,overlap.detail.includes('no cross-side deduplication')],[null,true,true]);
 const duplicate=run(q,{expenses:[...ctx.expenses,{...ctx.expenses[0]}]});
 check('B2 within side ID dedup',sides(duplicate),sides(named));
 check('B2 deduplicated evidence not immediately stale',evidenceIsOutdated(duplicate.comparison.sides[1].evidence,[...ctx.expenses,{...ctx.expenses[0]}],cats),false);
 check('B2 legacy intent cannot drop comparison sides',validateIntent({type:'answer',query:{metric:'compare',period:'month',comparison:catq.comparison}},{cats}).ok,false);
 check('B2 leap February whole month',run(periods(month('2024-02'),month('2026-02'))).comparison.sides.map(s=>s.end),['2024-02-29','2026-02-28']);
 const crossYear=run(periods(month('2025-12'),month('2026-01'),{category:'art-v'}));
 check('B2 explicit year transition totals and exact ranges',crossYear.comparison.sides.map(s=>[s.start,s.end,s.totalCents]),[['2025-12-01','2025-12-31',909],['2026-01-01','2026-01-31',10000]]);
 check('B2 year transition aligned',comparisonRanges('month','2026-01-10').earlier,{start:'2025-12-01',end:'2025-12-10'});
 check('B2 shorter aligned February',comparisonRanges('month','2024-03-31'),{current:{start:'2024-03-01',end:'2024-03-31'},earlier:{start:'2024-02-01',end:'2024-02-29'},capped:true});
 check('B2 week year transition',comparisonRanges('week','2026-01-01').earlier,{start:'2025-12-22',end:'2025-12-25'});
 check('B2 future interval cap disclosed',run(periods(range('2026-10-01','2026-10-31'),month('2026-09'))).detail.includes('Future dates'),true);
 check('B2 entirely future side refuses',run(periods(month('2026-11'),month('2026-09'))).kind,'clarify');
 const mismatch=run(periods(range('2026-09-01','2026-09-19'),month('2026-07')),{message:'Compare my September spending with July.'});
 check('B2 cannot call shortened interval a full named month',mismatch.kind,'clarify');
 check('B2 third named month cannot disappear',run(q,{message:'Compare September, July and June spending.'}).kind,'clarify');
 check('B2 category plus different periods refuses',run(catq,{message:'Compare Art lab in September with Cycle club in July.'}).kind,'clarify');
 check('B2 different side filters cannot become union',run({...q,category:null,categories:['art-v','cycle-v']},{message:'Compare Art lab in September with Cycle club in July.'}).kind,'clarify');
 check('B2 implicit request cannot be silently changed to full previous month',run(orq,{message:'Compare purchases mentioning MetroFox or CloudCab last month with this month.'}).kind,'clarify');
 check('B2 category common explicit range accepted',run({...catq,period:'range',start:'2026-07-01',end:'2026-07-31'},{message:'Compare Art lab versus Cycle club from 2026-07-01 to 2026-07-31.'}).kind,'answer');
 for(const query of [q,catq,orq]){
  const first=validateQuery(query,cats);check('B2 query normalises '+JSON.stringify(query),first.ok,true);check('B2 query round trip '+JSON.stringify(query),validateQuery(first.query,cats),first);
 }
 for(const comparison of [
  {kind:'categories',categories:['art-v'],periods:[]},{kind:'categories',categories:['art-v','missing'],periods:[]},
  {kind:'categories',categories:['art-v','art-v'],periods:[]},{kind:'categories',categories:['art-v','cycle-v','pantry-v'],periods:[]},
  {kind:'periods',categories:[],periods:[month('2026-07')]},{kind:'periods',categories:[],periods:[month('2026-07'),month('2026-13')]},
  {kind:'periods',categories:[],periods:[range('2026-02-30','2026-03-01'),month('2026-07')]},
  {kind:'periods',categories:[],periods:[{...month('2026-07'),total:99},month('2026-09')]},
  {kind:'periods',categories:['art-v'],periods:[month('2026-07'),month('2026-09')]},
 ])check('B2 malformed sides rejected '+JSON.stringify(comparison),validateQuery({...q,comparison},cats).ok,false);
 for(const patch of [{operation:'total'},{period:'month'},{dayCount:3},{category:'missing'}])check('B2 conflicting outer scope rejected '+JSON.stringify(patch),validateQuery({...q,...patch},cats).ok,false);
 const scope={label:'Related',includeCategories:[],includeTerms:['metrofox'],excludeCategories:[],excludeTerms:[]};
 check('B2 reviewed scope compare refuses',run({...q,spendingScope:scope},{approvedScope:scope}).kind,'clarify');
 const validated=validateIntent({type:'analyze',query:catq},{cats,message:'Did I spend more on Art lab or Cycle club this month?'});
 check('B2 category intent is comparison not union',[validated.ok,validated.intent.type,validated.intent.query.comparison.kind],[true,'analyze','categories']);
 const paraphrase='Was my Art lab total higher between January1–15 or February1–15?';
 check('B2 legacy scalar cannot answer comparison wording',validateIntent({type:'answer',query:{metric:'total',period:'month',category:'art-v'}},{cats,message:paraphrase}).intent.type,'clarify');
 check('B2 one-sided live failure shape clarifies',validateIntent({type:'analyze',query:{operation:'total',period:'range',start:'2026-01-01',end:'2026-01-15',category:'art-v'}},{cats,message:paraphrase}).intent.type,'clarify');
 check('B2 executor independently blocks one-sided comparative answer',run({operation:'total',period:'range',start:'2026-01-01',end:'2026-01-15',category:'art-v'},{message:paraphrase}).kind,'clarify');
 check('B2 higher paraphrase is comparison',validateIntent({type:'analyze',query:q},{cats,message:'Was Art lab spending higher in September or July?'}).intent.type,'analyze');
 check('B2 higher question cannot become a union',validateIntent({type:'analyze',query:{operation:'total',categories:['art-v','cycle-v']}},{cats,message:'Was Art lab or Cycle club spending higher this month?'}).intent.type,'clarify');
 check('B2 intent server/client round trip',validateIntent(validated.intent,{cats,message:'Did I spend more on Art lab or Cycle club this month?'}).intent,validated.intent);
 check('B2 union wording does not accept comparison intent',validateIntent({type:'analyze',query:catq},{cats,message:'Total Art lab and Cycle club this month.'}).intent.type,'clarify');
 check('B2 missing third requested category clarifies',validateIntent({type:'analyze',query:catq},{cats,message:'Compare Art lab versus Cycle club versus Pantry this month.'}).intent.type,'clarify');
 const context=captureQueryContext(catq,cat,ctx,1);
 for(const text of ['Show those transactions.','Break that down by month.','What about last month?','Only purchases over S$5.'])check('B2 comparison followup cannot choose a side '+text,resolveFollowup(text,context,ctx).plan.kind,'clarify');
 for(const side of named.comparison.sides){
  const id=side.evidence.rows[0].id;
  for(const [kind,expenses]of [['edit',ctx.expenses.map(r=>r.id===id?{...r,amount:99}:r)],['delete',ctx.expenses.filter(r=>r.id!==id)],['add',[...ctx.expenses,{...side.evidence.rows[0],id:'added'}]]])check('B2 either side stale '+side.key+kind,markOutdatedAnswers([named],expenses,cats)[0].outdated,true);
  check('B2 independent immutable side '+side.key,side.evidence.rows.reduce((s,r)=>s+Math.round(r.amount*100),0),side.totalCents);
 }
 check('B2 category rename/removal stale',markOutdatedAnswers([cat],ctx.expenses,cats.filter(c=>c.id!=='cycle-v'))[0].outdated,true);
 const emptyCategory=run(categories('art-v','pantry-v'));
 check('B2 empty-side category removal still stale',markOutdatedAnswers([emptyCategory],ctx.expenses,cats.filter(c=>c.id!=='pantry-v'))[0].outdated,true);
 check('B2 foreign currency refuses',run(q,{expenses:ctx.expenses.map(r=>r.id==='v3'?{...r,currency:'USD'}:r)}).kind,'clarify');
 check('B2 currency edit invalidates old evidence',evidenceIsOutdated(named.comparison.sides[0].evidence,ctx.expenses.map(r=>r.id==='v3'?{...r,currency:'USD'}:r),cats),true);
 for(const [text,totals]of [
  ['Compare Art lab spending in September with July.',[4000,2000]],
  ['Compare Art lab from 2026-01-01 to 2026-01-15 versus 2026-02-01 to 2026-02-15.',[1000,1000]],
  ['Did I spend more on Art lab or Cycle club this month?',[1444,2222]],
  ['Compare purchases mentioning MetroFox or CloudCab last month with this month.',[3666,3666]],
 ]){const plan=answerOfflineQuery(text,ctx);check('B2 offline exact full request '+text,[plan.kind,plan.comparison?.sides.map(s=>s.totalCents)],['answer',totals]);}
 const fail=await requestIntent('Compare Art lab September with July.',{...ctx,fetchImpl:async()=>({ok:false,status:503,json:async()=>({error:'provider_connection_failed'})})});
 check('B2 real provider error path remains error',[fail.ok,fail.reason],[false,'provider_connection_failed']);
}
