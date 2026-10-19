import { validateQuery, validDate, rowMatches, matchingRows, weekday, WEEKDAYS, normaliseScopeText } from './queryContract.js';
import { categoryNames } from './categoryVocabulary.js';
import { shiftCalendarDate as addDays, calendarWeekStart as weekStart } from './queryDates.js';
import { sumCents, toCents } from './money';
import { money } from './format';
import { captureEvidence } from './answerEvidence';
import { comparisonRanges } from './comparison';
import { activeFilterPhrases, amountFilterPhrase, dayFilterPhrase, filterDisclosure } from './filterWording.js';
import { uncoveredMentionedMonths, monthName } from './periodMention.js';
const dollars = c => money(Math.round(c + 1e-9) / 100);
const clarify = question => ({kind:'clarify',question,text:question});
/**
 * Does the question's SUBJECT exist in the ledger at all?
 *
 * Returns `clarify` when a description term or category matches no recorded row
 * anywhere, `outside` when it matches only outside the requested period, and
 * null when there is nothing to disclose. Amount, weekday and date filters are
 * deliberately NOT considered: "nothing over S$20 this month" is an ordinary
 * true zero, whereas "no row has ever mentioned Groceries" means the question
 * was about something the ledger has never contained.
 */
export function unmatchedSubject(q, expenses = [], cats = []) {
  const needle = q.description ? normaliseScopeText(q.description) : null;
  const everDescription = needle === null ? null
    : expenses.filter(row => normaliseScopeText(row.description).includes(needle));
  /* Projection is exempt from the category arm. Its own wording already says
     "no recorded spending in this category, so there is no rate to estimate
     from" and it still reports the budget, which is what a budget question is
     actually asking. Refusing there would remove a useful, already-honest
     answer rather than prevent a misleading one. */
  const everCategory = q.category && q.operation !== 'projection'
    ? expenses.filter(row => row.category === q.category) : null;
  const labels = cats.map(c => c.label).join(', ');

  if (everDescription && !everDescription.length) {
    // A term that is really a category name is the most common version of this
    // mistake, so name that category instead of only listing all of them.
    const match = cats.find(c => categoryNames(c).some(name => normaliseScopeText(name) === needle)
      || normaliseScopeText(c.label).includes(needle));
    return {kind:'clarify',
      question:`No recorded purchase description contains “${q.description}”, so I have nothing to total. ${match ? `Did you mean the ${match.label} category? ` : ''}Your categories are: ${labels}. Resubmit the complete question using a category or a term that appears in your descriptions.`,
      text:`No recorded purchase description contains “${q.description}”.`};
  }
  if (everCategory && !everCategory.length) {
    const label = cats.find(c => c.id === q.category)?.label ?? q.category;
    return {kind:'clarify',
      question:`You have no recorded expenses in ${label} at all, so there is nothing to total. Your categories are: ${labels}. Resubmit the complete question with a category you have used.`,
      text:`No recorded expenses in ${label}.`};
  }

  /* The subject exists; report when none of it falls in the asked-for window. */
  const range = q.__resolvedRange;
  if (!range) return null;
  const inWindow = rows => rows.filter(row => row.date >= range.start && row.date <= range.end).length;
  const parts = [];
  if (everDescription?.length && !inWindow(everDescription)) {
    parts.push(`${everDescription.length} purchase${everDescription.length === 1 ? '' : 's'} mentioning “${q.description}” ${everDescription.length === 1 ? 'exists' : 'exist'} outside this period.`);
  }
  if (everCategory?.length && !inWindow(everCategory)) {
    const label = cats.find(c => c.id === q.category)?.label ?? q.category;
    parts.push(`${everCategory.length} ${label} purchase${everCategory.length === 1 ? '' : 's'} ${everCategory.length === 1 ? 'exists' : 'exist'} outside this period.`);
  }
  return parts.length ? {kind:'outside',message:parts.join(' ')} : null;
}

