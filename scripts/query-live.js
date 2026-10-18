// Five controlled fictional interpretations, no ledger transmitted and no raw response printed.
import { requestIntent as provider, isConfigured } from '../backend/src/provider.js';
import { validateIntent, buildContext } from '../src/lib/intent.js';
import { requestIntent as client } from '../src/lib/assistantClient.js';
import { planFromIntent } from '../src/lib/assistant.js';
const cats=[{id:'custom-meals',label:'Food'},{id:'custom-creative',label:'Creative hobbies'}];
const expenses=[{id:'a',date:'2026-10-12',description:'Chicken rice',amount:10.01,category:'custom-meals'},{id:'b',date:'2026-10-17',description:'Chicken rice',amount:20,category:'custom-meals'},{id:'c',date:'2026-09-12',description:'Chicken rice',amount:8,category:'custom-meals'}];
const ctx={cats,expenses,today:'2026-10-18',budgets:{'custom-creative':100}};
const cases=[
 ['Did I spend less money on weekdays or weekends this month?','day_types',p=>p.comparison.sides[0].totalCents===1001&&p.comparison.sides[1].totalCents===2000],
 ['Show Food expenses over S$10 this month.','list',p=>p.evidence.rows.length===2&&p.text.includes('S$30.01')],
 ['What day of the week do I usually spend the most money?','highest',p=>p.text.includes('Saturday')],
 ['Compare all descriptions mentioning chicken rice this month with last month.','compare',p=>p.comparison.differenceCents===2201],
 ['Based on my current spending pace, when will I run out of my Creative hobbies budget?','projection',p=>p.budgetEvidence.category==='custom-creative'&&p.text.includes('No recorded spending')],
];
if(!isConfigured()){console.log('LIVE intent: unavailable, missing configuration');process.exitCode=1;}
else for(const [message,operation,assertion] of cases.filter(c=>!process.env.LIVE_OPERATION||process.env.LIVE_OPERATION.split(',').includes(c[1]))) {
 try {const raw=await provider({message,context:buildContext(ctx)});const server=validateIntent(raw,{cats});if(!server.ok){console.log(`Safe validation diagnostic: ${server.error.code}, field=${server.error.field??'none'}`);throw {code:'server_validation'};}
 const validated=await client(message,{...ctx,fetchImpl:async()=>({ok:true,json:async()=>({intent:server.intent})})});
 if(!validated.ok||validated.intent.type!=='analyze'||validated.intent.query.operation!==operation){console.log(`Safe interpretation diagnostic: validation=${validated.ok}, type=${validated.intent?.type??'none'}, operation=${validated.intent?.query?.operation??'none'}`);if(validated.intent?.type==='clarify')console.log(`Validated user-facing clarification: ${validated.intent.question}`);throw {code:'intent_mismatch'};}
 const plan=planFromIntent(validated.intent,ctx);if(!assertion(plan))throw {code:'calculation_mismatch'};
 console.log(`LIVE ${operation}: PASS, strict schema + server/client validation + independent local expected result.`);
 } catch(error) {const allowed=['server_validation','intent_mismatch','calculation_mismatch','provider_not_configured','provider_key_rejected','provider_access_denied','provider_error','empty_response','unparsable_response'];console.log(`LIVE ${operation}: FAIL (${allowed.includes(error?.code)?error.code:'request_unavailable'}, HTTP ${Number.isInteger(error?.status)?error.status:'unavailable'})`);process.exitCode=1;break;}
}
