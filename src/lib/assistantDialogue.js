import { transportClarification } from './categoryVocabulary.js';
/** Deterministic conversation boundaries, no ledger access or financial calculation. */
export const HELP_TEXT = 'Hi! I can help with recorded spending totals, filtered transactions, largest expenses, comparisons and category budget pace estimates.';
export const HELP_QUESTIONS = ['How much did I spend this month?', 'What was my largest single expense this month?', 'Show transactions over S$20 this month.'];
export function stripGreeting(message) {
  return String(message ?? '').trim().replace(/^(?:hello|hi|hey|hiya|yo|good morning|good afternoon|good evening)\b(?:\s+(?:there|tallyai))?[,!:.\s]*/i,'').trim();
}
export function dialogueIntent(message, cats = []) {
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
