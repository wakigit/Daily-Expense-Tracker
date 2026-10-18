// One fictional intent request. No provider output or exception text is printed.
import { requestIntent as providerRequest, isConfigured } from '../backend/src/provider.js';
import { validateIntent, buildContext } from '../src/lib/intent.js';
import { requestIntent as clientRequest } from '../src/lib/assistantClient.js';
import { planFromIntent } from '../src/lib/assistant.js';

const cats = [{ id: 'fictional-food-custom', label: 'Food' }, { id: 'fictional-bus', label: 'Public transport' }];
const expenses = [
  { id: 'fiction-a', description: 'Fictional lunch', category: cats[0].id, amount: 10.15, date: '2026-10-12' },
  { id: 'fiction-b', description: 'Fictional snack', category: cats[0].id, amount: 2.35, date: '2026-10-18' },
  { id: 'fiction-c', description: 'Fictional prior lunch', category: cats[0].id, amount: 8, date: '2026-09-12' },
];
const context = { cats, expenses, today: '2026-10-18' };
const fail = code => { console.log(`LIVE comparison: FAIL (${code})`); process.exitCode = 1; };
if (!isConfigured()) fail('provider_not_configured');
else {
  try {
    const raw = await providerRequest({ message: 'How does my food spending this month compare with last month?', context: buildContext(context) });
    const server = validateIntent(raw, { cats });
    if (!server.ok) throw { code: 'server_validation_failed' };
    const client = await clientRequest('How does my food spending this month compare with last month?', { ...context, fetchImpl: async () => ({ ok: true, json: async () => ({ intent: server.intent }) }) });
    if (!client.ok || client.intent.query?.metric !== 'compare' || client.intent.query?.period !== 'month' || client.intent.query?.category !== cats[0].id) throw { code: 'client_interpretation_failed' };
    const plan = planFromIntent(client.intent, context);
    if (!plan.comparison || plan.comparison.sides[0].totalCents !== 1250 || plan.comparison.sides[1].totalCents !== 800 || plan.comparison.differenceCents !== 450 || plan.comparison.sides[0].evidence.rows.length !== 2 || plan.comparison.sides[1].evidence.rows.length !== 1) throw { code: 'local_plan_failed' };
    console.log('LIVE comparison: PASS. One Responses request, strict schema, server validation, client validation, custom category, local cent totals and both evidence lists.');
  } catch (error) {
    const safe = ['provider_not_configured', 'provider_key_rejected', 'provider_access_denied', 'provider_error', 'empty_response', 'unparsable_response', 'server_validation_failed', 'client_interpretation_failed', 'local_plan_failed'];
    fail(safe.includes(error?.code) ? error.code : 'request_unavailable');
  }
}
