import { comparisonRequestIssue } from './comparisonRequest.js';
import { shiftCalendarDate as addDays, calendarWeekStart as weekStart, resolveQueryRange } from './queryDates.js';
import { validateQuery, validDate, matchingRows } from './queryContract.js';
import { activeFilterPhrases, amountFilterPhrase } from './filterWording.js';
import { uncoveredMentionedMonths, monthName } from './periodMention.js';
import { sumCents, fromCents } from './money';
import { money } from './format';
import { captureEvidence } from './answerEvidence';

/** Inclusive calendar windows. A shorter prior month is capped, never rolled over. */
export function comparisonRanges(period, today) {
  if (period === 'week') {
    const start = weekStart(today);
    return { current: { start, end: today }, earlier: { start: addDays(start, -7), end: addDays(today, -7) }, capped: false };
  }
  if (period !== 'month') return null;
  const [year, month, day] = today.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  return {
    current: { start: `${today.slice(0, 7)}-01`, end: today },
    earlier: { start: `${previous}-01`, end: `${previous}-${String(Math.min(day, lastDay)).padStart(2, '0')}` },
    capped: day > lastDay,
  };
}

export function comparisonAnswer({period,category=null},ctx){
  return executeComparison({operation:'compare',period,category},ctx);
}

const clarify=question=>({kind:'clarify',question,text:question});
const days=range=>Math.round((Date.parse(range.end+'T00:00:00Z')-Date.parse(range.start+'T00:00:00Z'))/86400000)+1;
const monthLabel=month=>new Intl.DateTimeFormat('en-SG',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'));
/** The single executor for legacy aligned and explicit two-sided totals. */
export function executeComparison(raw,{expenses=[],cats=[],today,message=''}){
  const checked=validateQuery(raw,cats);
  if(!checked.ok)return clarify(checked.question);
  if(!validDate(today))return clarify('A valid Singapore reference date is required.');
  const q=checked.query;
  if(q.spendingScope)return clarify('Comparing reviewed spending rules is not supported. Keep the approved rules and ask for separate totals.');
  const issue=comparisonRequestIssue(q,message,today,expenses,cats);
  if(issue)return clarify(issue);
  const legacy=!q.comparison;
  const aligned=legacy?comparisonRanges(q.period,today):null;
  const categoryComparison=q.comparison?.kind==='categories';
  const specs=legacy?['current','earlier'].map(key=>({key,label:key==='current'?`This ${q.period} to date`:`Previous ${q.period}, matching dates`,range:aligned[key],category:q.category}))
    :categoryComparison?q.comparison.categories.map((id,i)=>({key:i?'second':'first',label:cats.find(c=>c.id===id).label,range:resolveQueryRange(q,today,expenses),category:id}))
    :q.comparison.periods.map((period,i)=>({key:i?'second':'first',label:period.period==='named_month'?monthLabel(period.month):`Period ${i+1}`,range:resolveQueryRange(period,today,expenses),category:q.category}));
  let futureCapped=(q.period==='range'&&q.end>today)||Boolean(q.comparison?.periods.some(p=>p.period==='range'&&p.end>today));
  for(const spec of specs){
    if(!validDate(spec.range.start)||!validDate(spec.range.end))return clarify('A comparison period is outside supported calendar dates.');
    if(spec.range.end>today){spec.range={...spec.range,end:today};futureCapped=true;}
    if(spec.range.start>spec.range.end)return clarify('A comparison side is entirely in the future. Choose recorded dates through today.');
  }
  const missing=message?uncoveredMentionedMonths(message,specs.map(s=>s.range)):[];
  if(missing.length)return clarify(`You asked about ${missing.map(monthName).join(' and ')}, but this would use ${specs.map(s=>`${s.range.start} to ${s.range.end}`).join(' versus ')}. Please give both exact inclusive date ranges; I will not substitute current and previous month.`);
  const sides=specs.map(spec=>{
    const scope={...spec.range,category:spec.category,categories:q.categories,description:q.description,descriptionTerms:q.descriptionTerms,day:q.day,amountOperator:q.amountOperator,amountCents:q.amountCents,spendingScope:null,deduplicate:true};
    const rows=matchingRows(expenses,scope);
    const filters=activeFilterPhrases({categoryLabel:cats.find(c=>c.id===spec.category)?.label,categoryLabels:q.categories.map(id=>cats.find(c=>c.id===id).label),description:q.description,descriptionTerms:q.descriptionTerms,day:q.day,amountPhrase:amountFilterPhrase(q.amountOperator,money((q.amountCents??0)/100))});
    return {...spec.range,key:spec.key,label:spec.label,totalCents:sumCents(rows),count:rows.length,calendarDays:days(spec.range),filters:filters.length?filters.join('; '):'All categories and descriptions; all days; no amount restriction',evidence:captureEvidence(rows,{scope,cats,categoryIds:[spec.category].filter(Boolean)}),foreignCurrency:rows.some(r=>r.currency&&r.currency!=='SGD')};
  });
  if(sides.some(s=>s.foreignCurrency))return clarify('This comparison supports SGD records only. Separate records in other currencies; I will not combine or convert them.');
  const differenceCents=sides[0].totalCents-sides[1].totalCents;
  const direction=differenceCents>0?'more':differenceCents<0?'less':'the same';
  const larger=differenceCents===0?'tie':differenceCents>0?sides[0].label:sides[1].label;
  const overlap=sides[0].start<=sides[1].end&&sides[1].start<=sides[0].end;
  const earlier=legacy?1:categoryComparison||overlap?null:sides[0].end<sides[1].start?0:1;
  const baseline=earlier===null?null:sides[earlier],target=earlier===null?null:sides[1-earlier];
  const percentage=baseline&&baseline.totalCents>0?Math.abs(target.totalCents-baseline.totalCents)/baseline.totalCents*100:null;
  const detail=['Recorded spending only, all amounts SGD. Missing logs can affect both totals.',
    sides.some(s=>!s.count)&&'At least one side has no matching recorded expenses; this is not proof of no real-world spending and not a reliable spending trend.',
    sides[0].calendarDays!==sides[1].calendarDays&&`Unequal intervals: ${sides[0].calendarDays} versus ${sides[1].calendarDays} calendar days, different numbers of days. The shorter interval has fewer days. Totals are not duration-adjusted.`,
    aligned?.capped&&'The previous month is shorter, so its matching range ends at month-end.',
    futureCapped&&'Future dates are excluded: the affected side ends today, not at the requested full period end.',
    overlap&&!categoryComparison&&'The periods overlap. The same transaction may count independently on both sides; no cross-side deduplication is applied.',
    baseline?baseline.totalCents===0?`Percentage unavailable: percentage change is undefined because baseline ${baseline.label} (${baseline.start} to ${baseline.end}) has a zero recorded total.`:`${percentage.toFixed(1)}% ${target.totalCents===baseline.totalCents?'change':target.totalCents>baseline.totalCents?'increase':'decrease'} from baseline ${baseline.label} (${baseline.start} to ${baseline.end}) to ${target.label} (${target.start} to ${target.end}).`:'No percentage baseline is assigned to this symmetric or overlapping comparison.'
  ].filter(Boolean).join(' ');
  return {kind:'answer',intent:'compare',text:`${sides.map(s=>`${s.label}: ${money(s.totalCents/100)} across ${s.count} transactions (${s.start} to ${s.end})`).join(' versus ')}. ${differenceCents===0?'The recorded totals tie':`${larger} has the larger recorded total`}; exact difference ${money(Math.abs(differenceCents)/100)}.`,detail,
    interpretation:{category:legacy&&!q.description&&!q.descriptionTerms.length&&!q.categories.length&&!q.amountOperator&&q.day==='all'?(cats.find(c=>c.id===q.category)?.label??'All categories'):sides.map(s=>`${s.label}: ${s.filters}`).join(' | '),period:`${sides[0].start} to ${sides[0].end} vs ${sides[1].start} to ${sides[1].end}`},
    comparison:{sides,differenceCents,direction,percentage,larger,baselineKey:baseline?.key??null,overlap:overlap&&!categoryComparison}};
}

/** Conservative local interpretation: unresolved or multiple subjects need clarification. */
export function matchComparison(question, cats) {
  const q = question.toLowerCase();
  if (!/\b(compare|compared|comparison|versus|vs)\b|\b(more|less|same)\b.*\bthan\b/.test(q)) return null;
  const period = /\bthis month\b/.test(q) && /\blast month\b/.test(q) ? 'month'
    : /\bthis week\b/.test(q) && /\blast week\b/.test(q) ? 'week' : null;
  let remainder = q;
  const matches = [];
  for (const cat of [...cats].sort((a, b) => b.label.length - a.label.length)) {
    const label = cat.label.toLowerCase();
    if (!label) continue;
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'gu');
    if (re.test(remainder)) { matches.push(cat); remainder = remainder.replace(re, ' '); }
  }
  remainder = remainder.replace(/\b(did|how|does|do|my|i|spend|spending|spent|more|less|same|compare|compared|comparison|with|to|than|this|last|month|week|all|total|expenses|on|the|is|was|versus|vs)\b/g, ' ').replace(/[\s?.,!'’]/g, '');
  if (!period || matches.length > 1 || remainder) return { kind: 'clarify', question: 'I can compare this month with last month, or this week with last week, for all spending or one category. Which period and category do you mean?' };
  return { query: { metric: 'compare', period, category: matches[0]?.id ?? null } };
}