export function queryRange(q, today, expenses) {
  const ym = today.slice(0,7);
  if (q.period === 'range') return { start:q.start, end:q.end < today ? q.end : today };
  if (q.period === 'last_days') return {start:addDays(today,1-q.dayCount),end:today};
  if (q.period === 'year') return {start:`${today.slice(0,4)}-01-01`,end:today};
  if (q.period === 'today') return {start:today,end:today};
  if (q.period === 'yesterday') return {start:addDays(today,-1),end:addDays(today,-1)};
  if (q.period === 'week') return {start:weekStart(today),end:today};
  if (q.period === 'lastweek') return {start:addDays(weekStart(today),-7),end:addDays(weekStart(today),-1)};
  if (q.period === 'lastmonth') { const end=addDays(`${ym}-01`,-1); return {start:`${end.slice(0,7)}-01`,end}; }
  if (q.period === 'all') return {start:expenses.filter(e=>e.date<=today).map(e=>e.date).sort()[0] ?? today,end:today};
  return {start:`${ym}-01`,end:today};
}
function calendarDays(start,end) {
  if (end < start) return [];
  const n = Math.round((Date.parse(`${end}T00:00:00Z`)-Date.parse(`${start}T00:00:00Z`))/86400000)+1;
  return Array.from({length:n},(_,i)=>addDays(start,i));
}
/**
 * Appends the filter disclosure in ONE place.
 *
 * Every branch below builds its own headline sentence, and the restrictions in
 * force have to be visible on all of them. Doing that per-branch is how one
 * branch ends up silently omitting the filter that changed its answer, so the
 * disclosure is attached to the shared `result` and spliced onto the text here.
 */
export function executeQuery(raw, context) {
  const plan = buildAnswer(raw, context);
  if (plan.kind !== 'answer' || !plan.filterDisclosure) return plan;
  const { filterDisclosure: disclosure, ...rest } = plan;
  return { ...rest, text: `${plan.text}${disclosure}` };
}

