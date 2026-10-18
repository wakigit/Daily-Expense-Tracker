import { DEF_CATS } from '../src/themes/themes';
import { buildSample, sampleTotal, isSampleRow } from '../src/lib/sampleData';
import { planLoad, planRemove, sampleLoadNeedsConfirmation } from '../src/lib/sampleState';
import { budgetStatus, decayLevel } from '../src/lib/status';
import { sumCents } from '../src/lib/money';
import { interpretOffline } from '../src/lib/queryOffline';
import { validateIntent, buildContext } from '../src/lib/intent';
import { dialogueIntent } from '../src/lib/assistantDialogue';
import { loadAll, save } from '../src/lib/storage';

export async function sampleCategoryChecks(check) {
  const labels = ['Food & Drinks','Entertainment','Daily Needs','Shopping','Public Transport','Private Hire','Others'];
  check('new defaults exact labels/order',DEF_CATS.map(c=>c.label),labels);
  check('new defaults compatible stable IDs',DEF_CATS.map(c=>c.id),['food','entertainment','needs','shop','pub','hire','misc']);
  // Hand-summed purchase prices and independently rounded expected total budgets.
  const cases=[['2026-10-01',3380,4447],['2026-10-15',29670,39039],['2026-10-31',50360,66263],['2024-02-01',3380,4447],['2024-02-15',29670,39039],['2024-02-29',50360,66263],['2025-02-01',3380,4447],['2025-02-15',29670,39039],['2025-02-28',50360,66263]];
  for (const [today,spent,budget] of cases) {
    const sample=buildSample(today), current=sample.expenses.filter(r=>r.date.startsWith(today.slice(0,7)));
    check(`sample ${today} independent spending cents`,sumCents(current),spent);
    check(`sample ${today} independent budget cents`,sumCents(Object.values(sample.budgets),v=>v),budget);
    check(`sample ${today} 75–77%`,spent*100>=budget*75&&spent*100<=budget*77,true);
    check(`sample ${today} actual healthy status/scene`,[budgetStatus(sampleTotal(current),budget/100).label,decayLevel(budgetStatus(sampleTotal(current),budget/100).key)],['On track',0]);
    check(`sample ${today} no future/invalid dates`,sample.expenses.every(r=>r.date<=today&&new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)===r.date),true);
    check(`sample ${today} actual category references`,sample.expenses.every(r=>sample.categories.some(c=>c.id===r.category)),true);
    check(`sample ${today} unique IDs`,new Set(sample.expenses.map(r=>r.id)).size,sample.expenses.length);
    check(`sample ${today} full previous-month history`,sample.expenses.filter(r=>r.date.startsWith(sample.months[0])).length,40);
  }
  for(const [spent,budget,label,decay] of [[79.99,100,'On track',0],[80,100,'Close to limit',1],[99.99,100,'Close to limit',1],[100,100,'Budget reached',1],[100.01,100,'Over budget',2],[0,0,'No budget set',0],[5,0,'No budget set',0],[0,100,'On track',0],[0.08,0.1,'Close to limit',1]]) {
    const status=budgetStatus(spent,budget);
    check(`status exact ${spent}/${budget}`,[status.label,decayLevel(status.key)],[label,decay]);
  }
  check('rounded 80% remains calm when actual ratio below',budgetStatus(79.99,100).pct===80&&budgetStatus(79.99,100).key==='calm',true);
  const full=buildSample('2026-10-31');
  for(const [description,category] of [['Notebook and pens','needs'],['Concert ticket','entertainment'],['Printing credit','needs'],['GrabFood lunch','food'],['Grab ride to campus','hire'],['MRT top up','pub'],['Unlabelled cash purchase','misc']])check(`sample mapping ${description}`,full.expenses.filter(r=>r.description===description).every(r=>r.category===category)&&full.expenses.some(r=>r.description===description),true);
  const legacy=[['food','Food'],['hire','Private hire'],['pub','Public transport'],['shop','Shopping'],['needs','Needs'],['misc','Miscellaneous']].map(([id,label])=>({id,label,color:'#123456'}));
  const personal={id:'personal',date:'2026-10-19',description:'Personal textbook',amount:900,category:'needs',notes:'preserve'};
  const originalBudgets={food:77,needs:33};
  check('empty sample shortcut needs no confirmation',sampleLoadNeedsConfirmation({expenses:[],budgets:{}}),false);
  check('budget-only shortcut requires confirmation',sampleLoadNeedsConfirmation({expenses:[],budgets:{food:400}}),true);
  check('personal records require confirmation',sampleLoadNeedsConfirmation({expenses:[personal],budgets:{}}),true);
  const original=JSON.stringify({legacy,personal,originalBudgets});
  const loaded=planLoad({expenses:[personal],budgets:originalBudgets,cats:legacy,todayYmd:'2026-10-19'});
  check('legacy categories untouched on sample load',loaded.categories.slice(0,6),legacy);
  check('legacy sample adds only missing Entertainment',loaded.mark.introducedCategories.map(c=>[c.id,c.label]),[['entertainment','Entertainment']]);
  check('personal expense unchanged',loaded.expenses[0],personal);
  check('budgets never scaled from personal spending',Object.entries(loaded.budgets).sort(),Object.entries(buildSample('2026-10-19').budgets).sort());
  check('combined status real, not forced healthy',budgetStatus(sampleTotal(loaded.expenses.filter(r=>r.date.startsWith('2026-10'))),sumCents(Object.values(loaded.budgets),v=>v)/100).label,'Over budget');
  const editedBudgets={...loaded.budgets,food:123,custom:45};delete editedBudgets.pub;
  const catsEdited=loaded.categories.map(c=>c.id==='food'?{...c,label:'My food',color:'#abcdef'}:c);
  const again=planLoad({expenses:loaded.expenses,budgets:editedBudgets,cats:catsEdited,mark:loaded.mark,todayYmd:'2026-11-01'});
  check('repeat load keeps rows/categories/budgets and original snapshot',[again.expenses,again.categories,again.budgets,again.mark],[loaded.expenses,catsEdited,editedBudgets,loaded.mark]);
  const removed=planRemove({expenses:loaded.expenses,budgets:editedBudgets,cats:catsEdited,mark:JSON.parse(JSON.stringify(loaded.mark))});
  check('remove personal row intact',removed.expenses,[personal]);
  check('remove restores unchanged budget and preserves edits/add/delete',removed.budgets,{food:123,needs:33,custom:45});
  check('pre-existing category edit preserved',removed.categories,catsEdited.filter(c=>c.id!=='entertainment'));
  check('pure lifecycle inputs not mutated',JSON.stringify({legacy,personal,originalBudgets}),original);
  const blank=planLoad({expenses:[],budgets:{},cats:[],todayYmd:'2026-10-19'});
  check('fresh empty category setup creates exact defaults',blank.categories,DEF_CATS);
  const personalEnt={...personal,id:'own-ent',category:'entertainment'};
  const renamed=blank.categories.map(c=>c.id==='misc'?{...c,label:'My other costs'}:c);
  const kept=planRemove({expenses:[...blank.expenses,personalEnt],budgets:blank.budgets,cats:renamed,mark:blank.mark});
  check('introduced used/edited categories retained only',kept.categories.map(c=>c.id),['entertainment','misc']);
  check('no dangling remaining row references',kept.expenses.every(r=>kept.categories.some(c=>c.id===r.category)),true);
  const budgetUsed=planRemove({expenses:blank.expenses,budgets:{...blank.budgets,entertainment:99},cats:blank.categories,mark:blank.mark});
  check('introduced category with edited budget retained',budgetUsed.categories.map(c=>c.id),['entertainment']);
  check('introduced budget edit retained',budgetUsed.budgets,{entertainment:99});
  const collision=[{id:'food',label:'School',color:'#123456'},{id:'custom-ent',label:'Entertainment',color:'#abcdef'},{id:'shop',label:'Gardening',color:'#111111'}];
  const collide=planLoad({expenses:[],budgets:{food:700,shop:20},cats:collision,todayYmd:'2026-10-19'});
  check('colliding existing IDs never repurposed',collide.categories.slice(0,3),collision);
  check('matching custom label reuses real ID/colour',collide.expenses.filter(r=>r.description==='Concert ticket').every(r=>r.category==='custom-ent'),true);
  check('collision-safe sample IDs created',collide.categories.some(c=>c.id==='sample-food-1'&&c.label==='Food & Drinks')&&collide.categories.some(c=>c.id==='sample-shop-1'),true);
  check('colliding custom category budgets never overwritten',[collide.budgets.food,collide.budgets.shop],[700,20]);
  const collisionRemoved=planRemove({expenses:collide.expenses,budgets:collide.budgets,cats:collide.categories,mark:collide.mark});
  check('custom budgets restored after collision-safe sample removal',collisionRemoved.budgets,{food:700,shop:20});
  const secondCollision=planLoad({expenses:[],budgets:{},cats:[...collision,{id:'sample-food-1',label:'Custom study supplies',color:'#123456'}],todayYmd:'2026-10-19'});
  check('sample fallback ID also avoids an occupied fallback',secondCollision.categories.some(c=>c.id==='sample-food-2'&&c.label==='Food & Drinks'),true);
  check('all collision fixture rows reference real categories',collide.expenses.every(r=>collide.categories.some(c=>c.id===r.category)),true);
  check('collision removal restores exact original setup',planRemove({expenses:collide.expenses,budgets:collide.budgets,cats:collide.categories,mark:collide.mark}).categories,collision);
  check('old sample load is no-op until explicit remove',planLoad({expenses:full.expenses,budgets:{old:10},cats:legacy,mark:{previousBudgets:{old:8}},todayYmd:'2026-11-01'}).budgets,{old:10});
  const old=planRemove({expenses:[...full.expenses,personal],budgets:{old:10},cats:legacy,mark:{previousBudgets:{old:8}}});
  check('old mark missing snapshot keeps budget/categories',[old.budgets,old.categories,old.expenses],[{old:10},legacy,[personal]]);
  check('missing mark never deletes user categories',planRemove({expenses:full.expenses,budgets:{},cats:legacy,mark:null}).categories,legacy);
  for(const [question,id] of [['How much did I spend on Food this month?','food'],['Food and Drinks spending this month','food'],['Public transport spending this month','pub'],['Private hire spending this month','hire']])check(`vocabulary ${question}`,interpretOffline(question,DEF_CATS).query?.category,id);
  check('generic transport asks, never narrows',dialogueIntent('Transport spending last month',DEF_CATS)?.type,'clarify');
  check('custom Transport category kept',interpretOffline('Transport spending this month',[{id:'own',label:'Transport'}]).query?.category,'own');
  const query={operation:'total',period:'month',category:'food',category_terms:['Food']};
  const validated=validateIntent({type:'analyze',query},{cats:DEF_CATS,message:'Food spending this month'});
  check('Food alias shared validation twice',validated.ok&&validateIntent(validated.intent,{cats:DEF_CATS,message:'Food spending this month'}).ok,true);
  check('Food alias cannot hide a second category',validateIntent({type:'analyze',query},{cats:DEF_CATS,message:'Food and Public Transport spending this month'}).ok,false);
  const damaged={...blank.mark};delete damaged.appliedBudgets;
  const unknown=planRemove({expenses:blank.expenses,budgets:{...blank.budgets,entertainment:99},cats:blank.categories,mark:damaged});
  check('incomplete ownership receipt never deletes categories/budgets',[unknown.categories,unknown.budgets],[blank.categories,{...blank.budgets,entertainment:99}]);
  check('context uses actual new IDs/labels',buildContext({cats:DEF_CATS,today:'2026-10-19'}).categories,DEF_CATS.map(({id,label})=>({id,label})));
  const prior=globalThis.localStorage, memory=new Map();
  globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  try {
    await save('categories',collision);await save('expenses',[personal]);await save('sampleMark',loaded.mark);
    const reloaded=await loadAll();
    check('saved category list survives storage reload exactly',reloaded.categories,collision);
    check('saved expense/mark survives storage reload',[reloaded.expenses,reloaded.sampleMark],[[personal],loaded.mark]);
  } finally {if(prior===undefined)delete globalThis.localStorage;else globalThis.localStorage=prior;}
}
