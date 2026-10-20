/** Step4A's independent oracle fixture. No MAIN data or application expectations. */
import { planQuery,planRef } from '../src/lib/planContract.js';
export const PLAN_CATS=[{id:'meal-p',label:'Food & Drinks'},{id:'transit-p',label:'Transit'},{id:'material-p',label:'Materials'}];
const row=(id,date,category,description,amount)=>({id,date,category,description,amount,notes:''});
export const PLAN_ROWS=[
  row('p1','2027-03-02','meal-p','Orchard lunch',10),
  row('p2','2027-03-05','transit-p','Shuttle card',12),
  row('p3','2027-03-09','material-p','Amazon notebook',18),
  row('p4','2027-02-02','meal-p','Earlier lunch',9),
  row('p5','2027-02-05','transit-p','Earlier pass',6),
  row('p6','2027-02-09','material-p','Earlier paper',15),
];
export const planContext=()=>({cats:structuredClone(PLAN_CATS),expenses:structuredClone(PLAN_ROWS),today:'2027-03-10'});
export const sharePlan=(period={},part={category:'meal-p',category_terms:['Food & Drinks']})=>({version:1,
  steps:[{id:'q1',query:planQuery(period)},{id:'q2',query:planQuery({...period,...part})}],
  derived:[{id:'d1',operation:'percent_of',numerator:planRef('q2'),denominator:planRef('q1')}]});
export const differencePlan=()=>({...sharePlan({}, {category:'transit-p',category_terms:['Transit']}),
  derived:[{id:'d1',operation:'difference',left:planRef('q1'),right:planRef('q2')}]});
export const FOOD_REQUEST='What did I spend this month, and what percentage was Food & Drinks?';
export const DIFFERENCE_REQUEST='Show my total spending and my Transit spending, then the difference.';
export const LITERAL_REQUEST='What share of last 90 days spending was at Amazon?';
