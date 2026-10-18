import { renderToString } from 'react-dom/server';
import RoastCard from '../src/components/RoastCard';
import { buildRoastInput, roastBand, offlineRoast } from '../src/lib/roastFacts';
import { createRoastSession } from '../src/lib/roastSession';
import { requestRoast } from '../src/lib/roastClient';
import { ROAST_DEFAULTS, roastPreferences, validateRoastInput, validateRoastOutput } from '../src/lib/roastContract';
import { addExpense, deleteExpenseById, revert } from '../src/lib/actions';
import { parseUtterance } from '../src/lib/parseUtterance';
import { receiptToFields, mergeReceiptIntoForm } from '../src/lib/receipt';
import { planFromIntent } from '../src/lib/assistant';

/** Included in the normal smoke suite, no provider request. */
export async function roastChecks(logic) {
  const cats = [{ id: 'custom-food', label: 'Food' }, { id: 'travel', label: 'Public transport' }];
  const row = (id, date, amount, description = 'Kopi', category = cats[0].id) => ({ id, date, amount, description, category, notes: 'PRIVATE NOTES DO NOT SEND' });
  const added = row('new', '2026-10-18', 2);
  const expenses = [row('one', '2026-10-12', 1.1, '  KOPI  '), row('two', '2026-10-12', 1.1), row('earlier', '2026-10-01', 3), row('other-food', '2026-10-15', 20, 'Chicken rice'), row('similar', '2026-10-16', 3, 'Kopi O'), row('wrong-cat', '2026-10-16', 5, 'Kopi', 'travel'), row('future', '2026-10-19', 999), added];
  const ctx = { expenses, cats, budgets: { 'custom-food': 100, travel: 100 }, today: '2026-10-18', preferences: ROAST_DEFAULTS };
  const input = buildRoastInput(added, ctx);
  logic('roast preferences: default on, no inferred name or context', roastPreferences(null), ROAST_DEFAULTS);
  logic('roast facts: exact description/category, distinct duplicate-looking IDs count independently', input.facts[0], { kind: 'repeat_week', start: '2026-10-12', end: '2026-10-18', count: 3, totalCents: 420 });
  logic('roast facts: monthly matching amount excludes similar names and category-only history', input.facts[1], { kind: 'repeat_month', start: '2026-10-01', end: '2026-10-18', count: 4, totalCents: 720 });
  logic('roast facts: category aggregate never leaves builder', input.facts.some(f=>f.kind==='category_month'), false);
  logic('roast budget: category spending stays local and includes all actual category rows', input.budget.categoryUsagePct, 30);
  logic('roast facts: same ID is included exactly once', buildRoastInput(added, { ...ctx, expenses: [...expenses, added] }).facts[0].count, 3);
  logic('roast privacy: no notes, IDs, full ledger or time transmitted', /PRIVATE|"id"|"expenses"|"notes"|"date"/.test(JSON.stringify(input)), false);
  logic('roast facts: input passes shared validator', validateRoastInput(input).ok, true);
  // Independent KFC regression fixtures, never read or mutate browser storage.
  const kfc = row('kfc-new', ctx.today, 23, 'KFC');
  const kfcContext = {...ctx, budgets:{}, expenses:[kfc]};
  const oneKfc = buildRoastInput(kfc,kfcContext);
  const unrelatedFood = Array.from({length:23},(_,i)=>row(`merchant-${i}`,ctx.today,1+i/100,`Different merchant ${i}`));
  const food24 = [kfc,...unrelatedFood];
  const beforeFood24 = JSON.stringify(food24);
  const among24 = buildRoastInput(kfc,{...kfcContext,expenses:food24});
  logic('KFC fixture has 24 Food rows but only one KFC row',[food24.length,food24.filter(e=>e.description==='KFC').length],[24,1]);
  for (const [label,payload] of [['single',oneKfc],['among 24 Food entries',among24]]) {
    const wire = JSON.parse(JSON.stringify(payload));
    logic(`KFC ${label}: S$23 is exactly 2300 cents`,wire.transaction.amountCents,2300);
    logic(`KFC ${label}: no count or aggregate history transmitted`,wire.facts,[]);
    logic(`KFC ${label}: transaction has separate cents field, no count`,Object.keys(wire.transaction).sort(),['amountCents','category','description']);
    logic(`KFC ${label}: payload passes shared boundary`,validateRoastInput(wire).ok,true);
    logic(`KFC ${label}: reported hallucination rejected`,validateRoastOutput({text:'Twenty-four KFC meals this month, your chicken loyalty is a full-time job.'},wire),{ok:false,reason:'unsupported_history'});
    logic(`KFC ${label}: purchase-only amount joke accepted`,validateRoastOutput({text:'S$23 for KFC, that chicken had better earn its keep.'},wire).ok,true);
  }
  const repeatKfc = buildRoastInput(kfc,{...kfcContext,expenses:[row('kfc-1','2026-10-12',7.10,' KFC '),row('kfc-2','2026-10-14',4.35,'kfc'),kfc,kfc,...unrelatedFood,row('similar-kfc',ctx.today,99,'KFC delivery'),row('wrong-kfc',ctx.today,99,'KFC','travel'),row('future-kfc','2026-10-19',99,'KFC')]});
  logic('KFC genuine repeats: independent expected counts and cents',repeatKfc.facts,[{kind:'repeat_week',start:'2026-10-12',end:ctx.today,count:3,totalCents:3445},{kind:'repeat_month',start:'2026-10-01',end:ctx.today,count:3,totalCents:3445}]);
  logic('KFC repeats: amount stays 2300 independently of count 3',[repeatKfc.transaction.amountCents,repeatKfc.facts[0].count],[2300,3]);
  logic('KFC repeats: recorded transactions are supported',validateRoastOutput({text:'Three recorded KFC purchases, that chicken is getting expensive.'},repeatKfc).ok,true);
  logic('KFC repeats: records are not meals eaten',validateRoastOutput({text:'Three KFC meals this month, those chickens know you.'},repeatKfc),{ok:false,reason:'unsupported_history'});
  logic('KFC repeats: invented transaction count rejected',validateRoastOutput({text:'Twenty-four recorded KFC purchases, expensive chicken.'},repeatKfc),{ok:false,reason:'unsupported_history'});
  logic('KFC regressions leave source ledger unchanged',JSON.stringify(food24),beforeFood24);
  const kfcReply=await requestRoast(oneKfc,{fetchImpl:async()=>new Response(JSON.stringify({text:'Twenty-four KFC meals this month, your chicken loyalty is a full-time job.'}))});
  logic('KFC client rejects unsupported history even from a successful endpoint',[kfcReply.ok,kfcReply.diagnostic.code,kfcReply.diagnostic.validation],[false,'roast_client_output_invalid','unsupported_history']);
  const kfcSave=addExpense([], {...kfc,amount:'23'}, {cats,today:ctx.today});
  const kfcSession=createRoastSession({request:async()=>({ok:true,text:'Twenty-four KFC meals this month, your chicken loyalty is a full-time job.'})});
  kfcSession.reconcile(kfcSave.expenses,ROAST_DEFAULTS);
  await kfcSession.savedResult(kfcSave,kfcContext);
  logic('KFC unsupported model history uses labelled fallback without changing save',[kfcSave.expenses.length,kfcSave.expenses[0].amount,kfcSession.getCurrent().source],[1,23,'offline']);
  kfcSession.dispose();
  const justFood = buildRoastInput(added, { ...ctx, expenses: [added, row('rice', '2026-10-17', 6, 'Rice')] });
  logic('roast facts: Food category never becomes a merchant repeat', justFood.facts.map(f => f.kind), []);
  logic('roast fallback: no unsupported repeated-purchase claim', offlineRoast(justFood).includes('matching purchases'), false);
  for (const [spent, budget, band, intensity] of [[7499,10000,'under',0],[7500,10000,'near',1],[10000,10000,'near',1],[10001,10000,'over',2],[999,0,'none',0]]) logic(`roast budget: exact boundary ${spent}/${budget}`, roastBand(spent,budget), {band,intensity});
  const backdated = buildRoastInput(row('back', '2026-09-30', 4), ctx);
  logic('roast budget: backdated has no historical budget claim', backdated.budget, { band: 'historical', intensity: 0, categoryUsagePct: null });
  logic('roast budget: backdated repeat retains its actual historical week range', backdated.facts, [{kind:'repeat_week',start:'2026-09-28',end:'2026-10-04',count:2,totalCents:700}]);
  const future = buildRoastInput(row('later', '2026-10-20', 5), ctx);
  logic('roast facts: future purchase receives no ledger pattern or budget claim', [future.facts, future.budget.band], [[], 'none']);
  const personal = { ...ctx, preferences: { enabled: true, name: 'Fictional Alex', singapore: true, smu: true } };
  logic('roast angles: context never becomes a scheduled subject', Array.from({length:5}, (_,angleIndex) => buildRoastInput(added,{...personal,angleIndex}).angle), ['dramatic_narration','absurd_accounting','corporate_report','dramatic_narration','absurd_accounting']);
  const conflict = buildRoastInput({...added,description:'Fictional venue entry fee'},personal);
  logic('roast conflict: original description remains purchase evidence',conflict.transaction.description,'Fictional venue entry fee');
  logic('roast conflict: category remains saved bookkeeping label',conflict.transaction.category,input.transaction.category);
  logic('roast conflict: unrelated category history sends no purchase facts',conflict.facts,[]);
  logic('roast preferences: switches do not change tone rotation',buildRoastInput(added,{...ctx,angleIndex:4}).angle,buildRoastInput(added,{...personal,angleIndex:4}).angle);
  logic('roast name: used occasionally', [0,1,2].map(angleIndex=>buildRoastInput(added,{...personal,angleIndex}).preferences.name), ['','','Fictional Alex']);
  const draft = { description: 'Fictional kopi', amount: '2.50', category: cats[0].id, date: ctx.today, notes: '' };
  const voice = parseUtterance('kopi 2.50', cats);
  // A voice sentence and receipt draft only fill fields; the shared form save is the confirmation.
  const receipt = receiptToFields({ description: 'Fictional cafe', amount: 2.5, category: cats[0].id, date: ctx.today });
  const assistant = planFromIntent({ type: 'propose_add', expense: draft }, ctx);
  const forms = [
    ['manual', draft, 'manual'],
    ['voice-filled form', { ...draft, ...voice }, 'manual'],
    ['confirmed receipt', mergeReceiptIntoForm(draft, receipt), 'manual'],
    ['confirmed assistant', assistant.expense, 'assistant'],
  ];
  for (const [name, fields, source] of forms) {
    const result = addExpense(expenses, fields, { cats, today: ctx.today, source, requireCategory: true });
    let calls = 0; const events = [];
    const session = createRoastSession({ request: async () => { calls++; events.push('request'); return {ok:false}; }, persist: cache => { if(cache.entries.some(e=>e.status==='loading'))events.push('cached'); } });
    session.reconcile(result.expenses, ROAST_DEFAULTS);
    await session.savedResult(result, ctx);
    logic(`roast save path: ${name} calls once after successful add`, [result.ok,calls,events.indexOf('cached') < events.indexOf('request')], [true,1,true]);
    logic(`roast save path: ${name} failure leaves expense saved exactly once`, result.expenses.filter(e=>e.id===result.action.id).length, 1);
    logic(`roast save path: ${name} failure is labelled offline`, session.getCurrent()?.source, 'offline');
  }
  const result = addExpense(expenses, draft, { cats, today: ctx.today });
  let calls = 0, cache, view;
  const session = createRoastSession({ seed: null, request: async () => { calls++; return {ok:true,text:'This receipt has appointed itself chief financial officer.'}; }, persist: v=>{cache=structuredClone(v);}, onChange:v=>{view=v;} });
  session.reconcile(result.expenses, { ...ROAST_DEFAULTS, enabled:false });
  await session.savedResult(result, ctx);
  logic('roast off: no request and no card', [calls,view], [0,null]);
  session.reconcile(result.expenses, ROAST_DEFAULTS);
  for (const nonAdd of [{ok:false}, {ok:true,action:{type:'edit'}}, {ok:true,action:{type:'delete'}}, {expenses:result.expenses}, null]) await session.savedResult(nonAdd,ctx);
  logic('roast triggers: edit/delete/undo/load/reload and failed saves do not request', calls, 0);
  await session.savedResult(result,ctx);
  await session.savedResult(result,ctx);
  session.reconcile(result.expenses, ROAST_DEFAULTS);
  logic('roast cache: same ID and rerenders do not repeat requests', calls, 1);
  logic('roast UI state: loading changes to completed card', [view.status,view.source], ['done','ai']);
  const reloaded = createRoastSession({ seed: cache, request: async ()=>{calls++;} });
  reloaded.reconcile(result.expenses, ROAST_DEFAULTS);
  logic('roast cache: reload never replays a popup or requests again', [reloaded.getCurrent(),calls], [null,1]);
  const completedCache = structuredClone(cache);
  session.dismiss();
  logic('roast dismiss: hides card', session.getCurrent(), null);
  session.reconcile(result.expenses, ROAST_DEFAULTS);
  logic('roast dismiss: rerender does not resurrect card', session.getCurrent(), null);
  for (const [name, ledger] of [
    ['edit', result.expenses.map(e=>e.id===result.action.id ? {...e,amount:99}:e)],
    ['delete', deleteExpenseById(result.expenses,result.action.id).expenses],
    ['undo add', revert(result.expenses,result.action).expenses],
  ]) {
    const cleanup = createRoastSession({ request: async()=>({ok:true,text:'Another purchase, another receipt that deserves a raised eyebrow.'}) });
    cleanup.reconcile(result.expenses,ROAST_DEFAULTS);
    await cleanup.savedResult(result,ctx);
    logic(`roast cleanup: ${name} starts with an active popup`,Boolean(cleanup.getCurrent()),true);
    cleanup.reconcile(ledger,ROAST_DEFAULTS);
    logic(`roast cleanup: ${name} removes obsolete card`, cleanup.getCurrent(), null);
    cleanup.reconcile(result.expenses,ROAST_DEFAULTS);
    logic(`roast cleanup: ${name} restoration does not resurrect stale roast`, cleanup.getCurrent(), null);
  }
  const deferred = [];
  let latest;
  const race = createRoastSession({ request: ()=>new Promise(resolve=>deferred.push(resolve)), onChange:card=>{latest=card;} });
  race.reconcile(result.expenses,ROAST_DEFAULTS);
  const first = race.savedResult(result,ctx);
  logic('roast loading: card confirms expense already saved', renderToString(<RoastCard roast={latest}/>).includes('Saved.'), true);
  const secondResult = addExpense(result.expenses,{...draft,description:'Fictional second purchase'}, { cats,today:ctx.today });
  race.reconcile(secondResult.expenses,ROAST_DEFAULTS);
  const second = race.savedResult(secondResult,ctx);
  deferred[1]({ok:true,text:'The newer purchase gets the microphone.'}); await second;
  deferred[0]({ok:true,text:'The older purchase should stay quiet.'}); await first;
  logic('roast race: late older response cannot replace newer purchase', [latest.id,latest.text], [String(secondResult.action.id),'The newer purchase gets the microphone.']);
  const pendingResult = addExpense(secondResult.expenses,draft,{cats,today:ctx.today});
  race.reconcile(pendingResult.expenses,ROAST_DEFAULTS);
  const pending = race.savedResult(pendingResult,ctx);
  race.reconcile(pendingResult.expenses,{...ROAST_DEFAULTS,enabled:false});
  deferred[2]({ok:true,text:'Must not appear after off.'}); await pending;
  logic('roast toggle: off cancels late card', latest, null);
  const interruptedSeed = {...completedCache,entries:completedCache.entries.map(e=>({...e,status:'loading',text:''}))};
  const interrupted = createRoastSession({ seed:interruptedSeed, request:async()=>{calls++;} });
  interrupted.reconcile(result.expenses,ROAST_DEFAULTS);
  logic('roast reload: interrupted request never replays or retries', [interrupted.getCurrent(),calls], [null,1]);
  for (const [operation, change] of [
    ['edit', rows => rows.map(e=>e.id===result.action.id ? {...e,description:'Edited purchase'}:e)],
    ['delete', rows => rows.filter(e=>e.id!==result.action.id)],
  ]) {
    let finish, active;
    const cleanup = createRoastSession({request:()=>new Promise(resolve=>{finish=resolve;}),onChange:value=>{active=value;}});
    cleanup.reconcile(result.expenses,ROAST_DEFAULTS);
    const running = cleanup.savedResult(result,ctx);
    cleanup.reconcile(change(result.expenses),ROAST_DEFAULTS);
    finish({ok:true,text:'This response arrived too late.'}); await running;
    logic(`roast pending cleanup: ${operation} prevents late content`,active,null);
  }
  const malformed = createRoastSession({ request:async()=>({ok:true,text:'x'.repeat(301)}) });
  malformed.reconcile(result.expenses,ROAST_DEFAULTS); await malformed.savedResult(result,ctx);
  logic('roast output: malformed model text uses offline fallback', malformed.getCurrent().source, 'offline');
  let requestBody;
  const client = await requestRoast(input,{ fetchImpl:async(url,opts)=>{requestBody=opts.body;return {ok:true,json:async()=>({text:'This receipt is filing for main-character status.'})};} });
  logic('roast client: validated text accepted',client.ok,true);
  logic('roast client: payload has only allowed aggregates',Object.keys(JSON.parse(requestBody)).sort(),['angle','budget','facts','preferences','transaction']);
  logic('roast client: provider errors hidden',(await requestRoast(input,{fetchImpl:async()=>({ok:false,json:async()=>({secret:'raw'})})})).diagnostic.code,'roast_http_error');
  logic('roast client: slow requests bounded even if abort ignored',(await requestRoast(input,{timeoutMs:1,fetchImpl:async()=>new Promise(()=>{})})).diagnostic.code,'roast_timeout');
  logic('roast client: oversized streaming output rejected',(await requestRoast(input,{fetchImpl:async()=>new Response('x'.repeat(3000))})).diagnostic.code,'roast_output_too_large');
  for (const [name, fetchImpl, code] of [
    ['bad JSON', async()=>new Response('{'), 'roast_json_invalid'],
    ['bad output', async()=>new Response(JSON.stringify({text:'x'.repeat(301)})), 'roast_client_output_invalid'],
    ['connection error', async()=>{throw new Error('SECRET CANARY');}, 'roast_connection_failed'],
    ['server validation', async()=>new Response(JSON.stringify({error:'invalid_roast', diagnostic:{code:'roast_server_output_invalid',httpStatus:200,completion:'completed',validation:'length'}}),{status:502}), 'roast_server_output_invalid'],
  ]) {
    const reply = await requestRoast(input,{fetchImpl});
    logic(`roast diagnostic: client ${name}`,reply.diagnostic.code,code);
    logic(`roast diagnostic: ${name} contains no arbitrary data`,JSON.stringify(reply).includes('CANARY'),false);
  }
  const html = renderToString(<RoastCard roast={completedCache.entries.find(e=>e.id===completedCache.activeId)} onDismiss={()=>{}}/>);
  logic('roast UI: no heading or explanatory footnote',html.includes('AI-generated roast')||html.includes('based on recorded spending'),false);
  logic('roast UI: dismiss control and transaction amount visible',html.includes('Dismiss roast')&&html.includes('S$2.50'),true);
  logic('roast UI: fallback clearly labelled',renderToString(<RoastCard roast={malformed.getCurrent()}/>).includes('Offline'),true);
  logic('roast UI: off has no card',renderToString(<RoastCard roast={null}/>),'');
  for (const text of ['One. Two. Three sentences.', 'x'.repeat(201), 'An unfinished sentence without punctuation']) {
    logic(`short roast rejects invalid output ${text.slice(0,20)}`,validateRoastOutput({text}).ok,false);
  }
  logic('roast accepts complete sentence at exact 200-character boundary',validateRoastOutput({text:'x'.repeat(199)+'.'}).ok,true);
  logic('roast rejects 201 characters',validateRoastOutput({text:'x'.repeat(200)+'.'}).ok,false);
  logic('roast accepts two sentences, setup then punchline',validateRoastOutput({text:'Eight dollars for extra cheese. That sandwich out-earns you.'}).ok,true);
  // A 200-character roast must render in full: the popup has no max-height and
  // .roast-text wraps, so nothing may be clipped or truncated in the markup.
  {
    const long='Waki, four recorded bubble teas this week and S$26 gone to tapioca. '
      +'The pearls are not a food group however hard you argue about it today.';
    const html=renderToString(<RoastCard roast={{id:'r1',status:'done',source:'model',description:'Bubble tea',amount:6.4,text:long}}/>);
    logic('roast UI: a 200-character roast renders in full',[long.length<=200,html.includes(long)],[true,true]);
  }
  for(const source of [input,justFood,backdated,future]) logic(`offline quip satisfies short contract ${source.budget.band}`,validateRoastOutput({text:offlineRoast(source)}).ok,true);
  // Deterministic clock: slow model time is not counted as popup reading time.
  let clock=0, nextId=0, tasks=new Map(), stored, popup, finishRequest, paid=0;
  const advance=ms=>{clock+=ms;for(const [id,t] of [...tasks])if(t.at<=clock){tasks.delete(id);t.fn();}};
  const timed=createRoastSession({request:()=>{paid++;return new Promise(resolve=>{finishRequest=resolve;});},now:()=>clock,setTimer:(fn,ms)=>{tasks.set(++nextId,{fn,at:clock+ms});return nextId;},clearTimer:id=>tasks.delete(id),persist:value=>{stored=structuredClone(value);},onChange:value=>{popup=value;}});
  timed.reconcile(result.expenses,ROAST_DEFAULTS);
  const slow=timed.savedResult(result,ctx);
  advance(20000);logic('popup loading does not start eight-second timer',popup.status,'loading');
  finishRequest({ok:true,text:'Another kopi, another receipt your wallet never asked for.'});await slow;
  advance(3000);timed.setPaused(true);advance(20000);
  logic('popup hover/focus pause keeps completed roast visible',popup.status,'done');
  timed.setPaused(false);advance(4999);logic('popup resumes remaining time, not a fresh eight seconds',Boolean(popup),true);
  advance(1);logic('popup dismisses after eight unpaused seconds',popup,null);
  logic('popup automatic dismissal persisted',stored.activeId,null);
  await timed.savedResult(result,ctx);logic('popup cached save cannot replay dismissed result',[popup,paid],[null,1]);
  const fresh=createRoastSession({seed:stored,request:async()=>{paid++;}});fresh.reconcile(result.expenses,ROAST_DEFAULTS);
  logic('popup dismissed reload stays hidden without paid request',[fresh.getCurrent(),paid],[null,1]);
  // Replacing a completed purchase resets its reading time, never accepts an older cache.
  const replacement=addExpense(result.expenses,{...draft,description:'Timer replacement'}, {cats,today:ctx.today});
  timed.reconcile(replacement.expenses,ROAST_DEFAULTS);const replacing=timed.savedResult(replacement,ctx);
  finishRequest({ok:true,text:'New purchase, same suspicious lack of restraint from you.'});await replacing;
  advance(7000);await timed.savedResult(result,ctx);
  logic('popup older cache does not replace newer purchase',popup.id,String(replacement.action.id));
  advance(999);logic('popup newer purchase has its own full timer',Boolean(popup),true);advance(1);
  logic('popup newer purchase dismisses at own deadline',popup,null);
  timed.dispose();fresh.dispose();

  const oldContractSeed={...completedCache,entries:completedCache.entries.map(e=>({...e,text:'x'.repeat(300)}))};
  let migrationCalls=0,migrationCache;
  const migrated=createRoastSession({seed:oldContractSeed,request:async()=>{migrationCalls++;},persist:cache=>{migrationCache=cache;}});
  migrated.reconcile(result.expenses,ROAST_DEFAULTS);await migrated.savedResult(result,ctx);
  logic('old long roast cache migration retains paid attempt without request',[migrationCalls,migrationCache.entries.length,migrated.getCurrent()],[0,1,null]);
  logic('old long roast cache migration uses valid short fallback',validateRoastOutput({text:migrationCache.entries[0].text}).ok,true);
  migrated.dispose();
  let replacementView,finishNext,deadlineClock=0,idCounter=0,deadlines=new Map();
  const overlap=createRoastSession({request:()=>new Promise(resolve=>{finishNext=resolve;}),now:()=>deadlineClock,setTimer:(fn,ms)=>{deadlines.set(++idCounter,{fn,at:deadlineClock+ms});return idCounter;},clearTimer:id=>deadlines.delete(id),onChange:card=>{replacementView=card;}});
  const tick=ms=>{deadlineClock+=ms;for(const [id,t]of [...deadlines])if(t.at<=deadlineClock){deadlines.delete(id);t.fn();}};
  overlap.reconcile(result.expenses,ROAST_DEFAULTS);const firstPopup=overlap.savedResult(result,ctx);finishNext({ok:true,text:'First receipt, first questionable decision of this little test.'});await firstPopup;
  tick(7000);overlap.reconcile(secondResult.expenses,ROAST_DEFAULTS);const replacementPopup=overlap.savedResult(secondResult,ctx);finishNext({ok:true,text:'New receipt, fresh proof that restraint is taking a break.'});await replacementPopup;
  tick(1001);logic('newer popup cancels the old deadline and replaces it',replacementView.id,String(secondResult.action.id));
  tick(6999);logic('replacement popup gets full eight seconds from completion',replacementView,null);overlap.dispose();

}
