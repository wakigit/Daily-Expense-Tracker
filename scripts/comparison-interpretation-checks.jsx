import {REPAIR_CASES,repairContext} from './comparison-interpretation-fixture';
import {validateIntent} from '../src/lib/intent';
import {validateQuery} from '../src/lib/queryContract';
import {executeQuery} from '../src/lib/queryEngine';
export function comparisonInterpretationChecks(check){
 const ctx=repairContext(),{cats}=ctx;
 for(const c of REPAIR_CASES){
  const v=validateIntent({type:'analyze',query:c.query},{cats,message:c.message});
  check('repair canonical intent '+c.family,[v.ok,v.intent?.type],[true,'analyze']);
  check('repair round-trip '+c.family,validateIntent(v.intent,{cats,message:c.message}),v);
  const p=executeQuery(v.intent.query,{...ctx,message:c.message}),s=p.comparison.sides;
  check('repair independent figures '+c.family,[s.map(x=>x.totalCents),s.map(x=>x.count),p.comparison.differenceCents],[c.expected.totals,c.expected.counts,c.expected.difference]);
  check('repair exact ranges '+c.family,s.map(x=>[x.start,x.end]),c.expected.ranges);
  check('repair independent evidence '+c.family,s.map(x=>x.evidence.rows.map(r=>r.id).sort()),c.expected.ids);
 }
 const cat=REPAIR_CASES[1],period=REPAIR_CASES[0];
 for(const patch of [{category:'music-r'},{categories:['music-r','trail-r']}])check('repair root/nested conflict rejects '+JSON.stringify(patch),validateQuery({...cat.query,...patch},cats).ok,false);
 check('repair wrong root period blocked',executeQuery({...cat.query,period:'all'},{...ctx,message:cat.message}).kind,'clarify');
 check('repair wrong named month blocked',executeQuery({...period.query,comparison:{...period.query.comparison,periods:[{period:'named_month',month:'2026-08'},{period:'named_month',month:'2026-07'}]}},{...ctx,message:period.message}).kind,'clarify');
 check('repair one-sided total blocked',validateIntent({type:'analyze',query:{operation:'total',period:'month',category:'music-r'}},{cats,message:cat.message}).intent.type,'clarify');
 check('repair description words cannot bind categories',validateIntent({type:'analyze',query:cat.query},{cats,message:REPAIR_CASES[2].message}).intent.type,'clarify');
 const ordinary={operation:'total',period:'month',categories:['music-r','trail-r'],descriptionTerms:['SwiftShuttle','AmberRide']};
 const t=executeQuery(ordinary,ctx);check('repair existing OR total',t.kind,'answer');
 check('repair ordinary round-trip',validateQuery(validateQuery(ordinary,cats).query,cats).ok,true);
 const b=executeQuery({...ordinary,operation:'breakdown',groupBy:'category'},ctx);check('repair existing complete breakdown',b.kind,'answer');
 check('repair malformed side rejected',validateQuery({...period.query,comparison:{...period.query.comparison,periods:[{period:'range',start:'2026-02-30',end:'2026-03-01'},{period:'month'}]}},cats).ok,false);
}
