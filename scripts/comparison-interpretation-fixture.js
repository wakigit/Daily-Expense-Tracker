/** Independent repair acceptance data. No MAIN values or real ledger data. */
export const REPAIR_CATS=[{id:'music-r',label:'Music bench',color:'#D85A30'},{id:'trail-r',label:'Trail gear',color:'#378ADD'},{id:'home-r',label:'Household',color:'#1D9E75'}];
const row=(id,date,category,description,amount)=>({id,date,category,description,amount,notes:''});
export const REPAIR_ROWS=[
 row('r1','2026-07-03','music-r','SwiftShuttle',30.12),row('r2','2026-07-26','music-r','AmberRide',9.88),
 row('r3','2026-09-02','music-r','SwiftShuttle',64.32),row('r4','2026-09-30','music-r','AmberRide',5.68),
 row('r5','2026-09-10','trail-r','AmberRide',11.11),row('r6','2026-09-15','home-r','SwiftShuttle AmberRide',2.22),
 row('r7','2026-10-01','music-r','SwiftShuttle',18.19),row('r8','2026-10-05','trail-r','AmberRide',43.21),
 row('r9','2026-10-12','music-r','SwiftShuttle AmberRide',7.81),row('r10','2026-10-18','home-r','Soap',6.54),
 row('r11','2026-07-05','trail-r','Unrelated',83.17)
];
export const repairContext=()=>({cats:structuredClone(REPAIR_CATS),expenses:structuredClone(REPAIR_ROWS),today:'2026-10-20',budgets:{}});
const side=month=>({period:'named_month',month,start:null,end:null,dayCount:null});
export const REPAIR_CASES=[
 {family:'named-periods',message:'Compare Music bench spending in September with July.',query:{operation:'compare',period:'all',category:'music-r',category_terms:['Music bench'],comparison:{kind:'periods',periods:[side('2026-09'),side('2026-07')],categories:[]}},expected:{kind:'periods',ranges:[['2026-09-01','2026-09-30'],['2026-07-01','2026-07-31']],totals:[7000,4000],counts:[2,2],difference:3000,ids:[['r3','r4'],['r1','r2']]}},
 {family:'category-sides',message:'Did I spend more on Music bench or Trail gear this month?',query:{operation:'compare',period:'month',category_terms:['Music bench','Trail gear'],comparison:{kind:'categories',periods:[],categories:['music-r','trail-r']}},expected:{kind:'categories',ranges:[['2026-10-01','2026-10-20'],['2026-10-01','2026-10-20']],totals:[2600,4321],counts:[2,1],difference:-1721,ids:[['r7','r9'],['r8']]}},
 {family:'description-or-elapsed',message:'Compare descriptions mentioning SwiftShuttle or AmberRide this month with last month.',query:{operation:'compare',period:'month',descriptionTerms:['SwiftShuttle','AmberRide']},expected:{kind:null,ranges:[['2026-10-01','2026-10-20'],['2026-09-01','2026-09-20']],totals:[6921,7765],counts:[3,3],difference:-844,ids:[['r7','r8','r9'],['r3','r5','r6']]}}
];