function buildAnswer(raw, {expenses=[],cats=[],today,budgets={},approvedScope=null,message=''}) {
  // Canonical queries can be validated twice without trusting derived cents.
  const { amountCents: ignored, ...input } = raw;
  const checked=validateQuery(input,cats);
  if (!checked.ok) return clarify(checked.question);
  if (!validDate(today)) return clarify('A valid Singapore reference date is required. Please try again.');
  const q=checked.query, range=queryRange(q,today,expenses);
  if (q.spendingScope && JSON.stringify(q.spendingScope)!==JSON.stringify(approvedScope)) return clarify('Review and confirm the proposed spending rules before calculating this scope.');
  if (!validDate(range.start) || !validDate(range.end)) return clarify('The resolved date range is outside supported calendar dates (1900 to 2200).');
  if (range.start > range.end) return clarify('That range is entirely in the future. Choose recorded dates through today.');
  const scope={...range,start:q.period==='all'?'1900-01-01':range.start,historyStart:q.period==='all'?range.start:null,category:q.category,description:q.description,amountOperator:q.amountOperator,amountCents:q.amountCents,day:q.day,spendingScope:q.spendingScope};
  const rows=matchingRows(expenses,scope);
  const cat=cats.find(c=>c.id===q.category);
  const amountPhrase=amountFilterPhrase(q.amountOperator,dollars(q.amountCents));
  // `dayFilterPhrase` rather than the bare token: "weekday" alone reads as a
  // grouping, which is how a Monday-to-Friday restriction once hid in plain
  // sight and produced a confidently wrong winner.
  const filters=[cat?.label ?? 'All categories',q.description && `all descriptions mentioning “${q.description}” (case-insensitive substring)`,amountPhrase,dayFilterPhrase(q.day)].filter(Boolean).join(' · ');
  const interpretation={category:filters,period:`${range.start} to ${range.end} (inclusive, Singapore calendar dates)`};

  /* A subject filter that matches nothing ANYWHERE is not a zero total.
     "How much did I spend on Groceries this month?" used to answer "S$0.00
     across 0 transactions", which a reader takes as "you spent nothing on
     groceries" when the truth is "no such thing was ever recorded" — and the
     same path turned every phrase the offline grammar could not parse into a
     description filter, so unparseable questions also answered S$0.00.
     Period is deliberately ignored here: the question is whether the SUBJECT
     exists at all, which is a different claim from whether it occurred in the
     requested window. */
  const subjectNotice = unmatchedSubject({...q, __resolvedRange: range}, expenses, cats);
  if (subjectNotice?.kind === 'clarify') return subjectNotice;

  /* The question named a month none of the ranges we are about to report
     actually covers, so any figure would answer a different question. Checked
     HERE, against the ranges just resolved, rather than against a re-derivation
     of them — a second copy of the date logic is a second thing to drift.
     `message` is optional: follow-ups are parsed locally from a closed grammar
     and inherit their scope, so they pass none and the guard stays off. */
  const monthRanges = q.operation === 'compare'
    ? Object.values(comparisonRanges(q.period, today) ?? {}).filter(r => r && r.start && r.end)
    : [range];
  if (q.period !== 'all' && message) {
    const uncovered = uncoveredMentionedMonths(message, monthRanges);
    if (uncovered.length) {
      const named = uncovered.map(monthName).join(' and ');
      const covered = monthRanges.map(r => `${r.start} to ${r.end}`).join(' and ');
      return clarify(`You asked about ${named}, but this would have been calculated over ${covered}. ${q.operation === 'compare' ? 'Comparisons only cover this month against the matching dates of last month, or this week against last week.' : 'I can calculate only the periods I support, or an explicit date range.'} Resubmit the complete question with an explicit inclusive range, for example “How much did I spend from 2026-07-01 to 2026-07-31?”.`);
    }
  }
  const evidence=(selected=rows,basis=rows,overrides={})=>captureEvidence(selected,{basis,scope:{...scope,...overrides},cats});
  const total=sumCents(rows), days=calendarDays(range.start,range.end).filter(date=>rowMatches({date,description:'',category:q.category,amount:0},{day:q.day}));
  const result={kind:'answer',approvedScope:q.spendingScope?JSON.parse(JSON.stringify(q.spendingScope)):null,intent:q.operation,interpretation,evidence:evidence(),detail:'Recorded spending only. Missing logs can affect the result.',
    filterDisclosure:filterDisclosure(activeFilterPhrases({categoryLabel:cat?.label ?? null,description:q.description,amountPhrase,day:q.day}))};
  // The subject exists but not in this window. S$0.00 is then a true answer,
  // and saying where the matches actually are stops it reading as "never".
  if(subjectNotice?.kind==='outside') result.detail+=` ${subjectNotice.message}`;
  if(q.spendingScope) result.detail+=' Approved literal rules define this answer, not every real-world related purchase.';
  if (q.period==='range' && q.end>today) result.detail+=' Future dates are excluded; the range ends today.';
  if(q.operation==='breakdown') {
    const grouped=new Map();
    for (const row of rows) {
      const key=q.groupBy==='month'?row.date.slice(0,7):row.category ?? null;
      if (!grouped.has(key)) grouped.set(key,[]);
      grouped.get(key).push(row);
    }
    const groups=[...grouped].map(([key,selected])=>({
      key,
      label:q.groupBy==='month'?new Intl.DateTimeFormat('en-SG',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${key}-01T00:00:00Z`)):cats.find(c=>c.id===key)?.label ?? (key===null?'Uncategorised':`Unknown category (${key})`),
      totalCents:sumCents(selected),count:selected.length,
      // Keep the complete candidate basis: regrouping or new matches invalidate
      // every historical partition without changing its frozen displayed rows.
      evidence:evidence(selected)
    })).sort((a,b)=>q.groupBy==='month'?a.key.localeCompare(b.key):a.label.localeCompare(b.label,'en-SG')||String(a.key).localeCompare(String(b.key)));
    return {...result,text:rows.length?`${dollars(total)} recorded spending across ${rows.length} ${rows.length===1?'transaction':'transactions'}, broken down by ${q.groupBy}.`:'No matching recorded expenses. Total S$0.00 across 0 transactions.',
      detail:result.detail+' All amounts are SGD. Every non-empty group is included.',
      breakdown:{groupBy:q.groupBy,totalCents:total,count:rows.length,groups}};
  }
  if(q.operation==='compare') {
    const ranges=comparisonRanges(q.period,today);
    const sides=['current','earlier'].map(key=>{const s={...scope,...ranges[key]};const r=expenses.filter(e=>rowMatches(e,s));return {key,label:key==='current'?`This ${q.period} to date`:`Previous ${q.period}, matching dates`,...ranges[key],totalCents:sumCents(r),evidence:captureEvidence(r,{scope:s,cats})};});
    const delta=sides[0].totalCents-sides[1].totalCents, direction=delta>0?'more':delta<0?'less':'the same';
    const percentage=sides[1].totalCents>0?Math.abs(delta)/sides[1].totalCents*100:null;
    // Both ranges are named in the HEADLINE, not only in the interpretation
    // line. A comparison that silently resolved to different months than the
    // ones asked about is the failure this wording exists to make impossible
    // to miss.
    return {...result,evidence:undefined,text:`${dollars(sides[0].totalCents)} for ${sides[0].start} to ${sides[0].end} versus ${dollars(sides[1].totalCents)} for ${sides[1].start} to ${sides[1].end}: ${delta===0?'the same total':`${dollars(Math.abs(delta))} ${direction}`}.`,
      detail:[result.detail,percentage===null?'Percentage unavailable because the earlier total is zero.':`${percentage.toFixed(1)}% ${delta===0?'change':direction}.`,sides.some(s=>!s.evidence.rows.length)&&'One range has no recorded expenses. This is not a reliable spending trend.',ranges.capped&&'The previous month is shorter, so its range ends at month-end and has fewer days.'].filter(Boolean).join(' '),
      interpretation:{...interpretation,period:`${sides[0].start} to ${sides[0].end} vs ${sides[1].start} to ${sides[1].end}`},comparison:{sides,differenceCents:delta,direction,percentage}};
  }
  if(q.operation==='day_types') {
    const sides=['weekday','weekend'].map(day=>{const r=rows.filter(e=>rowMatches(e,{day})),count=days.filter(date=>rowMatches({date},{day})).length;return {key:day,label:day==='weekday'?'Weekdays (Monday–Friday)':'Weekends (Saturday–Sunday)',...range,totalCents:sumCents(r),calendarDays:count,averageCents:count?sumCents(r)/count:null,evidence:evidence(r,r,{day})};});
    const [a,b]=sides; const lower=(x,y)=>x===y?'the same':x<y?'weekdays':'weekends';
    const totalLower=lower(a.totalCents,b.totalCents),avgLower=a.averageCents===null||b.averageCents===null?null:lower(a.averageCents,b.averageCents);
    return {...result,evidence:undefined,text:`Weekdays: ${dollars(a.totalCents)}, ${a.averageCents===null?'no calendar days':`${dollars(a.averageCents)} per calendar day (${a.calendarDays} days)`}. Weekends: ${dollars(b.totalCents)}, ${b.averageCents===null?'no calendar days':`${dollars(b.averageCents)} per calendar day (${b.calendarDays} days)`}.`,
      detail:`Lower recorded total: ${totalLower}. ${avgLower===null?'Daily averages cannot be compared because a group has no calendar days.':`Lower daily average: ${avgLower}. ${avgLower!==totalLower?'These conclusions differ because the groups contain different numbers of calendar days.':''}`} Zero-spend days are included. Missing logs may affect this conclusion.`,comparison:{sides}};
  }
  if(q.operation==='projection') {
    const budgetCents=toCents(budgets[q.category]??0),elapsed=Number(today.slice(8)),rate=total/elapsed,remaining=budgetCents-total;
    result.budgetEvidence={category:q.category,amountCents:budgetCents};
    result.detail=`At your current recorded pace: ${dollars(total)} ÷ ${elapsed} elapsed calendar days = ${dollars(rate)} per day. Remaining budget ÷ this rate estimates time remaining. Future spending can differ.`;
    if(budgetCents<=0) result.text=`No budget set for ${cat.label}. Configure a category budget before estimating its exhaustion.`;
    else if(remaining<=0) result.text=`${cat.label}'s ${dollars(budgetCents)} budget is ${remaining===0?'exactly exhausted':`exceeded by ${dollars(-remaining)}`}. Recorded spending: ${dollars(total)}.`;
    else if(total===0) result.text=`${dollars(budgetCents)} remains. No recorded spending in this category, so there is no rate to estimate from.`;
    else if(elapsed<7||new Set(rows.map(e=>e.date)).size<3) result.text=`${dollars(remaining)} remains from ${dollars(budgetCents)}. Too little history for a date estimate: at least seven elapsed days and spending on three distinct dates are required.`;
    else {const time=remaining/rate,monthEnd=new Date(Date.UTC(+today.slice(0,4),+today.slice(5,7),0)).toISOString().slice(0,10),estimate=addDays(today,Math.ceil(time));
      result.text=estimate>monthEnd?`At your current recorded pace, the ${cat.label} budget should still have money remaining at month-end. ${dollars(remaining)} remains.`:`At your current recorded pace, ${cat.label}'s remaining ${dollars(remaining)} would last approximately ${time.toFixed(1)} days, around ${estimate}.`;
    }
    return result;
  }
  if(q.operation==='largest') {
    if(!rows.length) return {...result,text:'No matching recorded expenses. There is no largest transaction.'};
    const peak=Math.max(...rows.map(e=>toCents(e.amount)));
    const winners=rows.filter(e=>toCents(e.amount)===peak).sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
    const summaries=winners.map(e=>`${e.description} · ${e.date} · ${cats.find(c=>c.id===e.category)?.label??e.category} · ${dollars(peak)}`);
    // "Single" is load-bearing: a "top 3 expenses" question was answered with
    // this one row, and the old wording did not reveal that only one had been
    // considered.
    return {...result,text:`${winners.length>1?`Tied largest single recorded transactions (${winners.length})`:'Largest single recorded transaction'}: ${summaries.join('; ')}.`,evidence:evidence(winners)};
  }
  if(q.operation==='latest') {
    // Recency is by recorded DATE only. The data model has no creation
    // timestamp, so rows sharing the latest date are all shown rather than
    // ranked by an order the ledger does not actually record.
    if(!rows.length) return {...result,text:'No matching recorded expenses. There is no most recent transaction.'};
    const newest=rows.map(e=>e.date).sort().at(-1);
    const winners=rows.filter(e=>e.date===newest).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const summaries=winners.map(e=>`${e.description} · ${e.date} · ${cats.find(c=>c.id===e.category)?.label??e.category} · ${dollars(toCents(e.amount))}`);
    return {...result,text:`${winners.length>1?`Most recent recorded transactions (${winners.length}, same date)`:'Most recent recorded transaction'}: ${summaries.join('; ')}.`,
      detail:result.detail+(winners.length>1?' These share the latest recorded date; the ledger stores no time of day to separate them.':''),evidence:evidence(winners)};
  }
  if(q.operation==='highest') {
    const key=e=>q.groupBy==='weekday'?weekday(e.date):q.groupBy==='day'?e.date:q.groupBy==='week'?weekStart(e.date):q.groupBy==='month'?e.date.slice(0,7):e.category;
    const keys=q.groupBy==='weekday'?WEEKDAYS:[...new Set(rows.map(key))];
    const groups=keys.map(k=>{const r=rows.filter(e=>key(e)===k),occurrences=q.groupBy==='weekday'?days.filter(d=>weekday(d)===k).length:null,totalCents=sumCents(r);return {key:k,rows:r,totalCents,occurrences,value:q.groupBy==='weekday'&&q.aggregate==='daily_average'?(occurrences?totalCents/occurrences:-1):totalCents};}).filter(g=>g.value>=0);
    const peak=Math.max(...groups.map(g=>g.value)),winners=groups.filter(g=>g.value===peak);
    if(!rows.length) return {...result,text:'No matching recorded expenses. There is no spending winner.'};
    const summaries=winners.map(g=>`${cats.find(c=>c.id===g.key)?.label??g.key}: ${q.aggregate==='daily_average'&&q.groupBy==='weekday'?`${dollars(g.value)} per calendar occurrence, `:''}${dollars(g.totalCents)} total${g.occurrences!==null?`, ${g.occurrences} calendar occurrences`:''}`);
    return {...result,text:`${winners.length>1?'Tied highest':'Highest'} recorded ${q.groupBy} ${q.aggregate==='daily_average'?'daily average':'total'}: ${summaries.join('; ')}.`,detail:result.detail+(q.groupBy==='weekday'?' Zero-spend calendar occurrences are included. This describes this recorded range, not a prediction.':'')+(days.length<14?' Limited history: less than two weeks.':''),evidence:evidence(winners.flatMap(g=>g.rows)),analysisGroups:groups.map(({rows,...g})=>g)};
  }
  if(q.operation==='list') return {...result,text:`${rows.length} matching ${rows.length===1?'transaction':'transactions'}, totalling ${dollars(total)}. Expand “See transactions” for all matching rows.`,evidence:evidence([...rows].sort((a,b)=>b.date.localeCompare(a.date)))};
  if(q.operation==='count') return {...result,text:`${rows.length} recorded ${rows.length===1?'transaction':'transactions'}, totalling ${dollars(total)}.`};
  if(q.operation==='average') {
    const monthCount=new Set(days.map(d=>d.slice(0,7))).size;
    const denominator=q.aggregate==='per_transaction'?rows.length:q.aggregate==='calendar_month'?monthCount:days.length;
    const value=denominator?total/denominator*(q.aggregate==='calendar_week'?7:1):null;
    const unit=({per_transaction:'transaction',calendar_week:'calendar week (daily rate × 7)',calendar_month:'calendar month touched by this range',daily_average:'calendar day'})[q.aggregate];
    return {...result,text:value===null?'No matching observations, so this average is unavailable.':`${dollars(value)} average per ${unit}. Recorded total ${dollars(total)}; denominator ${denominator}${q.aggregate==='calendar_week'?' calendar days, scaled by seven':''}.`,detail:result.detail+(q.aggregate!=='per_transaction'?' Zero-spend calendar days are included. Partial months count as one month for a monthly average.':'')};
  }
  return {...result,text:`${dollars(total)} recorded spending across ${rows.length} ${rows.length===1?'transaction':'transactions'}.`};
}
