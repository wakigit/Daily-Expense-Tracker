import { mentionedCategories } from './intentLimitations.js';
import { MONTH_NAMES } from './periodMention.js';
import { resolveQueryRange } from './queryDates.js';
/** Date hints only: never figures or inferred merchant/category identity. */
export function comparisonPeriodHints(message,today){
  let text=String(message).replace(/[“"][^”"]*[”"]/g,' ');
  const dates=[...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)];
  if(dates.length){
    if(![2,4].includes(dates.length))return {periods:[],error:'Give exactly two complete ISO date ranges.'};
    return {periods:(dates.length===2?[0]:[0,2]).map(i=>({period:'range',start:dates[i][0],end:dates[i+1][0]})),text:text.replace(/(?:from\s+|between\s+)?\d{4}-\d{2}-\d{2}\s*(?:to|through|and|[-–])\s*\d{4}-\d{2}-\d{2}/gi,' ')};
  }
  text=text.replace(/\bmay\s+(?:i|we|you)\b/gi,' ');
  const aliases=MONTH_NAMES.flatMap((name,i)=>[{name,index:i+1},{name:name.slice(0,3),index:i+1}]);
  const pattern=new RegExp(`\\b(${[...new Set(aliases.map(x=>x.name)),'Sept'].sort((a,b)=>b.length-a.length).join('|')})(?:\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*[-–]\\s*(\\d{1,2})(?:st|nd|rd|th)?)?(?:\\s+(\\d{4}))?\\b`,'gi');
  const found=[...text.matchAll(pattern)];
  const periods=found.map(m=>{
    const month=m[1].toLowerCase()==='sept'?9:aliases.find(x=>x.name.toLowerCase()===m[1].toLowerCase()).index;
    const year=m[4]??today.slice(0,4),ym=`${year}-${String(month).padStart(2,'0')}`;
    return m[2]?{period:'range',start:`${ym}-${m[2].padStart(2,'0')}`,end:`${ym}-${m[3].padStart(2,'0')}`}:{period:'named_month',month:ym};
  });
  if(found.length)return {periods,text:text.replace(pattern,' ')};
  const relative=/\b(this month|last month|this week|last week)\b/gi;
  return {periods:[...text.matchAll(relative)].map(m=>({period:({'this month':'month','last month':'lastmonth','this week':'week','last week':'lastweek'})[m[1].toLowerCase()]})),text:text.replace(relative,' ')};
}
export function comparisonRequestIssue(q,message,today,expenses=[],cats=[]){
  if(!message)return null;
  const text=String(message).replace(/[“"][^”"]*[”"]/g,' ');
  if((text.match(/\b(?:vs|versus)\b/gi)??[]).length>1)return 'This comparison supports exactly two sides. Please select two.';
  const hints=comparisonPeriodHints(message,today);
  if(hints.error)return hints.error;
  if(q.comparison?.kind==='periods'){
    const clauses=text.split(/\b(?:versus|vs|with|against)\b/i);
    if(clauses.length===2){
      const ids=clauses.map(clause=>mentionedCategories(clause,cats).map(c=>c.id).sort());
      if(ids.every(list=>list.length)&&JSON.stringify(ids[0])!==JSON.stringify(ids[1]))return 'Different categories and different periods on each side are not supported together. Compare one shared scope across two periods, or two categories over one period.';
    }
    const relativePair=hints.periods.length===2&&(['month,lastmonth','lastmonth,month','week,lastweek','lastweek,week'].includes(hints.periods.map(p=>p.period).join(',')));
    if(relativePair&&!/\b(?:full|entire|whole)\b/i.test(message))return 'An implicit current-versus-previous month/week comparison uses matching elapsed dates. These sides requested full periods instead. Please resubmit the ordinary comparison, or explicitly request full periods.';
    if(hints.periods.length!==2)return 'This comparison supports exactly two periods. Please select two.';
    if(hints.periods.length===2){
      const wanted=hints.periods.map(p=>resolveQueryRange(p,today,expenses)).map(r=>`${r.start}/${r.end}`).sort();
      const got=q.comparison.periods.map(p=>resolveQueryRange(p,today,expenses)).map(r=>`${r.start}/${r.end}`).sort();
      if(JSON.stringify(wanted)!==JSON.stringify(got))return 'The interpreted dates do not match the requested complete periods. Please resubmit both exact inclusive ranges; I will not substitute or truncate named months.';
    }
  }else if(q.comparison?.kind==='categories'){
    if(hints.periods.length>1)return 'Compare two categories over one shared period, or one shared spending scope over two periods. Different categories and periods on each side are not supported together.';
    if(hints.periods.length===1){
      const wanted=resolveQueryRange(hints.periods[0],today,expenses),got=resolveQueryRange(q,today,expenses);
      if(wanted.start!==got.start||wanted.end!==got.end)return 'The category comparison does not preserve the requested complete period. Please give the shared inclusive date range.';
    }
  }
  return null;
}

/** A single result cannot answer an explicitly two-sided comparative request. */
export function requiresTwoSidedAnswer(message,cats=[]){
  const text=String(message).replace(/[“"][^”"]*[”"]/g,' ').replace(/\b(?:more|less|higher|lower|greater|smaller|larger) than\s*(?:s\$|\$|sgd\s*)?\d+(?:\.\d+)?/gi,' ');
  if(!/\b(?:compare|compared|comparing|comparison|versus|vs|more|less|higher|lower|greater|smaller|larger)\b/i.test(text))return false;
  const hints=comparisonPeriodHints(text,'2000-01-01'); // Only arity, never date selection or calculation.
  return hints.periods.length>=2||mentionedCategories(text,cats).length>=2||(text.match(/\b(?:versus|vs)\b/gi)??[]).length>0;
}
