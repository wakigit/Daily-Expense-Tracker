import { transportClarification } from './categoryVocabulary.js';
/** Deterministic conversation boundaries, no ledger access or financial calculation. */
export const HELP_TEXT = 'Hi! I can help with recorded spending totals, filtered transactions, largest expenses, comparisons and category budget pace estimates.';
export const HELP_QUESTIONS = ['How much did I spend this month?', 'What was my largest single expense this month?', 'Show transactions over S$20 this month.'];
export function stripGreeting(message) {
  return String(message ?? '').trim().replace(/^(?:hello|hi|hey|hiya|yo|good morning|good afternoon|good evening)\b(?:\s+(?:there|tallyai))?[,!:.\s]*/i,'').trim();
}
/**
 * The only reply to a request for keys, prompts or instructions.
 *
 * Fixed text, chosen here and never written by the model. The key is not
 * reachable from this code in any case — it lives in the backend process
 * environment and is never sent to the browser or to the model — so there is
 * nothing to leak; this exists so the answer is the same every time instead of
 * whatever a model improvises under a persuasive prompt.
 */
export const SECURITY_REFUSAL = 'I will not share credentials, server configuration or my own instructions, and I have no access to them. I can only answer questions about your recorded spending — for example “How much did I spend this month?”';

/** Prompt shown instead of sending an empty question anywhere. */
export const EMPTY_PROMPT = 'Type a question about your recorded spending, for example “How much did I spend this month?”';

/**
 * Asking for the key, the system prompt, or the operating instructions.
 *
 * Matched locally and before any request, so these never cost a model call and
 * never depend on the model refusing correctly. Deliberately narrow: it must
 * not swallow ordinary questions that happen to contain "show" or "tell me".
 */
export function isCredentialOrPromptProbe(message) {
  const text = String(message ?? '').toLowerCase().replace(/\s+/g, ' ');
  const secret = /\b(api[- ]?key|apikey|openai[- ]?key|secret key|access token|auth token|bearer token|credentials?|\.env\b|environment variables?)\b/;
  const internals = /\b(system prompt|system message|your prompt|your instructions|initial instructions|developer message|prompt template|verbatim instructions)\b/;
  const extract = /\b(what is|what's|show|print|reveal|tell me|give me|repeat|output|disclose|leak|dump|display)\b/;
  if (secret.test(text) && (extract.test(text) || /\byour\b/.test(text))) return true;
  if (internals.test(text) && (extract.test(text) || /\bignore\b|\bverbatim\b/.test(text))) return true;
  return false;
}

export function dialogueIntent(message, cats = []) {
  /* Deliberately NOT handling empty input here. `validateIntent` consults this
     function and is legitimately called without a message (validating a stored
     or server-normalised payload), so an empty-message reply here would turn
     every such call into a clarification. Empty input is refused at the point a
     USER question enters, in assistantClient.requestIntent. */
  if (isCredentialOrPromptProbe(message)) return { type: 'clarify', question: SECURITY_REFUSAL, options: [] };
  const transport = transportClarification(message, cats);
  if (transport) return transport;
  const original=String(message ?? '').trim();
  const plain=original.toLowerCase().replace(/[?!.,]/g,'').replace(/\s+/g,' ').trim();
  const referential=stripGreeting(original).toLowerCase().replace(/[?!.,]/g,'').replace(/\s+/g,' ').trim();
  if (/^(?:please )?(?:(?:show|list)(?: me)? (?:all )?(?:those|these|them)\b|break (?:that|this|it) down\b|exclude\s)/i.test(referential)) return {type:'clarify',question:'I do not have a reusable previous-query context. Please resubmit the complete question with its description or category filter, date range and desired breakdown.',options:[]};
  if (/^(?:(?:hello|hi|hey|hiya|yo|good morning|good afternoon|good evening)(?: (?:there|tallyai))?(?: how are you)?|help|what can (?:you do|i ask)|how can you help(?: me)?)$/.test(plain)) return {type:'help'};
  let text=stripGreeting(original).toLowerCase();
  if (!/\b(highest|largest|biggest|most expensive)\b/.test(text) || !/\b(expenditure|expenses?|spending|spend|spent|purchases?|transactions?)\b/.test(text)) return null;
  let scope='this month';
  const explicit=text.match(/\b(this month|last month|this week|last week|today|yesterday|all time)\b/);
  if(explicit) {scope=explicit[1];text=text.replace(explicit[0],' ');}
  const range=text.match(/\b(?:from )?(\d{4}-\d{2}-\d{2}) (?:to|through) (\d{4}-\d{2}-\d{2})\b/);
  if(range) {scope=`from ${range[1]} to ${range[2]}`;text=text.replace(range[0],' ');}
  // A named grouping or explicit individual request belongs to the query interpreter.
  if(/\b(single|individual|transaction|purchase|category|categories|day|date|weekday|weekend|week|month)\b/.test(text)) return null;
  const rest=text.replace(/\b(what|which|is|was|are|were|my|the|i|did|have|highest|largest|biggest|most|expensive|expenditure|expenses?|spending|spend|spent|on|in|for|of|money)\b/g,' ').replace(/[?!.,]/g,'').trim();
  return {type:'clarify',question:`Do you mean your largest single transaction, highest-spending category, or highest-spending day?${rest?' Resubmit the complete question with its filters and date scope.':` These choices use ${scope}.`}`,
    options:rest?[]:[`What was my largest single expense ${scope}?`,`Which category had the highest total spending ${scope}?`,`Which day had the highest total spending ${scope}?`]};
}
/** Only self-contained questions, never context-losing one-word buttons. */
export const completeQuestionChoices = options => (options ?? []).filter(text=>typeof text==='string' && /\b(spend|spending|spent|expense|expenses|transaction|transactions|budget)\b/i.test(text) && /\b(month|week|today|yesterday|all time)\b|\d{4}-\d{2}-\d{2}/i.test(text));
