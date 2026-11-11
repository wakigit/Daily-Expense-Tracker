import {validateIntent} from '../src/lib/intent';
import {validateQuery} from '../src/lib/queryContract';
import {executeQuery} from '../src/lib/queryEngine';
import {validatePlan,canonicalPlanQuery,planQuery} from '../src/lib/planContract';
import {auditPlanRequest} from '../src/lib/planRequest';
import {normaliseWholeLedgerCategories,coversEveryConfiguredCategory} from '../src/lib/categoryCoverage';
import {limitationClarification,INTENT_LIMITATION} from '../src/lib/intentLimitations';
import {sumCents} from '../src/lib/money';

/**
 * The 2026-11-11 P2 regression: "Which weekday do I spend most on?" answered at
 * `6cf9345` and was refused at `eaab1a5` because the model expressed "across
 * all categories" as `categories: [every configured id]` and the coverage guard
 * read that as a narrowing. Measured, not assumed — see the gate doc §11.9/§12.
 *
 * MAIN --mock cannot catch this class of bug: it replays RECORDED intents, and
 * the recorded M23 intent predates the `categories` field entirely. These run
 * against the live validator with the model shape actually captured.
 */
const CATS=[
  {id:'food',label:'Food & Drinks',color:'#D85A30'},
  {id:'entertainment',label:'Entertainment',color:'#D4537E'},
  {id:'needs',label:'Daily Needs',color:'#BA7517'},
  {id:'shop',label:'Shopping',color:'#7F77DD'},
  {id:'pub',label:'Public Transport',color:'#378ADD'},
  {id:'hire',label:'Private Hire',color:'#1D9E75'},
  {id:'misc',label:'Others',color:'#888780'},
];
const ALL_IDS=CATS.map(c=>c.id), ALL_LABELS=CATS.map(c=>c.label);
const TODAY='2026-11-11';
const P2='Which weekday do I spend most on?';
const NAMED='Which weekday do I spend most on Food & Drinks?';
const rank=patch=>({operation:'highest',groupBy:'weekday',aggregate:'total',period:'all',...patch});
const intent=(query,message)=>validateIntent({type:'analyze',query,say:''},{cats:CATS,message,today:TODAY});

