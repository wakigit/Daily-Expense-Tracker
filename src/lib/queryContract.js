import { validateComparison, comparisonSchema } from './comparisonContract.js';
import { INTENT_LIMITATION } from './intentLimitations.js';
import { categoryNames } from './categoryVocabulary.js';
import { normaliseScopeText, matchesAnyCategory, matchesAnyDescription } from './filterMatching.js';
export { normaliseScopeText } from './filterMatching.js';
/** Shared, closed interpretation contract. Thresholds are inputs, never model totals. */
export const OPERATIONS = ['total', 'count', 'average', 'list', 'highest', 'compare', 'day_types', 'projection', 'largest', 'latest', 'breakdown'];
export const QUERY_PERIODS = ['today', 'yesterday', 'week', 'lastweek', 'month', 'lastmonth', 'all', 'range', 'last_days', 'year'];
export const GROUPS = ['day', 'week', 'month', 'category', 'weekday'];
export const DAY_FILTERS = ['all', 'weekday', 'weekend', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS = DAY_FILTERS.slice(3);
export const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && s >= '1900-01-01' && s <= '2200-12-31' && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export const weekday = date => WEEKDAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];
/**
 * A spendingScope object carrying no label and no rules means "no scope".
 *
 * The schema permits it — `spendingScope` is `anyOf: [null, object]` with all
 * inner arrays allowed to be empty — so a model can emit a hollow placeholder
 * instead of null. Without this, that placeholder fails validation, the whole
 * intent is refused, and an answerable question drops to the offline matcher.
 *
 * This is NOT a loosening. An all-empty scope selects and excludes nothing, so
 * discarding it cannot change which rows any query matches. The narrowness is
 * the point: a scope with a LABEL but no rules is left alone to be rejected,
 * because a label is evidence the model meant to scope something and silently
 * dropping it would turn a concept question into an unscoped total. And a
 * `propose_scope` whose scope normalises away is still refused downstream,
 * since a scope proposal with no scope is not a proposal.
 *
 * One definition, used by `validateQuery`, which both the server and the
 * browser call.
 */
export function isHollowSpendingScope(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const lists = ['includeCategories', 'includeTerms', 'excludeCategories', 'excludeTerms'];
  const labelBlank = raw.label == null || (typeof raw.label === 'string' && !raw.label.trim());
  const listsEmpty = lists.every(key => raw[key] == null || (Array.isArray(raw[key]) && raw[key].length === 0));
  const onlyKnownKeys = Object.keys(raw).every(key => key === 'label' || lists.includes(key));
  return labelBlank && listsEmpty && onlyKnownKeys;
}

