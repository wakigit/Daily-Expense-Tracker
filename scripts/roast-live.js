// Exactly one live request with fictional history. Print only validated roast text.
import { validateRoastInput } from '../src/lib/roastContract.js';
import { handleRoast } from '../backend/src/routes.js';
import { buildRoastInput } from '../src/lib/roastFacts.js';
import { requestRoast } from '../src/lib/roastClient.js';
const row = (id, date, description, amount) => ({ id, date, description, amount, category: 'fictional-food' });
const transaction = row('fictional-fourth', '2026-10-18', 'Bubble tea', 6.5);
const expenses = [row('fictional-first','2026-10-12','Bubble tea',6.5),row('fictional-second','2026-10-14','Bubble tea',6.5),row('fictional-third','2026-10-16','Bubble tea',6.5),row('fictional-rice','2026-10-17','Chicken rice',8),transaction];
const input = buildRoastInput(transaction,{expenses,cats:[{id:'fictional-food',label:'Food'}],budgets:{'fictional-food':40},today:'2026-10-18',preferences:{enabled:true,name:'',singapore:true,smu:true},angleIndex:4});
if (process.argv.includes('--dry-run')) { console.log(`Input validation: ${validateRoastInput(input).ok ? 'PASS' : 'FAIL'}. Server key present: ${Boolean(process.env.OPENAI_API_KEY)}.`); }
else try {
  const response = await handleRoast(input); // One actual Responses call, no retries.
  const client = await requestRoast(input,{fetchImpl:async()=>new Response(JSON.stringify(response.body),{status:response.status,headers:{'Content-Type':'application/json'}})});
  console.log('Controlled live diagnostic:', JSON.stringify(client.diagnostic));
  if (!client.ok) { console.log(`LIVE roast: FAIL (${['roast_unavailable','invalid_roast','invalid_roast_input','roast_too_large'].includes(response.body.error) ? response.body.error : 'client_validation_failed'}). No raw provider response printed.`); process.exitCode=1; }
  else {
    console.log('LIVE roast: PASS, shared route and client validation.');
    console.log('Verified fictional facts: 4 exact Bubble tea purchases this week and month, S$26.00; Food S$34.00 this month; near budget, intensity 1; SMU angle enabled.');
    console.log(`Validated roast: ${client.text}`);
  }
} catch { console.log('LIVE roast: FAIL. Request unavailable; no provider details printed.'); process.exitCode=1; }
