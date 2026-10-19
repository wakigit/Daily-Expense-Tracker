import {comparisonPeriodHints} from './comparisonRequest.js';
import {mentionedCategories,needsScopeRules} from './intentLimitations.js';
import {categoryNames} from './categoryVocabulary.js';
import {descriptionOrRequest} from './explicitFilterRequest.js';
import {resolveQueryRange} from './queryDates.js';
import {validateQuery} from './queryContract.js';
const clarify=question=>({kind:'clarify',intent:'clarify',question,text:question});
/** Closed offline forms reuse the ordinary filter parser; leftovers never disappear. */
export function interpretComparisonOffline(question,cats,parseShared,today=''){
  if(!/\b(?:compare|compared|comparing|comparison|versus|vs)\b|\b(?:more|less)\b.*\b(?:or|than)\b/i.test(question))return null;
  if(!today) return null; // Named years require a reference date supplied by the caller.
  if(needsScopeRules(question))return clarify('Comparing related concepts or reviewed spending rules is not supported. Ask for separate reviewed totals.');
  const literal=descriptionOrRequest(question);
  const text=literal?question.replace(literal.span,' '):question;
  const hints=comparisonPeriodHints(text,today),named=mentionedCategories(text,cats);
  if(hints.error)return clarify(hints.error);
  if(hints.periods.length>2||named.length>2||(text.match(/\b(?:vs|versus)\b/gi)??[]).length>1)return clarify('Choose exactly two periods with the same filters, or two configured categories over one period.');
  if(hints.periods.length!==2&&named.length!==2)return null;
  // Preserve old scalar implicit month/week alignment through its existing grammar.
  if(named.length<2&&hints.periods.length===2&&hints.periods.every(p=>['month','lastmonth','week','lastweek'].includes(p.period)))return null;
  let rest=hints.text??text;
  const categorySides=named.length===2&&hints.periods.length<2;
  if(categorySides){
    for(const cat of named)for(const label of categoryNames(cat).sort((a,b)=>b.length-a.length))rest=rest.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^\\p{L}\\p{N}])`,'giu'),'$1 ');
    rest=rest.replace(/\b(?:or|and)\b/gi,' ');
  }
  rest=rest.replace(/\b(?:compare|compared|comparing|comparison|versus|vs|between|than|more|less|did|do|i|my|with|in|during|for)\b/gi,' ').replace(/[?,.]/g,' ').trim();
  const parsed=parseShared(`recorded spending ${rest} this month`);
  if(!parsed.query)return clarify('I could not preserve every comparison filter offline. Please give two exact periods with shared filters, or two configured categories over one period.');
  const q={...parsed.query,operation:'compare',groupBy:null,aggregate:'total'};
  if(literal){if(literal.terms.length===1)q.description=literal.terms[0];else q.descriptionTerms=literal.terms;}
  if(categorySides){
    const period=hints.periods[0]??{period:'month'};
    const canonical=period.period==='named_month'?{period:'range',...resolveQueryRange(period,today,[])}:period;
    Object.assign(q,{period:canonical.period,start:canonical.start??null,end:canonical.end??null,dayCount:canonical.dayCount??null,category:null,categories:[],categoryTerms:named.map(c=>c.label),comparison:{kind:'categories',categories:named.map(c=>c.id),periods:[]}});
  }else{
    if(named.length>1&&!/\b(?:combined|together|union)\b/i.test(question))return clarify('Do both periods use the same category union? Resubmit with the shared categories explicitly combined. Different categories and periods on each side are not supported.');
    Object.assign(q,{period:'all',start:null,end:null,dayCount:null,comparison:{kind:'periods',categories:[],periods:hints.periods}});
  }
  const checked=validateQuery(q,cats);
  return checked.ok?{query:checked.query}:clarify(checked.question);
}
