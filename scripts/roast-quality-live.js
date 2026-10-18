// Final bounded pass: exactly four independent fictional requests, no retries or judging calls.
import { buildRoastInput } from '../src/lib/roastFacts';
import { requestRoast } from '../src/lib/roastClient';
const today = '2026-10-18';
const cats = [{id:'fictional-food',label:'Food'},{id:'fictional-shopping',label:'Shopping'}];
const row = (id, description, amount, date = today, category = cats[0].id) => ({id,description,amount,date,category});
const samples = [
  {label:'Admission with misleading category',row:row('final-quality-entry','Zouk entry fee',35),history:[],singapore:true,smu:true},
  {label:'Ordinary food',row:row('quality-rice','Chicken rice',5.8),history:[],singapore:true,smu:true},
  {label:'Verified repeat',row:row('quality-tea-4','Bubble tea',6.5),history:[row('quality-tea-1','Bubble tea',6.5,'2026-10-12'),row('quality-tea-2','Bubble tea',6.5,'2026-10-14'),row('quality-tea-3','Bubble tea',6.5,'2026-10-16'),row('quality-other','Chicken rice',8,'2026-10-17')],singapore:true,smu:true},
  {label:'Contexts disabled',row:row('quality-cable','Replacement charging cable',12,today,cats[1].id),history:[],singapore:false,smu:false},
];
for (const [angleIndex,sample] of samples.entries()) {
  const input=buildRoastInput(sample.row,{expenses:[...sample.history,sample.row],cats,budgets:{},today,preferences:{enabled:true,name:'',singapore:sample.singapore,smu:sample.smu},angleIndex});
  const result=await requestRoast(input,{url:'http://127.0.0.1:8787'});
  if (!result.ok) process.exitCode=1;
  console.log(JSON.stringify({sample:sample.label,fictionalPurchase:input.transaction,preferences:input.preferences,facts:input.facts,accepted:result.ok,diagnostic:result.diagnostic,...(result.ok?{text:result.text,characters:result.text.length}:{})}));
}
