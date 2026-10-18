import { validateQuery, rowMatches, weekday, WEEKDAYS } from './queryContract.js';
import { addDays, weekStart } from './stats';
import { sumCents, toCents } from './money';
import { money } from './format';
import { captureEvidence } from './answerEvidence';
import { comparisonRanges } from './comparison';
const dollars = c => money(Math.round(c + 1e-9) / 100);
const clarify = question => ({kind:'clarify',question,text:question});
export function queryRange(q, today, expenses) {
  const ym = today.slice(0,7);
  if (q.period === 'range') return { start:q.start, end:q.end < today ? q.end : today };
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
export function executeQuery(raw, {expenses=[],cats=[],today,budgets={}}) {
  // Canonical queries can be validated twice without trusting derived cents.
  const { amountCents: ignored, ...input } = raw;
  const checked=validateQuery(input,cats);
  if (!checked.ok) return clarify(checked.question);
  const q=checked.query, range=queryRange(q,today,expenses);
  if (range.start > range.end) return clarify('That range is entirely in the future. Choose recorded dates through today.');
  const scope={...range,start:q.period==='all'?'1900-01-01':range.start,historyStart:q.period==='all'?range.start:null,category:q.category,description:q.description,amountOperator:q.amountOperator,amountCents:q.amountCents,day:q.day};
  const rows=expenses.filter(e=>rowMatches(e,scope));
  const cat=cats.find(c=>c.id===q.category);
  const filters=[cat?.label ?? 'All categories',q.description && `all descriptions mentioning “${q.description}” (case-insensitive substring)`,q.amountOperator && `${({gt:'over',lt:'under',gte:'at least',lte:'at most'})[q.amountOperator]} ${dollars(q.amountCents)}`,q.day!=='all' && q.day].filter(Boolean).join(' · ');
  const interpretation={category:filters,period:`${range.start} to ${range.end} (inclusive, Singapore calendar dates)`};
  const evidence=(selected=rows,basis=rows,overrides={})=>captureEvidence(selected,{basis,scope:{...scope,...overrides},cats});
  const total=sumCents(rows), days=calendarDays(range.start,range.end).filter(date=>rowMatches({date,description:'',category:q.category,amount:0},{day:q.day}));
  const result={kind:'answer',intent:q.operation,interpretation,evidence:evidence(),detail:'Recorded spending only. Missing logs can affect the result.'};
  if (q.period==='range' && q.end>today) result.detail+=' Future dates are excluded; the range ends today.';
  if(q.operation==='compare') {
    const ranges=comparisonRanges(q.period,today);
    const sides=['current','earlier'].map(key=>{const s={...scope,...ranges[key]};const r=expenses.filter(e=>rowMatches(e,s));return {key,label:key==='current'?`This ${q.period} to date`:`Previous ${q.period}, matching dates`,...ranges[key],totalCents:sumCents(r),evidence:captureEvidence(r,{scope:s,cats})};});
    const delta=sides[0].totalCents-sides[1].totalCents, direction=delta>0?'more':delta<0?'less':'the same';
    const percentage=sides[1].totalCents>0?Math.abs(delta)/sides[1].totalCents*100:null;
    return {...result,evidence:undefined,text:`You recorded ${dollars(sides[0].totalCents)} versus ${dollars(sides[1].totalCents)}: ${delta===0?'the same total':`${dollars(Math.abs(delta))} ${direction}`}.`,
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
    return {...result,text:`${winners.length>1?`Tied largest recorded transactions (${winners.length})`:'Largest recorded transaction'}: ${summaries.join('; ')}.`,evidence:evidence(winners)};
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