export function validateSpendingScope(raw, cats = []) {
  const keys = ['label','includeCategories','includeTerms','excludeCategories','excludeTerms'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !keys.includes(k))) return {ok:false};
  if (typeof raw.label !== 'string' || !raw.label.trim() || raw.label.length > 80) return {ok:false};
  const scope = {label:raw.label.trim().replace(/\s+/g, ' ')};
  for (const key of keys.slice(1)) {
    const values = raw[key];
    if (!Array.isArray(values) || values.length > 8) return {ok:false};
    if (key.endsWith('Categories')) {
      if (values.some(id => typeof id !== 'string' || !cats.some(c => c.id === id))) return {ok:false};
      scope[key] = [...new Set(values)].sort();
    } else {
      if (values.some(term => typeof term !== 'string' || !term.trim() || term.length > 80)) return {ok:false};
      scope[key] = [...new Set(values.map(normaliseScopeText))].sort();
    }
  }
  if (!scope.includeCategories.length && !scope.includeTerms.length) return {ok:false};
  return {ok:true,scope};
}
export function spendingScopeMatches(row, scope) {
  const match = (categories, terms) => matchesAnyCategory(row, categories) || matchesAnyDescription(row, terms);
  return match(scope.includeCategories, scope.includeTerms) && !match(scope.excludeCategories, scope.excludeTerms);
}
export function matchingRows(expenses, scope) {
  const rows = expenses.filter(row => rowMatches(row, scope));
  return scope.deduplicate || scope.spendingScope || scope.categories?.length || scope.descriptionTerms?.length ? [...new Map(rows.map(row => [row.id, row])).values()] : rows;
}
export function rowMatches(row, scope = {}) {
  if ((scope.start && row.date < scope.start) || (scope.end && row.date > scope.end)) return false;
  if (scope.category && row.category !== scope.category) return false;
  if (scope.description && !(row.description ?? '').toLocaleLowerCase('en-SG').includes(scope.description.toLocaleLowerCase('en-SG'))) return false;
  if (scope.categories?.length && !matchesAnyCategory(row, scope.categories)) return false;
  if (scope.descriptionTerms?.length && !matchesAnyDescription(row, scope.descriptionTerms)) return false;
  if (scope.spendingScope && !spendingScopeMatches(row, scope.spendingScope)) return false;
  const day = weekday(row.date);
  if (scope.day && scope.day !== 'all' && (scope.day === 'weekday' ? ['Saturday','Sunday'].includes(day) : scope.day === 'weekend' ? !['Saturday','Sunday'].includes(day) : day !== scope.day)) return false;
  if (scope.amountOperator) {
    const cents = Math.round(Number(row.amount) * 100 + 1e-9), value = scope.amountCents;
    if (!({ gt: cents > value, lt: cents < value, gte: cents >= value, lte: cents <= value })[scope.amountOperator]) return false;
  }
  return true;
}
export function validateQuery(raw, cats = []) {
  const fail = (question, field='structure', limitation=null) => ({ ok: false, question, field, ...(limitation ? {limitation} : {}) });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Please specify a supported spending question.');
  const allowed = ['operation','period','start','end','category','description','amountOperator','amount','day','groupBy','aggregate','category_terms','categoryTerms','dayCount','amountCents','spendingScope','categories','descriptionTerms','comparison'];
  if (Object.keys(raw).some(k => !allowed.includes(k))) return fail('The query contains unsupported fields.');
  const { operation, period = 'month', category = null, description = null, amountOperator = null, amount = null, day = 'all', groupBy = null, aggregate = 'total', start = null, end = null, dayCount = null } = raw;
  if (!OPERATIONS.includes(operation) || !QUERY_PERIODS.includes(period) || !DAY_FILTERS.includes(day) || !['total','daily_average','per_transaction','calendar_week','calendar_month'].includes(aggregate)) return fail('Choose a supported operation, period and grouping.', !OPERATIONS.includes(operation)?'operation':!QUERY_PERIODS.includes(period)?'period':!DAY_FILTERS.includes(day)?'day':'aggregate');
  if (category !== null && !cats.some(c => c.id === category)) return fail('Which of your configured categories do you mean?', 'category');
  const categories = raw.categories === undefined ? [] : raw.categories, descriptionTerms = raw.descriptionTerms === undefined ? [] : raw.descriptionTerms;
  if (!Array.isArray(categories) || categories.length > 8 || categories.some(id => typeof id !== 'string' || !cats.some(c => c.id === id))) return fail('Use at most eight configured category IDs, without unknown categories.', 'categories');
  if (!Array.isArray(descriptionTerms) || descriptionTerms.length > 8 || descriptionTerms.some(term => typeof term !== 'string' || !term.trim() || term.length > 80)) return fail('Use at most eight non-empty literal description terms, each at most 80 characters.', 'descriptionTerms');
  if (category !== null && categories.length) return fail('Use either a single category or a category list, not both.', 'categories');
  if (description !== null && descriptionTerms.length) return fail('Use either a single description term or a description-term list, not both.', 'descriptionTerms');
  const compared=validateComparison(raw.comparison,{cats,periods:QUERY_PERIODS,validDate});
  if(!compared.ok)return fail('A comparison needs exactly two valid periods or two distinct configured categories, without extra side fields.', 'comparison');
  const comparison=compared.comparison;
  if(comparison&&operation!=='compare')return fail('Comparison sides require the compare operation.', 'comparison');
  if(comparison?.kind==='periods'&&(period!=='all'||start!==null||end!==null||dayCount!==null))return fail('Put the two requested periods only in comparison.periods; root period must be all.', 'comparison');
  if(comparison?.kind==='categories'&&(category!==null||categories.length))return fail('Put the two category sides only in comparison.categories.', 'comparison');
  const hasOr = categories.length > 0 || descriptionTerms.length > 0;
  const reviewed = raw.spendingScope == null || isHollowSpendingScope(raw.spendingScope) ? {ok:true,scope:null} : validateSpendingScope(raw.spendingScope,cats);
  if (!reviewed.ok) return fail('Review the spending scope: include at least one rule, use valid categories and at most eight terms or categories per list.', 'spendingScope');
  const terms = raw.category_terms ?? raw.categoryTerms ?? [];
  if (!Array.isArray(terms) || terms.some(x => typeof x !== 'string')) return fail('Please name one category.', 'category_terms');
  if (terms.length > 8 || terms.some(term => !term.trim() || term.length > 80)) return fail('Use bounded, non-empty category labels.', 'category_terms');
  if (raw.category_terms && raw.categoryTerms && JSON.stringify(raw.category_terms) !== JSON.stringify(raw.categoryTerms)) return fail('Conflicting category labels.', 'category_terms');
  if (!reviewed.scope && terms.length === 1 && !category && !categories.length && comparison?.kind!=='categories') return fail(`I could not match “${terms[0]}” to a category. Please resubmit using your category label, or explicitly ask for descriptions mentioning that term.`, 'category_terms');
  if (description !== null && (typeof description !== 'string' || !description.trim() || description.length > 100)) return fail('Supply a purchase-description search term of 1 to 100 characters.', 'description');
  if ((amountOperator === null) !== (amount === null) || (amountOperator !== null && (!['gt','lt','gte','lte'].includes(amountOperator) || typeof amount !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(amount)))) return fail('What dollar threshold should I use, and is it over, under, at least or at most?', 'amount');
  if (period === 'range' ? !validDate(start) || !validDate(end) || start > end : start !== null || end !== null) return fail('Please provide a valid inclusive date range using YYYY-MM-DD.', 'range');
  if (period === 'last_days' ? !Number.isInteger(dayCount) || dayCount < 1 || dayCount > 3660 : dayCount !== null) return fail('Last N days requires a whole number from 1 to 3660; other periods must not include a day count.', 'dayCount');
  if (operation === 'highest' ? !GROUPS.includes(groupBy) : operation === 'breakdown' ? !['category','month'].includes(groupBy) : groupBy !== null) return fail('Choose category or month for a complete breakdown, or a supported highest-spending group.', 'groupBy');
  if (operation === 'projection' && !hasOr && (!category || period !== 'month' || description || amountOperator || day !== 'all')) return fail('Budget pace estimates require one configured category for this month, without purchase, amount or weekday filters.', 'projection_filters');
  if (operation === 'day_types' && day !== 'all') return fail('Weekday versus weekend analysis needs both groups, without a separate weekday filter.', 'day');
  if (operation !== 'average' && !(operation === 'highest' && groupBy === 'weekday') && aggregate !== 'total') return fail('That aggregation is not supported for this operation.', 'aggregate');
  if (operation === 'highest' && !['total','daily_average'].includes(aggregate)) return fail('Highest weekday supports total or daily average.', 'aggregate');
  if (operation === 'average' && aggregate === 'total') return fail('Should the average be per calendar day or per transaction?', 'aggregate');
  // Only after every structural/type/date/filter check has passed can a known
  // semantic limitation be distinguished from malformed output. No query executes.
  if (comparison?.kind==='categories' && terms.some(term=>!cats.some(c=>comparison.categories.includes(c.id)&&categoryNames(c).some(name=>normaliseScopeText(name)===normaliseScopeText(term)))))return fail('All category words must match the two configured comparison sides.', 'category_terms',INTENT_LIMITATION.FILTER_COVERAGE);
  if (reviewed.scope && terms.some(term => !cats.some(c => [...reviewed.scope.includeCategories,...reviewed.scope.excludeCategories,...categories,category].includes(c.id) && categoryNames(c).some(name=>normaliseScopeText(name)===normaliseScopeText(term))))) return fail('Named categories must be represented by valid reviewed rules or the separate category filter.', 'category_terms', INTENT_LIMITATION.SCOPE_CATEGORY_COVERAGE);
  if (!reviewed.scope && terms.length && categories.length && terms.some(term => !cats.some(c => categories.includes(c.id) && categoryNames(c).some(name => normaliseScopeText(name) === normaliseScopeText(term))))) return fail('Every requested category must be represented by an explicit configured filter.', 'category_terms', INTENT_LIMITATION.FILTER_COVERAGE);
  if (!reviewed.scope && terms.length > 1 && !categories.length && comparison?.kind!=='categories') {
    return fail('I support one category per query.', 'category_terms', INTENT_LIMITATION.MULTIPLE_CATEGORIES);
  }
  if (hasOr && operation==='projection') return fail('Explicit unions support recorded totals, counts, averages, lists, breakdowns and winners. Ask a separate scoped total instead of this budget or comparison operation.', 'operation', INTENT_LIMITATION.OR_OPERATION);
  if (reviewed.scope && !['total','count','list','breakdown'].includes(operation)) return fail('Reviewed scopes support totals, counts, lists and complete category/month breakdowns.', 'spendingScope', INTENT_LIMITATION.SCOPE_OPERATION);
  if (operation === 'compare' && !comparison && !['month','week'].includes(period)) return fail('Comparisons support this month versus matching dates last month, or this week versus matching days last week.', 'period', INTENT_LIMITATION.COMPARISON_PERIOD);
  return { ok: true, query: { operation, period, start, end, dayCount, category, description: description?.trim() ?? null, amountOperator, amount, amountCents: amount === null ? null : Math.round(Number(amount) * 100), day, groupBy, aggregate, comparison, categoryTerms: [...terms], categories: [...new Set(categories)].sort(), descriptionTerms: [...new Set(descriptionTerms.map(normaliseScopeText))].sort(), spendingScope: reviewed.scope } };
}
export function generalQuerySchema(category) {
  return { type: 'object', additionalProperties: false,
    required: ['operation','period','start','end','category','description','amountOperator','amount','day','groupBy','aggregate','category_terms','dayCount','spendingScope','categories','descriptionTerms','comparison'],
    properties: {
      operation: { type:'string', enum:OPERATIONS, description:'Use breakdown for complete category or month subtotals, including a total plus a question about which categories purchases fall into. highest selects only winners; total does not group.' }, period:{ type:'string',enum:QUERY_PERIODS },
      dayCount:{type:['integer','null'],minimum:1,maximum:3660,description:'Only for last_days: inclusive number of calendar dates ending today; otherwise null'},
      start:{type:['string','null'],description:'Inclusive YYYY-MM-DD only for range'}, end:{type:['string','null']}, category,
      comparison:comparisonSchema(category,QUERY_PERIODS),
      categories:{type:'array',maxItems:8,items:{type:'string',...((category.enum??[]).some(id=>id!==null)?{enum:(category.enum??[]).filter(id=>id!==null)}:{})},description:'Explicit requested category union. OR within this list, AND with description/date/day/amount filters. Use category null when nonempty. Never infer broad related-spending rules.'},
      descriptionTerms:{type:'array',maxItems:8,items:{type:'string',minLength:1,maxLength:80},description:'Explicit literal description union. OR within this list, AND with categories/date/day/amount. Use description null when nonempty. Not merchant identity, aliases or regex.'},
      description:{type:['string','null'],description:'Literal description substring, not inferred merchant identity'},
      amountOperator:{type:['string','null'],enum:['gt','lt','gte','lte',null]}, amount:{type:['string','null'],description:'User threshold in dollars, at most 2 decimal places. Not a calculated figure.'},
      day:{type:'string',enum:DAY_FILTERS},groupBy:{type:['string','null'],enum:[...GROUPS,null],description:'Required category or month for breakdown. For highest use its requested group. Null for every other operation.'},aggregate:{type:'string',enum:['total','daily_average','per_transaction','calendar_week','calendar_month']},
      spendingScope:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['label','includeCategories','includeTerms','excludeCategories','excludeTerms'],properties:{
        label:{type:'string'},
        includeCategories:{type:'array',maxItems:8,items:{type:'string',...((category.enum??[]).some(id=>id!==null)?{enum:(category.enum??[]).filter(id=>id!==null)}:{})}},
        includeTerms:{type:'array',maxItems:8,items:{type:'string'}},
        excludeCategories:{type:'array',maxItems:8,items:{type:'string',...((category.enum??[]).some(id=>id!==null)?{enum:(category.enum??[]).filter(id=>id!==null)}:{})}},
        excludeTerms:{type:'array',maxItems:8,items:{type:'string'}}
      }}],description:'Only a proposed related-spending scope, never approved by the model; otherwise null'},
      category_terms:{type:'array',items:{type:'string'},description:'Only category labels explicitly requested in message, never copy the context category catalog. Empty [] if no category requested. Exclude weekdays, merchants, dates and description terms. Never narrow multiple categories.'}
    } };
}

