/** Shared, closed interpretation contract. Thresholds are inputs, never model totals. */
export const OPERATIONS = ['total', 'count', 'average', 'list', 'highest', 'compare', 'day_types', 'projection', 'largest', 'latest'];
export const QUERY_PERIODS = ['today', 'yesterday', 'week', 'lastweek', 'month', 'lastmonth', 'all', 'range'];
export const GROUPS = ['day', 'week', 'month', 'category', 'weekday'];
export const DAY_FILTERS = ['all', 'weekday', 'weekend', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS = DAY_FILTERS.slice(3);
export const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && s >= '1900-01-01' && s <= '2200-12-31' && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export const weekday = date => WEEKDAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];
export function rowMatches(row, scope = {}) {
  if ((scope.start && row.date < scope.start) || (scope.end && row.date > scope.end)) return false;
  if (scope.category && row.category !== scope.category) return false;
  if (scope.description && !(row.description ?? '').toLocaleLowerCase('en-SG').includes(scope.description.toLocaleLowerCase('en-SG'))) return false;
  const day = weekday(row.date);
  if (scope.day && scope.day !== 'all' && (scope.day === 'weekday' ? ['Saturday','Sunday'].includes(day) : scope.day === 'weekend' ? !['Saturday','Sunday'].includes(day) : day !== scope.day)) return false;
  if (scope.amountOperator) {
    const cents = Math.round(Number(row.amount) * 100 + 1e-9), value = scope.amountCents;
    if (!({ gt: cents > value, lt: cents < value, gte: cents >= value, lte: cents <= value })[scope.amountOperator]) return false;
  }
  return true;
}
export function validateQuery(raw, cats = []) {
  const fail = (question, field='structure') => ({ ok: false, question, field });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Please specify a supported spending question.');
  const allowed = ['operation','period','start','end','category','description','amountOperator','amount','day','groupBy','aggregate','category_terms','categoryTerms'];
  if (Object.keys(raw).some(k => !allowed.includes(k))) return fail('The query contains unsupported fields.');
  const { operation, period = 'month', category = null, description = null, amountOperator = null, amount = null, day = 'all', groupBy = null, aggregate = 'total', start = null, end = null } = raw;
  if (!OPERATIONS.includes(operation) || !QUERY_PERIODS.includes(period) || !DAY_FILTERS.includes(day) || !['total','daily_average','per_transaction','calendar_week','calendar_month'].includes(aggregate)) return fail('Choose a supported operation, period and grouping.', !OPERATIONS.includes(operation)?'operation':!QUERY_PERIODS.includes(period)?'period':!DAY_FILTERS.includes(day)?'day':'aggregate');
  if (category !== null && !cats.some(c => c.id === category)) return fail('Which of your configured categories do you mean?', 'category');
  const terms = raw.category_terms ?? raw.categoryTerms ?? [];
  if (!Array.isArray(terms) || terms.some(x => typeof x !== 'string')) return fail('Please name one category.', 'category_terms');
  if (terms.length > 1) return fail('I support one category per query. Please resubmit the full question with one category.', 'category_terms');
  if (terms.length === 1 && !category) return fail(`I could not match “${terms[0]}” to a category. Please resubmit using your category label, or explicitly ask for descriptions mentioning that term.`, 'category_terms');
  if (description !== null && (typeof description !== 'string' || !description.trim() || description.length > 100)) return fail('Supply a purchase-description search term of 1 to 100 characters.', 'description');
  if ((amountOperator === null) !== (amount === null) || (amountOperator !== null && (!['gt','lt','gte','lte'].includes(amountOperator) || typeof amount !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(amount)))) return fail('What dollar threshold should I use, and is it over, under, at least or at most?', 'amount');
  if (period === 'range' ? !validDate(start) || !validDate(end) || start > end : start !== null || end !== null) return fail('Please provide a valid inclusive date range using YYYY-MM-DD.', 'range');
  if (operation === 'compare' && !['month','week'].includes(period)) return fail('Comparisons support this month versus matching dates last month, or this week versus matching days last week.', 'period');
  if (operation === 'highest' ? !GROUPS.includes(groupBy) : groupBy !== null) return fail('Choose a supported highest-spending group: day, week, month, category or weekday.', 'groupBy');
  if (operation === 'projection' && (!category || period !== 'month' || description || amountOperator || day !== 'all')) return fail('Budget pace estimates require one configured category for this month, without purchase, amount or weekday filters.', 'projection_filters');
  if (operation === 'day_types' && day !== 'all') return fail('Weekday versus weekend analysis needs both groups, without a separate weekday filter.', 'day');
  if (operation !== 'average' && !(operation === 'highest' && groupBy === 'weekday') && aggregate !== 'total') return fail('That aggregation is not supported for this operation.', 'aggregate');
  if (operation === 'highest' && !['total','daily_average'].includes(aggregate)) return fail('Highest weekday supports total or daily average.', 'aggregate');
  if (operation === 'average' && aggregate === 'total') return fail('Should the average be per calendar day or per transaction?', 'aggregate');
  return { ok: true, query: { operation, period, start, end, category, description: description?.trim() ?? null, amountOperator, amount, amountCents: amount === null ? null : Math.round(Number(amount) * 100), day, groupBy, aggregate, categoryTerms: [...terms] } };
}
export function generalQuerySchema(category) {
  return { type: 'object', additionalProperties: false,
    required: ['operation','period','start','end','category','description','amountOperator','amount','day','groupBy','aggregate','category_terms'],
    properties: {
      operation: { type:'string', enum:OPERATIONS }, period:{ type:'string',enum:QUERY_PERIODS },
      start:{type:['string','null'],description:'Inclusive YYYY-MM-DD only for range'}, end:{type:['string','null']}, category,
      description:{type:['string','null'],description:'Literal description substring, not inferred merchant identity'},
      amountOperator:{type:['string','null'],enum:['gt','lt','gte','lte',null]}, amount:{type:['string','null'],description:'User threshold in dollars, at most 2 decimal places. Not a calculated figure.'},
      day:{type:'string',enum:DAY_FILTERS},groupBy:{type:['string','null'],enum:[...GROUPS,null]},aggregate:{type:'string',enum:['total','daily_average','per_transaction','calendar_week','calendar_month']},
      category_terms:{type:'array',items:{type:'string'},description:'Only category labels explicitly requested in message, never copy the context category catalog. Empty [] if no category requested. Exclude weekdays, merchants, dates and description terms. Never narrow multiple categories.'}
    } };
}
