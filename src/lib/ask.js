import { answerOfflineQuery } from './queryOffline';

/** Offline reads use the same validated filter/calculation path as OpenAI intents. */
export function answer(question, { expenses = [], cats = [], today, budgets = {} } = {}) {
  return answerOfflineQuery(question, { expenses, cats, today, budgets });
}
