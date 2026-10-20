/** Fictional mock responses only. No SDK, credentials, transport or ledger access. */
import { recognizePlanRequest } from '../../src/lib/planRequest.js';
import { planQuery } from '../../src/lib/planContract.js';
export const wrapPlan = plan => ({type:'plan',plan,say:null,query:null,expense:null,filter:null,scope:null,question:null,options:null});
export function mockPlanIntent(message,context) {
  const request=recognizePlanRequest(message,{cats:context.categories,today:context.today});
  if(request.recognized) return request.ok ? wrapPlan(request.plan)
    : {type:'clarify',question:'Please specify supported totals and a share or ordered difference over one common period.',options:[]};
  if(message==='Total Food and Transit spending this month.')return {type:'analyze',query:planQuery({categories:['meal-p','transit-p'],category_terms:['Food & Drinks','Transit']})};
  if(message==='Compare spending this month with last month.')return {type:'analyze',query:planQuery({operation:'compare'})};
  if(message==='Total spending this month.')return {type:'analyze',query:planQuery()};
  if(message==='How much did I spend on study-related purchases including paper and ink this month?')return {type:'propose_scope',query:planQuery({spendingScope:{label:'Study-related purchases',includeTerms:['paper','ink'],includeCategories:[],excludeTerms:[],excludeCategories:[]}})};
  throw Object.assign(new Error('Unregistered mock request. Real provider is disabled.'),{code:'mock_unregistered',status:503});
}
