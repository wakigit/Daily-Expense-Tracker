import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
/** Offline measurements only, no provider imports or requests. */
import {validatePlan,buildPlanIntentSchema,jsonBytes,planQuery,planRef} from '../src/lib/planContract.js';
import {planContext,sharePlan,differencePlan} from './plan-fixture.js';
const envelope=plan=>({type:'plan',plan,say:null,query:null,expense:null,filter:null,scope:null,question:null,options:null});
export function planOutputCases(){
 const ctx=planContext();
 const four={version:1,steps:[{id:'q1',query:planQuery()},...ctx.cats.map((c,i)=>({id:`q${i+2}`,query:planQuery({category:c.id,category_terms:[c.label]})}))],derived:[{id:'d1',operation:'percent_of',numerator:planRef('q2'),denominator:planRef('q1')},{id:'d2',operation:'difference',left:planRef('q1'),right:planRef('q3')}]};
 const longCats=Array.from({length:8},(_,i)=>({id:`custom-${i}-`+'i'.repeat(72),label:`Vocabulary ${i} `+'v'.repeat(65)}));
 const terms=Array.from({length:8},(_,i)=>`literal-${i}-`+'z'.repeat(70)); // 80 characters each.
 const maximum={version:1,steps:[{id:'q1',query:planQuery({period:'last_days',dayCount:3660,day:'weekday',amountOperator:'gte',amount:'999999999.99'})},...[0,1,2].map((n,i)=>({id:`q${i+2}`,query:planQuery({period:'last_days',dayCount:3660,day:'weekday',amountOperator:'gte',amount:'999999999.99',categories:longCats.map(c=>c.id),category_terms:longCats.map(c=>c.label),descriptionTerms:terms.map(t=>t.slice(0,-1)+String(n))})}))],derived:four.derived};
 const cases=[['two-query share',sharePlan(),ctx],['two-query difference',differencePlan(),ctx],['90-day literal share',sharePlan({period:'last_days',dayCount:90},{description:'Amazon'}),ctx],['four-query two-derived',four,ctx],['four-query maximum filter lists',maximum,{...ctx,cats:longCats}]];
 return cases;
}
/** Fully explicit filter attachment for an executable metadata-cap check. */
export function maximumPlanRequest(plan,ctx){
 const subject=q=>`${q.categories.map(id=>ctx.cats.find(c=>c.id===id).label).join(' or ')} spending descriptions mentioning ${q.descriptionTerms.map(t=>JSON.stringify(t)).join(' or ')} last 3660 days on weekdays at least S$999999999.99`;
 const [a,b,c]=plan.steps.slice(1).map(s=>subject(s.query));
 return `Show my total spending last 3660 days on weekdays at least S$999999999.99 and my ${a} and my ${b} and my ${c}, then ${a} share of total and total minus ${b}.`;
}
export function planOutputMeasurements(){
 const cases=planOutputCases(),ctx=planContext();
 return {tokenMeasurement:'No reliable model tokenizer found in existing dependencies; no tokens measured.',
   heuristic:'bytes / 4 is a rough estimate only, not a tokenizer count or guaranteed bound. JSON, uncommon IDs, Unicode and punctuation can differ substantially.',
   cases:cases.map(([name,p,c])=>({name,instructionBytes:jsonBytes(p),intentBytes:jsonBytes(envelope(p)),structurallyValid:validatePlan(p,c).ok,roughTokenEstimate:Math.ceil(jsonBytes(envelope(p))/4)})),
   standaloneIntentSchemaBytes:jsonBytes(buildPlanIntentSchema(ctx.cats.map(c=>c.id))),
   liveOutputCeilingUnchanged:700,recommendedReviewCeiling:4096,
   recommendation:'Review a bounded 4096-token allowance for four full queries after reliable token measurement or separately authorised final-code trials. This is provisional, not a guarantee for every 16 KiB/filter-boundary input. Preserve honest truncation and zero retries; do not shorten fields or weaken validation to fit.'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url).endsWith('/plan-output-size.mjs')&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))console.log(JSON.stringify(planOutputMeasurements(),null,2));
