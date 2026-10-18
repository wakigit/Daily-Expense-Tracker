import OpenAI from 'openai';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyRoastError, ProviderNotConfigured, requestRoast } from './provider.js';
import { handleRoast } from './routes.js';
for (const [error, code, status] of [
  [new OpenAI.APIConnectionTimeoutError(), 'roast_timeout', null],
  [new OpenAI.APIConnectionError({message:'SECRET CANARY'}), 'roast_connection_failed', null],
  [new ProviderNotConfigured(), 'roast_not_configured', 503],
  [{status:401},'roast_credentials_rejected',401], [{status:403},'roast_model_access_denied',403],
  [{status:404},'roast_model_unavailable',404], [{status:400,code:'model_not_found'},'roast_model_unavailable',400], [{status:429,code:'insufficient_quota'},'roast_quota_exceeded',429],
  [{status:429},'roast_rate_limited',429], [{name:'APIConnectionTimeoutError'},'roast_timeout',null],
  [{name:'APIConnectionError'},'roast_connection_failed',null], [{status:400},'roast_provider_request_invalid',400],
  [{status:500},'roast_provider_server_error',500], [{code:'SECRET',message:'CANARY'},'roast_unavailable',null],
]) test(`safe roast diagnostic: ${code}`,()=>{
  const result=classifyRoastError(error,12.3);
  assert.equal(result.code,code); assert.equal(result.httpStatus,status); assert.equal(result.elapsedMs,12);
  assert.equal(JSON.stringify(result).includes('CANARY'),false);
});
const oldFetch=globalThis.fetch, oldKey=process.env.OPENAI_API_KEY;
let status='completed', output='{"text":"A fictional receipt requests a promotion."}', reason=null, calls=0;
globalThis.fetch=async()=>{
  calls++;
  return new Response(JSON.stringify({id:'test',object:'response',status,incomplete_details:reason?{reason}:null,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:output}]}]}),{headers:{'Content-Type':'application/json'}});
};
process.env.OPENAI_API_KEY='test-only-placeholder';
const input={transaction:{description:'Fictional kopi',amountCents:200,category:'Food'},facts:[],budget:{band:'none',intensity:0,categoryUsagePct:null},angle:'absurd_accounting',preferences:{name:'',singapore:false,smu:false}};
try {
  await test('roast completed response carries safe metadata',async()=>{
    const result=await requestRoast(input);
    assert.equal(result.output.text,'A fictional receipt requests a promotion.');
    assert.equal(result.diagnostic.completion,'completed'); assert.equal(result.diagnostic.httpStatus,200);
  });
  for (const [state,text,incompleteReason,code] of [
    ['incomplete','{','max_output_tokens','roast_incomplete_output'],
    ['incomplete','{','content_filter','roast_incomplete_output'],
    ['failed','','PRIVATE','roast_incomplete_output'],
    ['completed','{',null,'roast_json_invalid'],
    ['completed','x'.repeat(2049),null,'roast_output_too_large'],
  ]) await test(`roast response diagnostic: ${code}/${incompleteReason}`,async()=>{
    status=state; output=text; reason=incompleteReason;
    const before=calls;
    const result=await handleRoast(input);
    assert.equal(calls,before+1); assert.equal(result.status,503);
    assert.equal(result.body.diagnostic.code,code);
    assert.equal(result.body.diagnostic.completion,state);
    assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  });
  await test('server output validation is distinct from provider parsing',async()=>{
    status='completed'; output=JSON.stringify({text:'x'.repeat(301)}); reason=null;
    const result=await handleRoast(input);
    assert.equal(result.status,502); assert.equal(result.body.diagnostic.code,'roast_server_output_invalid');
    assert.equal(result.body.diagnostic.validation,'length'); assert.equal(result.body.diagnostic.completion,'completed');
  });
} finally {
  globalThis.fetch=oldFetch;
  if(oldKey===undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=oldKey;
}
