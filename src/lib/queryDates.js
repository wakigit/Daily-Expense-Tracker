/** Date-only UTC arithmetic, independent of the machine timezone and DST. */
export function shiftCalendarDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function calendarWeekStart(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftCalendarDate(date, -((day + 6) % 7));
}

export function resolveQueryRange(q, today, expenses) {
  if(q.period==='named_month'){const [y,m]=q.month.split('-').map(Number);return {start:q.month+'-01',end:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)};}
  const ym = today.slice(0,7);
  if (q.period === 'range') return { start:q.start, end:q.end < today ? q.end : today };
  if (q.period === 'last_days') return {start:shiftCalendarDate(today,1-q.dayCount),end:today};
  if (q.period === 'year') return {start:`${today.slice(0,4)}-01-01`,end:today};
  if (q.period === 'today') return {start:today,end:today};
  if (q.period === 'yesterday') return {start:shiftCalendarDate(today,-1),end:shiftCalendarDate(today,-1)};
  if (q.period === 'week') return {start:calendarWeekStart(today),end:today};
  if (q.period === 'lastweek') return {start:shiftCalendarDate(calendarWeekStart(today),-7),end:shiftCalendarDate(calendarWeekStart(today),-1)};
  if (q.period === 'lastmonth') { const end=shiftCalendarDate(`${ym}-01`,-1); return {start:`${end.slice(0,7)}-01`,end}; }
  if (q.period === 'all') return {start:expenses.filter(e=>e.date<=today).map(e=>e.date).sort()[0] ?? today,end:today};
  return {start:`${ym}-01`,end:today};
}