export function categoryCoverageChecks(check){
  /* 1. The identity case. The exact raw query captured live from the model on
        2026-11-11 (G2a) must now reach an executable weekday ranking. */
  const captured=rank({comparison:null,dayCount:null,start:null,end:null,category:null,
    categories:[...ALL_IDS],descriptionTerms:[],description:null,amountOperator:null,amount:null,
    day:'all',spendingScope:null,category_terms:[...ALL_LABELS]});
  const identity=intent(captured,P2);
  check('coverage identity: captured G2a intent answers',identity.ok&&identity.intent.type,'analyze');
  check('coverage identity: category filter removed',identity.intent.query.categories,[]);
  check('coverage identity: stale labels removed',identity.intent.query.categoryTerms,[]);
  check('coverage identity: ranking preserved',
    [identity.intent.query.operation,identity.intent.query.groupBy,identity.intent.query.aggregate,identity.intent.query.period],
    ['highest','weekday','total','all']);

  /* 2. The guard still bites. Each of these is a real claim about a real
        request, and none of them may be normalised away. */
  const partial=intent(rank({categories:['food'],category_terms:['Food & Drinks']}),P2);
  check('guard: partial list on an unnamed question still refuses',partial.intent.type,'clarify');
  check('guard: partial list reason',partial.intent.reason,INTENT_LIMITATION.CATEGORY_COVERAGE);
  const namedAll=intent(rank({categories:[...ALL_IDS],category_terms:[...ALL_LABELS]}),NAMED);
  check('guard: all-categories while ONE is named still refuses',namedAll.intent.type,'clarify');
  check('guard: all-categories while named reason',namedAll.intent.reason,INTENT_LIMITATION.CATEGORY_COVERAGE);
  const wrongOne=intent(rank({categories:['shop'],category_terms:['Shopping']}),NAMED);
  check('guard: a DIFFERENT category than the one named still refuses',wrongOne.intent.type,'clarify');
  const invented=intent(rank({descriptionTerms:['dining']}),P2);
  check('guard: invented description term still refuses',invented.intent.type,'clarify');
  check('guard: invented description term reason',invented.intent.reason,INTENT_LIMITATION.DESCRIPTION_COVERAGE);
  // There is no "every description" identity, so descriptionTerms is never normalised.
  check('guard: descriptionTerms never normalised',
    normaliseWholeLedgerCategories({categories:[...ALL_IDS],category_terms:[],descriptionTerms:['dining']},CATS,P2).descriptionTerms,['dining']);
  // An invented category WORD is not a faithful description of "all of them".
  check('guard: unmappable category_terms blocks normalisation',
    normaliseWholeLedgerCategories({categories:[...ALL_IDS],category_terms:['Groceries']},CATS,P2).categories,[...ALL_IDS]);
  check('coversEveryConfiguredCategory needs every id',
    [coversEveryConfiguredCategory({categories:ALL_IDS},CATS),coversEveryConfiguredCategory({categories:ALL_IDS.slice(1)},CATS),
     coversEveryConfiguredCategory({categories:[]},CATS)],[true,false,false]);

  /* 3. Scalar vs list. NOT an equivalence: a scalar `category` the user never
        named has NO coverage guard at all, and silently narrows. That gap
        predates the `categories` field and this change does not close it.
        Pinned here so it is visible rather than discovered again later. */
  const scalar=intent(rank({category:'food'}),P2);
  const list=intent(rank({categories:['food'],category_terms:['Food & Drinks']}),P2);
  check('known gap: scalar category on an unnamed question is NOT guarded',scalar.intent.type,'analyze');
  check('known gap: the one-element list IS guarded',list.intent.type,'clarify');
  check('known gap: and they therefore disagree',scalar.intent.type===list.intent.type,false);

  /* 4. Orphan rows. Clearing the list BROADENS: a row whose category was
        deleted is excluded by the literal all-ids filter and included with no
        filter, so the normalised result is a strict superset. */
  const expenses=[
    {id:'o1',date:'2026-11-02',category:'food',description:'Chicken rice',amount:6.5,notes:''},
    {id:'o2',date:'2026-11-07',category:'food',description:'Brunch',amount:18,notes:''},
    {id:'o3',date:'2026-11-10',category:'deleted-cat',description:'Orphan row',amount:4.25,notes:''},
  ];
  const ctx={cats:CATS,expenses,today:TODAY,budgets:{}};
  const literal=validateQuery(rank({operation:'total',groupBy:null,categories:[...ALL_IDS],category_terms:[...ALL_LABELS]}),CATS);
  const cleared=validateQuery(rank({operation:'total',groupBy:null}),CATS);
  const literalRows=executeQuery(literal.query,ctx).evidence.rows.map(r=>r.id).sort();
  const clearedRows=executeQuery(cleared.query,ctx).evidence.rows.map(r=>r.id).sort();
  check('orphan: literal all-ids filter EXCLUDES the orphan row',literalRows,['o1','o2']);
  check('orphan: cleared filter INCLUDES it',clearedRows,['o1','o2','o3']);
  check('orphan: normalised is a superset, never a narrowing',
    literalRows.every(id=>clearedRows.includes(id)),true);
  check('orphan: and the figure grows rather than shrinks',
    sumCents(executeQuery(cleared.query,ctx).evidence.rows)>=sumCents(executeQuery(literal.query,ctx).evidence.rows),true);

  /* 5. Plan steps carry `categories` too, so they get the identical step. */
  const step=patch=>planQuery({period:'month',...patch});
  const planAllCats=canonicalPlanQuery(step({categories:[...ALL_IDS],category_terms:[...ALL_LABELS]}),CATS,P2);
  check('plan step: all categories, none named -> filter removed',planAllCats.ok&&planAllCats.query.categories,[]);
  check('plan step: and its labels go with it',planAllCats.query.category_terms,[]);
  const planNamed=canonicalPlanQuery(step({categories:[...ALL_IDS],category_terms:[...ALL_LABELS]}),CATS,NAMED);
  check('plan step: all categories while ONE is named -> filter kept',planNamed.ok&&planNamed.query.categories,[...ALL_IDS].sort());
  const twoStep={version:1,
    steps:[{id:'q1',query:step({categories:[...ALL_IDS],category_terms:[...ALL_LABELS]})},
           {id:'q2',query:step({category:'food',category_terms:['Food & Drinks']})}],
    derived:[{id:'d1',operation:'percent_of',numerator:{step:'q2',field:'totalCents'},denominator:{step:'q1',field:'totalCents'}}]};
  const planned=validatePlan(twoStep,{cats:CATS,today:TODAY,expenses,message:P2});
  check('plan: an all-categories denominator validates when nothing is named',planned.ok,true);
  check('plan: the denominator became the unfiltered ledger',planned.ok&&planned.plan.steps[0].query.categories,[]);
  const FOOD_PLAN_REQUEST='What did I spend this month, and what percentage was Food & Drinks?';
  const plannedNamed=validatePlan(twoStep,{cats:CATS,today:TODAY,expenses,message:FOOD_PLAN_REQUEST});
  check('plan: naming a category keeps the all-categories filter on the step',
    plannedNamed.ok&&plannedNamed.plan.steps[0].query.categories,[...ALL_IDS].sort());
  // And the request audit is what turns that kept filter into a refusal.
  check('plan: the audit refuses the kept filter against a named request',
    plannedNamed.ok&&auditPlanRequest(plannedNamed.plan,{cats:CATS,message:FOOD_PLAN_REQUEST,today:TODAY}).ok,false);
  const auditedClean=validatePlan({...twoStep,steps:[{id:'q1',query:step({})},twoStep.steps[1]]},
    {cats:CATS,today:TODAY,expenses,message:FOOD_PLAN_REQUEST});
  check('plan: the same shape with no invented filter passes the audit',
    auditedClean.ok&&auditPlanRequest(auditedClean.plan,{cats:CATS,message:FOOD_PLAN_REQUEST,today:TODAY}).ok,true);

  /* 6. The MAIN --mock blind spot, asserted rather than described. A recorded
        intent with no `categories` key cannot exercise the branch at all, which
        is exactly why a green mock run was not evidence here. */
  const recordedM23={operation:'highest',period:'all',start:null,end:null,dayCount:null,category:null,
    description:null,amountOperator:null,amount:null,day:'all',groupBy:'weekday',aggregate:'daily_average',
    categoryTerms:[],spendingScope:null};
  check('mock blind spot: the recorded M23 shape has no categories key',
    Object.prototype.hasOwnProperty.call(recordedM23,'categories'),false);
  check('mock blind spot: so it answers both before and after this change',
    intent(recordedM23,'Which weekday has my highest average spending?').intent.type,'analyze');

  /* 7. §0 treatment for the two new strings: byte-identical questions, and a
        no-leak table over hostile input. */
  for(const reason of [INTENT_LIMITATION.CATEGORY_COVERAGE,INTENT_LIMITATION.DESCRIPTION_COVERAGE]){
    const built=limitationClarification(reason,P2);
    check(`wording ${reason}: key set is exactly the clarify envelope`,
      Object.keys(built).sort(),['options','question','reason','say','type']);
    check(`wording ${reason}: question is byte-identical when rebuilt`,
      intent(reason===INTENT_LIMITATION.CATEGORY_COVERAGE?rank({categories:['food'],category_terms:['Food & Drinks']}):rank({descriptionTerms:['dining']}),P2).intent.question,
      built.question);
    check(`wording ${reason}: quotes the user's whole request back`,
      built.question.includes(`Your original request: “${P2}”`),true);
    check(`wording ${reason}: names no category of its own`,
      ALL_LABELS.some(l=>built.question.includes(l)),false);
    check(`wording ${reason}: carries no figure`,/[0-9]/.test(built.question.replace(P2,'')),false);
  }
  // The old OR-coverage text is kept for the case it was written for.
  check('wording: unresolved coordination still gets the OR-coverage text',
    intent(rank({operation:'total',groupBy:null,category:'food'}),'How much did I spend on Food & Drinks and supper?').intent.reason,
    INTENT_LIMITATION.FILTER_COVERAGE);
  check('pinned defect: a null message renders as the word “null” (pre-existing, every limitation)',
    limitationClarification(INTENT_LIMITATION.CATEGORY_COVERAGE,null).question.endsWith('Your original request: “null”'),true);
  /* No-leak table. Echoing the user's OWN request is the design; what must
     hold is that nothing else is ever interpolated, whatever arrives. */
  const hostile=['__proto__',' ','Chicken rice','Food & Drinks','6.50',['array'],null,undefined,{},0];
  for(const reason of [INTENT_LIMITATION.CATEGORY_COVERAGE,INTENT_LIMITATION.DESCRIPTION_COVERAGE]){
    const explanation=limitationClarification(reason,'').question;
    check(`no-leak ${reason}: bare explanation carries no digit`,/[0-9]/.test(explanation),false);
    for(const value of hostile){
      const q=limitationClarification(reason,value);
      /* Mirrors limitationClarification exactly. NOTE the pinned defect: its
         default parameter only catches `undefined`, so a null message reaches
         the user as the literal word “null”. Pre-existing, shared by every
         limitation string, and pinned below rather than fixed here. */
      const request=value===undefined?'':String(value).trim();
      check(`no-leak ${reason} ${JSON.stringify(value)}: exactly explanation plus the quoted request`,
        q.question,`${explanation}${request?` Your original request: “${request}”`:''}`);
      check(`no-leak ${reason} ${JSON.stringify(value)}: reason is the fixed code`,q.reason,reason);
      check(`no-leak ${reason} ${JSON.stringify(value)}: key set unchanged`,
        Object.keys(q).sort(),['options','question','reason','say','type']);
    }
  }
}
