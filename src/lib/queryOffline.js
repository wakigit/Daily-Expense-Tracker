import { categoryNames } from './categoryVocabulary.js';
import { dialogueIntent, stripGreeting, HELP_TEXT, HELP_QUESTIONS } from './assistantDialogue.js';
import { executeQuery } from './queryEngine';
import { validateQuery, WEEKDAYS } from './queryContract.js';
/** Conservative grammar. Unconsumed words produce a clarification, never a simpler answer. */
export function interpretOffline(question, cats=[]) {
  const dialogue=dialogueIntent(question, cats);
  if(dialogue) return dialogue.type==='help'?{kind:'answer',text:HELP_TEXT,suggestions:HELP_QUESTIONS}:{kind:'clarify',text:dialogue.question,question:dialogue.question,suggestions:dialogue.options};
  let text=stripGreeting(question).toLowerCase().trim();
  if (!text) return {kind:'clarify',intent:'none',text:'Ask about recorded spending.',question:'What would you like to calculate?'};
  const clarify=question=>({kind:'clarify',intent:'clarify',question,text:question});
  if (!/\b(pay|paid|spend|spending|spent|purchases?|transactions?|expenses?|expenditure|entries|budget|compare|comparison|show|list|find|average|count|how much|breakdown|break down)\b/.test(text)) return {kind:'clarify',intent:'clarify',text:'I support recorded spending queries, not unrestricted questions. Please ask for a total, filtered transactions, a weekday pattern, comparison or category budget pace.',question:'Which supported spending calculation do you want?'};
  if (/\brelated\b|\bincluding\b|\bexclude\b/.test(text)) return clarify('Related spending needs reviewed rules. Please specify literal descriptions and categories to include, then review a scope proposal; offline interpretation cannot infer this concept.');
  const q={operation:'total',period:'month',start:null,end:null,category:null,description:null,amountOperator:null,amount:null,day:'all',groupBy:null,aggregate:'total',category_terms:[]};
  const quotes=[...text.matchAll(/[“"]([^”"]+)[”"]/g)];
  if(quotes.length>1) return clarify('Please use one description search term in your complete question.');
  if(quotes.length) {q.description=quotes[0][1];text=text.replace(quotes[0][0],' ');}
  if (/\blast\s+(?!(?:week|month|year)\b)(?!\d+\s*days?\b)\S+\s+days?\b/.test(text)) return clarify('Last N days needs a whole number from 1 to 3660. Please resubmit the full question with that count.');
  const categoryGrouping=/\b(?:by|per|for each) categor(?:y|ies)\b|\bcategor(?:y|ies) (?:breakdown|split|subtotals?)\b/;
  const monthGrouping=/\b(?:by|per|for each) (?:calendar )?month\b|\bmonthly (?:breakdown|split|subtotals?)\b/;
  const breakdownCategory=categoryGrouping.test(text)||/\bwhat categor(?:y|ies)\b.*\b(?:fall|went|in|into)\b/.test(text);
  const breakdownMonth=monthGrouping.test(text);
  if (breakdownCategory && breakdownMonth) return clarify('Please resubmit the complete question with either a category breakdown or a monthly breakdown.');
  const breakdown=breakdownCategory||breakdownMonth;
  if (!breakdown && /\bbreak(?:down| down)\b|\bsplit\b/.test(text)) return clarify('Complete breakdowns support category or calendar month. Please resubmit the full question with one of those groupings.');
  if (breakdown && /\b(?:compare|compared|comparison|versus|vs|average|highest|largest|latest|top)\b|\b(?:more|less)\b.*\bthan\b/.test(text)) return clarify('Complete breakdowns support totals and transaction counts, not grouped comparisons, averages or winners. Please resubmit the full question with one operation.');
  if (breakdown) {
    q.operation='breakdown';q.groupBy=breakdownCategory?'category':'month';
    text=text.replace(/(?:,?\s*and\s+)?what categories did (?:those|these|the) purchases fall into/g,' ')
      .replace(categoryGrouping,' ').replace(monthGrouping,' ')
      .replace(/\bbreak(?:down| down)\b|\bsplit\b/g,' ');
  }
  text=text.replace(/\b(?:over|during|for|in)\s+(?:the\s+)?(?=last\s*\d+\s*days?\b)/g,' ');
  const comparisons=/\bcompar\w*\b|\b(more|less|same)\b.*\bthan\b/.test(text);
  if(breakdown) { /* Preserve the requested complete grouping. */ }
  else if(/\b(run out|exhaust|budget.*last|spending pace)\b/.test(text)) q.operation='projection';
  else if(/\bweekdays?\b/.test(text)&&/\bweekends?\b/.test(text)) q.operation='day_types';
  else if(/day of (the )?week|\bweekday\b.*\b(most|highest)\b|\b(highest|most|biggest)\b.*\bweekday\b/.test(text)) {q.operation='highest';q.groupBy='weekday';q.aggregate=/\btotal\b/.test(text)?'total':'daily_average';q.period='all';}
  else if(comparisons) q.operation='compare';
  // Recency before the largest/highest branches: "most recent" contains "most",
  // which would otherwise fall through to a highest-spending grouping. "last"
  // only counts when it is not naming a period ("last month", "last week").
  else if(/\b(most recent|latest|newest)\b/.test(text)||/\blast\b(?!\s+(?:month|week|year|\d))/.test(text)) q.operation='latest';
  else if(/\b(largest|biggest|highest|most expensive)\b/.test(text)&&/\b(single|individual|transaction|purchase)\b/.test(text)) q.operation='largest';
  else if(/\b(show|list|find)\b/.test(text)) q.operation='list';
  else if(/\b(how many|count|number of)\b/.test(text)) q.operation='count';
  else if(/\b(most|highest|biggest|top)\b/.test(text)) {q.operation='highest';q.groupBy=/\bcategory|categories|what.*on\b/.test(text)?'category':/\bmonth\b/.test(text.replace(/this month|last month/g,''))?'month':/\bweek\b/.test(text.replace(/this week|last week/g,''))?'week':'day';}
  else if(/\baverage\b|\busually\b/.test(text)) {q.operation='average';q.aggregate=/per transaction|per purchase/.test(text)?'per_transaction':/weekly|per week|a week/.test(text)?'calendar_week':/monthly|per month|for the month/.test(text)?'calendar_month':'daily_average';}
  if(q.operation==='average') q.period='all';
  if(q.operation==='latest') q.period='all';
  if (q.operation==='highest' && q.groupBy!=='weekday') q.period='all';
  if (q.operation==='average' && /\bweekly|monthly|daily\b/.test(text)) text=text.replace(/\b(daily|weekly|monthly)\b/g,' ');
  if(q.operation==='compare') {
    q.period=/\bmonth\b/.test(text)&&/\blast month\b/.test(text)?'month':/\bweek\b/.test(text)&&/\blast week\b/.test(text)?'week':null;
    if(!q.period || /\byear|yesterday|today|last two|last 2|last three|last 3\b/.test(text)) return clarify('I can compare this month to matching elapsed dates last month, or this week to matching days last week. Please resubmit the full question with one of those pairs.');
  } else {
    const explicit=text.match(/(?:from\s+)?(\d{4}-\d{2}-\d{2})\s+(?:to|through)\s+(\d{4}-\d{2}-\d{2})/);
    if(explicit) {q.period='range';q.start=explicit[1];q.end=explicit[2];text=text.replace(explicit[0],' ');}
    else if (/\blast\s*\d+\s*days?\b/.test(text)) {
      const relative=text.match(/\blast\s*(\d+)\s*days?\b/);q.period='last_days';q.dayCount=Number(relative[1]);text=text.replace(relative[0],' ');
    }
    else if (/\b(?:this year|year[ -]to[ -]date|ytd)\b/.test(text)) {q.period='year';text=text.replace(/\b(?:this year|year[ -]to[ -]date|ytd)\b/g,' ');}
    else if (/\blast\s+days?\b/.test(text)) return clarify('How many calendar dates should I include? Resubmit the full question with last N days (1 to 3660).');
    else if(/\byesterday\b/.test(text)) q.period='yesterday';
    else if(/\btoday\b/.test(text)) q.period='today';
    else if(/\blast week\b/.test(text)) q.period='lastweek';
    else if(/\blast month\b/.test(text)) q.period='lastmonth';
    else if(/\bthis week\b/.test(text)) q.period='week';
    else if(/\bthis month\b/.test(text)) q.period='month';
    else if(/\ball time|overall|ever\b/.test(text)) q.period='all';
  }
  const categoryHits=[];
  for(const c of [...cats].sort((a,b)=>b.label.length-a.label.length)) {
    const escaped=categoryNames(c).map(label=>label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    const re=new RegExp(`(^|[^a-z0-9])(?:${escaped})(?=$|[^a-z0-9])`,'g');
    if(re.test(text)) {categoryHits.push(c);text=text.replace(re,' ');}
  }
  if(categoryHits.length>1) return clarify('Please resubmit the full question with one category. Combining multiple categories is not supported.');
  if (q.operation!=='day_types' && /\b(and|or)\b/.test(text.replace(/this (month|week)\s+and\s+last (month|week)/g,''))) return clarify('Please resubmit the full question with one category and one description term. Multiple spending subjects are not supported.');
  q.category=categoryHits[0]?.id??null;q.category_terms=categoryHits.map(c=>c.label);
  const threshold=text.match(/\b(over|under|at least|at most|more than|less than)\s*(?:s\$|\$|sgd\s*)?(\d+(?:\.\d{1,2})?)(?![\d.])/i);
  if(threshold) {q.amountOperator=({'over':'gt','more than':'gt','under':'lt','less than':'lt','at least':'gte','at most':'lte'})[threshold[1]];q.amount=threshold[2];text=text.replace(threshold[0],' ');}
  else if(/\b(over|under|at least|at most)\b/.test(text)) return clarify('What dollar threshold should I use? Resubmit the full question with an amount, for example “Show purchases over S$12.50 last week”.');
  if(q.operation!=='day_types'&&q.groupBy!=='weekday') {
    const individual=WEEKDAYS.filter(d=>new RegExp(`\\b${d.toLowerCase()}s?\\b`).test(text));
    if(individual.length>1) return clarify('Please choose one weekday, all weekdays, or all weekends in the full question.');
    q.day=individual[0]??(/\bweekends?\b/.test(text)?'weekend':/\bweekdays?\b/.test(text)?'weekday':'all');
  }
  text=text.replace(/day of (the )?week|at my current|based on my current|run out|at what pace|per calendar day|per day|per week|per month|for the month|per transaction|per purchase|this month|last month|this week|last week|all time|at most|at least/g,' ')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/g,' ')
    .replace(/\b(give|complete|did|have|has|had|am|are|is|was|will|when|which|what|how|does|do|can|could|would|should|my|me|i|you|the|a|an|and|or|money|pay|paid|spend|spending|spent|purchases?|transactions?|expenses?|expenditure|entries|recorded|single|individual|largest|expensive|most|highest|biggest|top|total|totals|less|more|same|compare|compared|comparison|with|to|than|on|for|of|in|from|all|show|list|find|count|number|many|much|amount|average|usually|over|during|past|day|days|week|month|category|categories|weekdays?|weekends?|yesterday|today|overall|ever|budget|pace|current|based|out|exhaust|last|per|by|descriptions?|mentioning|recent|latest|newest)\b/g,' ')
    .replace(/[?.,!'’]/g,' ').replace(/\s+/g,' ').trim();
  if(text) {
    if(q.description || /\b(and|or)\b|\d|\b(year|tomorrow|fortnight|quarter)\b/.test(text)) return clarify('I could not safely interpret every filter. Please use one category and/or a quoted description term, an amount condition, and a supported period or ISO date range.');
    q.description=text;
  }
  if(q.operation==='projection'&&!q.category) return clarify(`Which configured category budget should I estimate? Resubmit the complete question using one of: ${cats.map(c=>c.label).join(', ')}.`);
  const checked=validateQuery(q,cats);return checked.ok?{query:checked.query}:clarify(checked.question);
}
export function answerOfflineQuery(question,ctx) {
  const parsed=interpretOffline(question,ctx.cats);
  return parsed.query?executeQuery(parsed.query,ctx):parsed;
}
