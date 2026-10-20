/** Local-only zero-paid-call acceptance adapter. No credentials are loaded. */
import http from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {handleIntent} from '../backend/src/routes.js';
import {mockPlanIntent} from './mocks/plan-intents.js';
import {planQuery} from '../src/lib/planContract.js';
process.env.OPENAI_API_KEY='';
globalThis.fetch=async()=>{throw new Error('FORBIDDEN_REAL_PROVIDER_TRANSPORT');};
const root=process.cwd(),artifacts='/private/tmp/tallyai-step4b2';
await mkdir(artifacts,{recursive:true});
const sourceFingerprints=Object.fromEntries(await Promise.all(['backend/src/provider.js','backend/src/routes.js','src/lib/intent.js','src/lib/planRequest.js','src/lib/planContract.js'].map(async file=>[file,createHash('sha256').update(await readFile(`${root}/${file}`)).digest('hex')])));
let mode='normal',delayMs=0,requests=0;
const events=[];
const server=http.createServer(async(req,res)=>{
 let text='';for await(const chunk of req)text+=chunk;
 const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 if(req.method==='GET'&&req.url==='/__mock/status')return send(200,{mode,delayMs,requests,realCalls:0,sourceFingerprints,events});
 if(req.method==='POST'&&req.url==='/__mock/control'){
  const control=JSON.parse(text||'{}');mode=control.mode??'normal';delayMs=control.delayMs??0;return send(200,{mode,delayMs});
 }
 if(req.method!=='POST'||req.url!=='/assistant/intent')return send(404,{error:'mock_route_not_allowed'});
 const body=JSON.parse(text),selected=mode,delay=delayMs;requests++;
 const result=await handleIntent(body,{request:async({message,context})=>{
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  if(selected==='timeout')throw Object.assign(new Error('mock timeout'),{code:'provider_timeout',status:504});
  if(selected==='one-sided')return {type:'analyze',query:planQuery()};
  if(selected==='malformed')return {type:'plan',plan:{version:1,steps:[],derived:[]}};
  return mockPlanIntent(message,context);
 }});
 events.push({sequence:requests,mode:selected,status:result.status,intent:result.body.intent?.type??null,reason:result.body.intent?.reason??result.body.error??null});
 await writeFile(`${artifacts}/mock-ledger.json`,JSON.stringify({source:'mock transport',realCalls:0,sourceFingerprints,events},null,2));
 send(result.status,result.body);
});
server.listen(8846,'127.0.0.1',()=>console.log('Fail-closed mock handler listening on 127.0.0.1:8846; real calls disabled.'));
