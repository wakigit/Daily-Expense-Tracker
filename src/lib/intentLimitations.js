import { categoryNames } from './categoryVocabulary.js';
/** Fixed semantic limitations, never exception-text matching or model-authored answers. */
export const INTENT_LIMITATION = Object.freeze({
  MULTIPLE_CATEGORIES: 'multiple_categories',
  CATEGORY_COMPARISON: 'category_comparison_unsupported',
  SCOPE_REQUIRED: 'scope_rules_required',
  SCOPE_CATEGORY_COVERAGE: 'scope_categories_incomplete',
  SCOPE_OPERATION: 'scope_operation_unsupported',
  COMPARISON_PERIOD: 'comparison_period_unsupported',
  MULTIPART_PERCENTAGE: 'multipart_percentage_unsupported',
  FINANCIAL_ASSESSMENT: 'financial_assessment_needs_scope',
});
export const isLimitationReason = reason => Object.values(INTENT_LIMITATION).includes(reason);
export function limitationClarification(reason, message = '') {
  const explanations = {
    [INTENT_LIMITATION.MULTIPLE_CATEGORIES]: 'I cannot directly combine or compare several category filters. Which single category should I use, or would you like to review explicit inclusion rules for a combined scope?',
    [INTENT_LIMITATION.CATEGORY_COMPARISON]: 'I cannot directly compare several categories in one calculation. Would you like separate totals for each category, keeping the requested periods and filters? Please name the first category.',
    [INTENT_LIMITATION.SCOPE_REQUIRED]: 'Related purchases need explicit inclusion rules before a calculation. Which purchase-description terms or categories should count? I can propose literal rules for your review and approval.',
    [INTENT_LIMITATION.SCOPE_CATEGORY_COVERAGE]: 'The proposed scope rules do not cover every named category. Which single category should I use, or should each requested category be explicitly included in rules for your review? I will not calculate a narrower selection.',
    [INTENT_LIMITATION.SCOPE_OPERATION]: 'Reviewed related-spending rules support totals, transaction counts, lists and complete category or month breakdowns. They do not support that requested comparison, average or ranking. Which supported result do you want?',
    [INTENT_LIMITATION.COMPARISON_PERIOD]: 'I cannot compare arbitrary periods in one query. Comparisons support this month against matching dates last month, or this week against matching days last week. Would you like separate totals for your requested periods instead?',
    [INTENT_LIMITATION.MULTIPART_PERCENTAGE]: 'I cannot combine a spending total with a separate category-percentage answer. Would you like the recorded total or a complete category breakdown? Keep the original subject, dates and other filters in your next question.',
    [INTENT_LIMITATION.FINANCIAL_ASSESSMENT]: 'What would you like to assess: recorded spending against a category budget, a change from a previous period, or a particular category? Please name the category and period you want. An expense ledger alone cannot establish your overall financial health.',
  };
  if (!isLimitationReason(reason)) return null;
  // This is the user's text, rendered as text by React, never a model value or an instruction.
  const request = String(message).trim();
  return { type: 'clarify', reason, question: `${explanations[reason]}${request ? ` Your original request: “${request}”` : ''}`, options: [], say: '' };
}
/** A bounded multipart family, not all requests for a category breakdown/share. */
const unquotedText = message => String(message).replace(/[“\"][^”\"]*[”\"]/g, ' ');
export const asksMultipartPercentage = message => {
  const text = unquotedText(message);
  return /\b(?:and|also)\b/i.test(text) && /\b(?:percentage|percent)\b/i.test(text) && /\b(?:spend|spent|spending|total)\b/i.test(text);
};
export const needsScopeRules = message => /\brelated\b|\bincluding\b/i.test(unquotedText(message));

export function isBroadFinancialAssessment(message) {
  const text = String(message).toLowerCase().replace(/[“"][^”"]*[”"]/g, ' ');
  if (!/\b(?:money|finances?|financially|financial|spending|budgeting)\b/.test(text)) return false;
  if (/\b(?:how much|total|transactions?|compare|compared|breakdown|break down|highest|largest)\b/.test(text)) return false;
  return /\b(?:doing|managing|handling)\b.{0,45}\b(?:well|okay|ok|badly|poorly|right|wrong)\b/.test(text)
    || /\b(?:financial health|financially healthy|financially stable)\b/.test(text)
    || /\b(?:is|are)\b.{0,35}\b(?:money|finances?|spending)\b.{0,25}\b(?:healthy|unhealthy|good|bad|on track|okay|ok)\b/.test(text)
    || /\bhow (?:am i|are my finances) doing\b/.test(text)
    || /\bhow are my finances\b/.test(text);
}

export function mentionedCategories(message, cats = []) {
  const unquoted = String(message).toLowerCase().replace(/[“\"][^”\"]*[”\"]/g, ' ');
  return cats.filter(c => categoryNames(c).some(label => {
    const escaped = label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'u').test(unquoted);
  }));
}
export function asksCategoryComparison(message, cats = []) {
  const text=unquotedText(message);
  return mentionedCategories(text,cats).length > 1 && /\b(?:compare|comparison|versus|vs)\b|\b(?:more|less)\b[^?.]*\bor\b/i.test(text);
}
export function requestLimitation(message, cats = []) {
  if (asksMultipartPercentage(message)) return INTENT_LIMITATION.MULTIPART_PERCENTAGE;
  if (asksCategoryComparison(message,cats)) return INTENT_LIMITATION.CATEGORY_COMPARISON;
  if (mentionedCategories(message,cats).length > 1) return INTENT_LIMITATION.MULTIPLE_CATEGORIES;
  if (needsScopeRules(message)) return INTENT_LIMITATION.SCOPE_REQUIRED;
  return null;
}
