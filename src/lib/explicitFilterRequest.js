import { normaliseScopeText } from './filterMatching.js';
import { categoryNames } from './categoryVocabulary.js';
/** Bounded explicit description wording, not merchant recognition or a concept parser. */
export function descriptionOrRequest(message) {
  const text=String(message);
  const start=/\b(?:mentioning|containing|descriptions? matching)\s+/i.exec(text);
  const quoted=[];
  const source=start ? text.slice(start.index+start[0].length) : text;
  const protectedText=source.replace(/[“"]([^”"]*)[”"]/g,(_,term)=>`\u0000${quoted.push(term)-1}\u0000`);
  let body;
  if(start) body=protectedText.split(/\s+\b(?:all time|overall|ever|over|under|at least|at most|this month|last month|this week|last week|this year|last\s*\d+\s*days?|from\s+\d{4}|on weekends?|on weekdays?|by month|by category)\b|[?.!]/i)[0].trim().replace(/\s+(?:over|during|in|for)\s+(?:the\s+)?$/i,'').replace(/,\s*$/,'');
  else {
    const chain=/\u0000\d+\u0000(?:\s+(?:or|and)\s+\u0000\d+\u0000)+/i.exec(protectedText);
    if(!chain) return null;
    body=chain[0];
  }
  const restore=value=>value.replace(/\u0000(\d+)\u0000/g,(_,i)=>quoted[Number(i)]);
  const terms=body.split(/\s+(?:or|and)\s+|,\s*/i).map(t=>normaliseScopeText(restore(t)));
  // Restore exact delimiters/quote styles for replacing the original span.
  const rawBody=body.replace(/\u0000(\d+)\u0000/g,(_,i)=>{
    const re=/[“"][^”"]*[”"]/g;return [...source.matchAll(re)][Number(i)][0];
  });
  return {terms,span:(start?start[0]:'')+rawBody};
}
export function categoryRequestText(message) {
  const text=String(message);
  // A colon introducing a complete question separates background narrative
  // from the actual request; ordinary category-label colons are left alone.
  const tail=text.match(/:\s*((?:how much|show|list|what|total|break down)\b[^:]*)$/i);
  const background=tail ? text.slice(0,tail.index) : '';
  const focused=tail && background.length>200 && /\b(?:i|my)\b/i.test(background) ? tail[1] : text;
  const request=descriptionOrRequest(focused);
  return (request ? focused.replace(request.span,' ') : focused).replace(/[“"][^”"]*[”"]/g,' ');
}
/** Mark real vocabulary first; an unresolved coordinated subject cannot disappear. */
export function unresolvedCoordination(message,cats=[]) {
  let text=categoryRequestText(message).toLowerCase();
  const names=cats.flatMap(c=>categoryNames(c)).sort((a,b)=>b.length-a.length);
  for(const name of names){const escaped=name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');text=text.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`,'gu'),'$1 __category__ ');}
  // This only rejects bare coordinated subjects beside a category. Explicit
  // description wording or at/within filters have a separate, clear dimension.
  return /__category__\s*(?:,?\s+(?:and|or)\s+)(?!__category__\b|(?:this|last|what|which|how|show|a breakdown|the total)\b)[\p{L}\p{N}]/u.test(text)
    || /\b[\p{L}\p{N}]+\s+(?:and|or)\s+__category__/u.test(text.replace(/__category__/g,' __category__ '));
}
