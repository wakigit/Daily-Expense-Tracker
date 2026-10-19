import {validateQuery,matchingRows} from '../src/lib/queryContract';
import {validateIntent} from '../src/lib/intent';
import {executeQuery} from '../src/lib/queryEngine';
import {evidenceIsOutdated} from '../src/lib/answerEvidence';
import {captureQueryContext,resolveFollowup} from '../src/lib/assistantFollowup';
import {previewSpendingScope,confirmSpendingScope} from '../src/lib/spendingScope';
import {interpretOffline} from '../src/lib/queryOffline';
import {orContext,orQuery} from './or-filter-fixture';
import {sumCents} from '../src/lib/money';

export function orFilterChecks(check){
  const ctx=orContext(), cats=ctx.cats;
  const run=patch=>executeQuery({...orQuery,...patch},ctx);
  const ids=plan=>plan.evidence?.rows.map(r=>r.id).sort();
  const assertRows=(label,patch,cents,want)=>{
    const p=run(patch);
    check('OR '+label+' kind',p.kind,'answer');
    check('OR '+label+' exact cents/count/IDs',[sumCents(p.evidence.rows),p.evidence.rows.length,ids(p)],[cents,want.length,[...want].sort()]);
    return p;
  };
  const answer=assertRows('intersection',{},7105,['u1','u2','u3','u7','u9']);
  assertRows('categories union',{descriptionTerms:[]},7711,['u1','u2','u3','u6','u7','u9']);
  assertRows('description union',{categories:[],category_terms:[]},11109,['u1','u2','u3','u4','u7','u9']);
  assertRows('last30 inclusive',{period:'last_days',dayCount:30,categories:[],category_terms:[]},11816,['u1','u2','u3','u4','u5','u7','u9','u10']);
  assertRows('inclusive amount',{amountOperator:'gte',amount:'10.01'},6006,['u1','u2','u3']);
  assertRows('strict amount',{amountOperator:'gt',amount:'10.01'},5005,['u2','u3']);
  assertRows('weekend AND',{day:'weekend'},3003,['u3']);
  assertRows('empty intersection',{amountOperator:'gt',amount:'100'},0,[]);
  assertRows('literal not regex',{descriptionTerms:['Blue.*'],category_terms:[]},0,[]);
  const duplicate=executeQuery(orQuery,{...ctx,expenses:[...ctx.expenses,{...ctx.expenses[2]}]});
  check('OR duplicate ID and overlapping terms counted once',[sumCents(duplicate.evidence.rows),ids(duplicate)],[7105,['u1','u2','u3','u7','u9']]);
  check('OR all filters visible', ['Studio kits','Bicycle upkeep','bluecab','swiftvan','literal','OR'].every(t=>answer.text.includes(t)),true);
  const narrow=run({amountOperator:'gte',amount:'10.01',day:'weekday'});
  check('OR disclosure intersection names day and amount',[narrow.text.includes('at least S$10.01'),narrow.text.includes('Mondays to Fridays only')],[true,true]);
  check('OR interpretation does not claim all categories',answer.interpretation.category.includes('All categories'),false);
  const normal=validateQuery({...orQuery,categories:['studio-x','cycle-y','studio-x'],descriptionTerms:['  BLUECAB  ','SwiftVan','bluecab']},cats);
  check('OR canonical lists', [normal.query.categories,normal.query.descriptionTerms],[['cycle-y','studio-x'],['bluecab','swiftvan']]);
  check('OR validation round trip',validateQuery(normal.query,cats),normal);
  const message='Total Studio kits and Bicycle upkeep purchases mentioning BlueCab or SwiftVan this month.';
  const intent=validateIntent({type:'analyze',query:orQuery},{cats,message});
  check('OR intent accepts explicit intersection',intent.intent.type,'analyze');
  check('OR server/client intent round trip',validateIntent(JSON.parse(JSON.stringify(intent.intent)),{cats,message}).intent,intent.intent);
  const simple=executeQuery({operation:'total',period:'month',category:'studio-x'},ctx);
  check('OR old scalar unchanged',[sumCents(simple.evidence.rows),ids(simple)],[4610,['u1','u3','u6']]);
  assertRows('scalar category plus description list',{categories:[],category:'studio-x',category_terms:['Studio kits']},4004,['u1','u3']);
  assertRows('category list plus scalar description',{descriptionTerms:[],description:'SwiftVan'},5105,['u2','u3','u9']);
  for(const groupBy of ['category','month']){
    const b=run({operation:'breakdown',groupBy,period:'year',descriptionTerms:[]});
    check('OR '+groupBy+' grand total and count',[b.breakdown.totalCents,b.breakdown.count],[8418,8]);
    check('OR '+groupBy+' independent group cents',b.breakdown.groups.map(g=>[g.key,g.totalCents]),groupBy==='month'?[['2026-09',707],['2026-10',7711]]:[['cycle-y',3606],['studio-x',4812]]);
    check('OR '+groupBy+' partitions recombine',b.breakdown.groups.reduce((s,g)=>s+g.totalCents,0),8418);
    check('OR '+groupBy+' full/group evidence',b.breakdown.groups.flatMap(g=>g.evidence.rows.map(r=>r.id)).sort(),ids(b));
  }
  for(const operation of ['count','list'])assertRows(operation,{operation},7105,['u1','u2','u3','u7','u9']);
  for(const [aggregate,amount]of [['per_transaction','S$14.21'],['daily_average','S$3.74'],['calendar_week','S$26.18'],['calendar_month','S$71.05']]){
    const p=run({operation:'average',aggregate});check('OR average '+aggregate,[p.kind,p.text.startsWith(amount),ids(p)],['answer',true,['u1','u2','u3','u7','u9']]);
  }
  const high=run({operation:'highest',groupBy:'category',descriptionTerms:[]});
  check('OR winner preserves candidate basis',[ids(high),high.evidence.basis.map(r=>r.id).sort()],[['u1','u3','u6'],['u1','u2','u3','u6','u7','u9']]);
  check('OR largest and latest',[ids(run({operation:'largest'})),ids(run({operation:'latest'}))],[['u3'],['u9']]);
  const dayTypes=run({operation:'day_types',descriptionTerms:[]});
  check('OR day types partition',dayTypes.comparison.sides.map(s=>s.totalCents),[4708,3003]);
  for(const operation of ['projection']){
    const c=validateIntent({type:'analyze',query:{...orQuery,operation}},{cats,message});check('OR unsupported '+operation,[c.ok,c.intent.type,c.intent.reason],[true,'clarify','or_operation_unsupported']);
  }
  for(const patch of [
    {categories:null},{descriptionTerms:null},{categories:'studio-x'},{descriptionTerms:'BlueCab'},
    {categories:['unknown']},{categories:[' studio-x']},{categories:['studio-x',4]},
    {categories:Array(9).fill('studio-x')},{descriptionTerms:Array(9).fill('a')},
    {descriptionTerms:['']},{descriptionTerms:['  ']},{descriptionTerms:[7]},{descriptionTerms:['a'.repeat(81)]},
    {category:'studio-x'},{description:'BlueCab'},{untrustedSQL:'select all'},
  ]) check('OR invalid filter rejected '+JSON.stringify(patch),validateQuery({...orQuery,...patch},cats).ok,false);
  check('OR empty arrays remain backwards compatible',validateQuery({operation:'total',period:'month',categories:[],descriptionTerms:[]},cats).ok,true);
  check('OR unknown inherited list cannot broaden into all categories',executeQuery({...orQuery,categories:['deleted-id']},ctx).kind,'clarify');
  check('OR legacy answer cannot drop OR lists',validateIntent({type:'answer',query:{metric:'total',period:'month',categories:['studio-x','cycle-y']}},{cats}).ok,false);
  const overlapCats=[...cats,{id:'short-label',label:'kits'}];
  check('OR overlapping vocabulary selects longest configured label',validateIntent({type:'analyze',query:{operation:'total',category:'studio-x'}},{cats:overlapCats,message:'Studio kits spending this month?'}).intent.type,'analyze');
  const emptyCatQuery={operation:'total',period:'month',categories:['studio-x','unused-cat']};
  const emptyCatCats=[...cats,{id:'unused-cat',label:'Unused custom'}];
  const emptyCatAnswer=executeQuery(emptyCatQuery,{...ctx,cats:emptyCatCats});
  check('OR removal of empty included category still marks stale',evidenceIsOutdated(emptyCatAnswer.evidence,ctx.expenses,cats),true);
  const quoted=interpretOffline('Show purchases mentioning "BlueCab or SwiftVan" this month.',cats);
  check('OR quoted conjunction stays one literal term',quoted.query.description,'bluecab or swiftvan');
  const spaced=executeQuery({...orQuery,descriptionTerms:['  BlueCab   ticket  ']},{...ctx,expenses:[{...ctx.expenses[0],description:' BLUECAB     TICKET '}]});
  check('OR whitespace normalised on row and term',[ids(spaced),sumCents(spaced.evidence.rows)],[['u1'],1001]);
  check('OR unrequested known category does not narrow a new question',validateIntent({type:'analyze',query:{operation:'total',categories:['studio-x','cycle-y']}},{cats,message:'What is my total recorded spending this month?'}).intent.type,'clarify');
  check('OR inferred concept terms do not become explicit filters',validateIntent({type:'analyze',query:{operation:'total',descriptionTerms:['uniform','tuition']}},{cats,message:'Total student spending this month?'}).intent.type,'clarify');
  check('OR invented category metadata on a single subject remains invalid',validateIntent({type:'analyze',query:{operation:'total',categories:['studio-x'],category_terms:['Studio kits','Unknown label']}},{cats,message:'Studio kits total this month?'}).ok,false);
  check('OR max lengths accepted',validateQuery({...orQuery,descriptionTerms:['a'.repeat(80)]},cats).ok,true);
  for(const [label,msg,q,reason]of [
    ['omitted category',message,{...orQuery,categories:['studio-x'],category_terms:[]},'explicit_filter_coverage_incomplete'],
    ['omitted term',message,{...orQuery,descriptionTerms:['BlueCab']},'explicit_filter_coverage_incomplete'],
    ['unknown mixed','Total Studio kits and bubble tea this month.',{operation:'total',category:'studio-x',description:'bubble tea'},'explicit_filter_coverage_incomplete'],
    ['comparison','Did I spend more on Studio kits or Bicycle upkeep this month?',orQuery,'category_comparison_unsupported'],
    ['related','Total campus-related spending this month.',orQuery,'scope_rules_required'],
  ]){
    const v=validateIntent({type:'analyze',query:q},{cats,message:msg});check('OR '+label+' clarification',[v.ok,v.intent?.type,v.intent?.reason],[true,'clarify',reason]);check('OR '+label+' no query','query' in v.intent,false);
  }
  for(const text of ['Did I spend more on Studio kits and Bicycle upkeep this month?','Is Studio kits or Bicycle upkeep spending more this month?','Studio kits compared to Bicycle upkeep spending this month?'])check('OR comparison paraphrase never executes '+text,validateIntent({type:'analyze',query:orQuery},{cats,message:text}).intent.type,'clarify');
  const thresholdUnion=validateIntent({type:'analyze',query:{...orQuery,descriptionTerms:[],amountOperator:'gt',amount:'10'}},{cats,message:'Total Studio kits and Bicycle upkeep purchases more than S$10 this month.'});
  check('OR amount more than is not category comparison',thresholdUnion.intent.type,'analyze');
  check('OR colon after short named category scope preserves both categories',validateIntent({type:'analyze',query:{...orQuery,descriptionTerms:[]}},{cats,message:'Studio kits and Bicycle upkeep: total this month?'}).intent.type,'analyze');
  const background='My notebook has many notes about Studio kits. '+('I am keeping a longer journal about everyday purchases and record keeping. '.repeat(4))+': How much did I spend in total this month?';
  check('OR long background followed by independent total is fresh scope',validateIntent({type:'analyze',query:{operation:'total',period:'month'}},{cats,message:background}).intent.type,'analyze');
  for(const type of ['help','clarify']){
    const guarded=validateIntent({type,question:'Should I use Campus meals?'},{cats,message:'Total Studio kits and bubble tea this month.'});
    check('OR '+type+' ambiguous coordination uses established reason',[guarded.intent.type,guarded.intent.reason],['clarify','explicit_filter_coverage_incomplete']);
    check('OR '+type+' cannot suggest unrelated category',guarded.intent.question.includes('Campus meals'),false);
    check('OR '+type+' retains original subjects',guarded.intent.question.includes('Total Studio kits and bubble tea this month.'),true);
  }
  const canonical=normal.query, context=captureQueryContext(canonical,answer,ctx,1);
  for(const [text,cents,expectedIds]of [
    ['Show those transactions.',7105,['u1','u2','u3','u7','u9']],
    ['Break that down by month.',7105,['u1','u2','u3','u7','u9']],
    ['Break that down by category.',7105,['u1','u2','u3','u7','u9']],
    ['What about last month?',707,['u5','u10']],
    ['Only purchases over S$10.01.',5005,['u2','u3']],
  ]){const f=resolveFollowup(text,context,ctx);check('OR follow-up '+text,[f.handled,f.plan.kind,sumCents(f.plan.evidence.rows),ids(f.plan)],[true,'answer',cents,[...expectedIds].sort()]);if(f.query)check('OR inherited lists '+text,[f.query.categories,f.query.descriptionTerms],[canonical.categories,canonical.descriptionTerms]);}
  check('OR independent question no inherited scope',resolveFollowup('Total Campus meals this month.',context,ctx).handled,false);
  for(const [label,change]of [
    ['included category move',rows=>rows.map(r=>r.id==='u1'?{...r,category:'cycle-y'}:r)],
    ['excluded category move',rows=>rows.map(r=>r.id==='u1'?{...r,category:'meal-z'}:r)],
    ['description leaves',rows=>rows.map(r=>r.id==='u1'?{...r,description:'Other ticket'}:r)],
    ['description enters',rows=>rows.map(r=>r.id==='u6'?{...r,description:'SwiftVan paper'}:r)],
    ['addition',rows=>[...rows,{...rows[0],id:'new'}]],
    ['deletion',rows=>rows.filter(r=>r.id!=='u1')],
  ]){const expenses=change(ctx.expenses);check('OR stale '+label,evidenceIsOutdated(answer.evidence,expenses,cats),true);check('OR historical snapshot '+label,sumCents(answer.evidence.rows),7105);}
  check('OR irrelevant edit not stale',evidenceIsOutdated(answer.evidence,ctx.expenses.map(r=>r.id==='u4'?{...r,amount:41}:r),cats),false);
  const removed={...ctx,cats:cats.filter(c=>c.id!=='cycle-y')};
  check('OR removed category marks old evidence stale',evidenceIsOutdated(answer.evidence,ctx.expenses,removed.cats),true);
  check('OR removed category blocks refresh',resolveFollowup('What about last month?',context,removed).plan.kind,'clarify');
  check('OR removed category snapshot stays frozen',resolveFollowup('Show those transactions.',context,removed).plan.outdated,true);
  check('OR renamed included category stale',evidenceIsOutdated(answer.evidence,ctx.expenses,cats.map(c=>c.id==='cycle-y'?{...c,label:'Bike care'}:c)),true);
  const scope={label:'Review exact terms',includeCategories:[],includeTerms:['bluecab','swiftvan'],excludeCategories:[],excludeTerms:[]};
  const scoped={...orQuery,spendingScope:scope};
  const v=validateIntent({type:'analyze',query:scoped},{cats,message:'Propose campus-related rules this month.'});
  check('OR model scope remains proposal',v.intent.type,'propose_scope');
  check('OR no bypass approval',executeQuery(scoped,ctx).kind,'clarify');
  const preview=previewSpendingScope(scoped,ctx), confirmed=confirmSpendingScope({query:preview.query,preview},ctx);
  check('OR review respects intersection',[preview.count,confirmed.kind,sumCents(confirmed.plan.evidence.rows)],[5,'confirmed',7105]);
  for(const [text,cents,expectedIds]of [
    ['Total Studio kits and Bicycle upkeep spending this month.',7711,['u1','u2','u3','u6','u7','u9']],
    ['Show purchases mentioning BlueCab or SwiftVan over the last30days.',11816,['u1','u2','u3','u4','u5','u7','u9','u10']],
    ['Total Studio kits and Bicycle upkeep purchases mentioning BlueCab or SwiftVan this month.',7105,['u1','u2','u3','u7','u9']],
    ['Break down Studio kits and Bicycle upkeep by month this year.',8418,['u1','u2','u3','u5','u6','u7','u9','u10']],
    ['Show purchases mentioning "BlueCab" or "SwiftVan" this month.',11109,['u1','u2','u3','u4','u7','u9']],
  ]){const parsed=interpretOffline(text,cats);const p=parsed.query&&executeQuery(parsed.query,ctx);check('OR offline '+text,[p?.kind,p&&sumCents(p.evidence.rows),p&&ids(p)],['answer',cents,[...expectedIds].sort()]);}
  for(const text of ['Studio kits and bubble tea total this month.','Did I spend more on Studio kits or Bicycle upkeep this month?'])check('OR offline ambiguity '+text,interpretOffline(text,cats).kind,'clarify');
}