/** Enforce mutually exclusive representations during decoding, not only afterwards.
 * Shared validation stays strict. Each variant has the same canonical fields.
 */
export function providerQuerySchemas(category){
  const base=generalQuerySchema(category),comparison=base.properties.comparison.anyOf;
  const variants=[];
  for(const kind of ['legacy','periods','categories']){
    for(const listCategory of (kind==='categories'?[false]:[false,true]))for(const listDescription of [false,true]){
      const schema=JSON.parse(JSON.stringify(base));
      const p=schema.properties;
      if(listCategory)p.category={type:'null'};
      else p.categories={...p.categories,maxItems:0};
      if(listDescription)p.description={type:'null'};
      else p.descriptionTerms={...p.descriptionTerms,maxItems:0};
      if(kind==='legacy')p.comparison={type:'null',description:'Non-comparison read OR legacy current/previous matching-elapsed compare. For elapsed compare root period is month or week, with all shared filters retained.'};
      else{
        p.operation={type:'string',enum:['compare']};p.spendingScope={type:'null'};
        p.comparison={...comparison.find(x=>x.properties?.kind.enum[0]===kind),description:kind==='periods'?'Two explicit periods, with identical root filters. Not ordinary elapsed current/previous comparisons.':'Two configured category sides over the root requested common period. Never description terms.'};
        if(kind==='periods'){
          p.period={type:'string',enum:['all'],description:'Neutral root only: both actual date ranges live in comparison.periods.'};for(const key of ['start','end','dayCount'])p[key]={type:'null'};
        }else{p.category={type:'null'};p.period={...p.period,description:'The requested common period for BOTH category sides. This month = month, this week = week. Never all unless all time was requested.'};}
        p.groupBy={type:'null'};p.aggregate={type:'string',enum:['total']};
      }
      // Decode the kind before its dependent root period and filters. No field
      // is removed and the shared validator remains the final authority.
      schema.properties={operation:p.operation,comparison:p.comparison,...Object.fromEntries(Object.entries(p).filter(([key])=>!['operation','comparison'].includes(key)))};
      variants.push(schema);
    }
  }
  return variants;
}
