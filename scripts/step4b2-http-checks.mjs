/** Requires only the isolated scripts/step4b2-mock-server.mjs, never a live provider. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import PlanAnswer from '../src/components/PlanAnswer.jsx';
import {requestIntent,explainIntentFailure} from '../src/lib/assistantClient.js';
import {planFromIntent} from '../src/lib/assistant.js';
import {interpretOffline} from '../src/lib/queryOffline.js';
import {planContext,FOOD_REQUEST,DIFFERENCE_REQUEST,LITERAL_REQUEST} from './plan-fixture.js';
const base='http://127.0.0.1:8846',nativeFetch=globalThis.fetch;
const localFetch=(url,options)=>{
 if(new URL(url).origin!==base)throw new Error('FORBIDDEN_REAL_PROVIDER_TRANSPORT');
 return nativeFetch(url,options);
};
globalThis.fetch=localFetch;
const ctx=planContext(),events=[];
const control=async mode=>{const r=await localFetch(`${base}/__mock/control`,{method:'POST',body:JSON.stringify({mode,delayMs:0})});assert.equal(r.status,200);};
await control('normal');
const cases=[
 ['A',FOOD_REQUEST,[4000,1000],[3,1],[['p1','p2','p3'],['p1']],'25.00%','2027-03-01','2027-03-10'],
 ['B',DIFFERENCE_REQUEST,[4000,1200],[3,1],[['p1','p2','p3'],['p2']],2800,'2027-03-01','2027-03-10'],
 ['C',LITERAL_REQUEST,[7000,1800],[6,1],[['p1','p2','p3','p4','p5','p6'],['p3']],'25.71%','2026-12-11','2027-03-10'],
 ['D','What did I spend from 2027-01-01 to 2027-01-05, and what percentage was Food & Drinks?',[0,0],[0,0],[[],[]],'unavailable_zero_denominator','2027-01-01','2027-01-05'],
];
for(const [id,message,totals,counts,ids,value,start,end]of cases) {
 const response=await requestIntent(message,{...ctx,url:base,fetchImpl:localFetch});
 assert.equal(response.httpStatus,200);assert.equal(response.intent.type,'plan');
 const answer=planFromIntent(response.intent,{...ctx,message});assert.equal(answer.kind,'answer');
 const result=answer.planResult;
 assert.deepEqual(result.base.map(p=>p.totalCents),totals);assert.deepEqual(result.base.map(p=>p.count),counts);
 assert.deepEqual(result.base.map(p=>p.evidence.rows.map(r=>r.id)),ids);
 assert.ok(result.base.every(p=>p.range.start===start&&p.range.end===end));
 const derived=result.derived[0],actual=id==='B'?derived.totalCents:id==='D'?derived.status:derived.display;
 assert.equal(actual,value);
 if(id==='D')assert.equal(Object.hasOwn(derived,'hundredthsPercent'),false);
 events.push({case:id,message,httpStatus:response.httpStatus,intent:response.intent.type,source:'mock HTTP interpretation + real local calculator',totals,counts,ids,range:{start,end},derived:actual,pass:true});
 if(id==='A')await writeFile('/private/tmp/tallyai-step4b2/saved-plan-rendering.html','<!doctype html><meta charset="utf-8"><h1>Server-rendered mock result, not browser acceptance</h1>'+renderToString(createElement(PlanAnswer,{result,answerId:1,source:'mock'})));
}
for(const [id,mode,message]of [
 ['E','normal','What did I spend this month, and what percentage was Food & Drinks, then forecast next year?'],
 ['J','one-sided',FOOD_REQUEST],
]) {
 await control(mode);const response=await requestIntent(message,{...ctx,url:base,fetchImpl:localFetch});
 assert.equal(response.httpStatus,200);assert.equal(response.intent.type,'clarify');
 const answer=planFromIntent(response.intent,{...ctx,message});assert.equal(answer.kind,'clarify');assert.equal(answer.planResult,undefined);
 events.push({case:id,httpStatus:200,intent:'clarify',reason:response.intent.reason,source:'mock HTTP',pass:true});
}
await control('malformed');
const malformed=await requestIntent(FOOD_REQUEST,{...ctx,url:base,fetchImpl:localFetch});
assert.equal(malformed.httpStatus,502);assert.equal(malformed.reason,'invalid_intent');
assert.equal(interpretOffline(FOOD_REQUEST,ctx.cats,ctx.today).kind,'clarify');
events.push({case:'malformed plan',httpStatus:502,reason:malformed.reason,source:'mock HTTP validation failure + labelled offline clarification',pass:true});
await control('timeout');
const failed=await requestIntent(FOOD_REQUEST,{...ctx,url:base,fetchImpl:localFetch});
assert.equal(failed.httpStatus,504);assert.equal(failed.reason,'provider_timeout');
const fallback=interpretOffline(FOOD_REQUEST,ctx.cats,ctx.today);assert.equal(fallback.kind,'clarify');assert.equal(fallback.query,undefined);
events.push({case:'mock provider failure',httpStatus:504,reason:failed.reason,source:'offline fallback clarification',notice:explainIntentFailure(failed.reason),pass:true});
await control('normal');
for(const [message,expected]of [['Total Food and Transit spending this month.','analyze'],['Compare spending this month with last month.','analyze'],['How much did I spend on study-related purchases including paper and ink this month?','propose_scope']]) {
 const response=await requestIntent(message,{...ctx,url:base,fetchImpl:localFetch});assert.equal(response.httpStatus,200);assert.equal(response.intent.type,expected);
 events.push({case:'K',message,httpStatus:200,intent:expected,source:'mock HTTP',pass:true});
}
const status=await(await localFetch(`${base}/__mock/status`)).json();assert.equal(status.realCalls,0);
await writeFile('/private/tmp/tallyai-step4b2/http-acceptance.json',JSON.stringify({paidCalls:0,realProviderCalls:0,browserVerified:false,sourceFingerprints:status.sourceFingerprints,events},null,2));
console.log(`${events.length} isolated HTTP scenarios passed; zero real provider calls. Browser acceptance remains unverified.`);
