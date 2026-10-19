/** Entirely fictional, independent of MAIN and earlier OR regression values. */
export const COMPARISON_CATS=[{id:'art-v',label:'Art lab',color:'#D85A30'},{id:'cycle-v',label:'Cycle club',color:'#378ADD'},{id:'pantry-v',label:'Pantry',color:'#1D9E75'}];
const r=(id,date,category,description,amount)=>({id,date,category,description,amount,notes:''});
export const COMPARISON_ROWS=[
 r('v1','2026-07-01','art-v','MetroFox',13.17),r('v2','2026-07-15','art-v','CloudCab',6.83),
 r('v3','2026-09-01','art-v','MetroFox',29.41),r('v4','2026-09-30','art-v','CloudCab',10.59),r('v5','2026-09-05','cycle-v','MetroFox',7.25),
 r('v6','2026-10-01','art-v','MetroFox',11.11),r('v7','2026-10-05','cycle-v','CloudCab',22.22),r('v8','2026-10-20','art-v','MetroFox CloudCab',3.33),
 r('v9','2026-01-01','art-v','MetroFox',4.44),r('v10','2026-01-15','art-v','CloudCab',5.56),r('v11','2026-01-16','art-v','MetroFox',90),
 r('v12','2026-02-01','art-v','MetroFox',1.23),r('v13','2026-02-15','art-v','CloudCab',8.77),r('v14','2026-02-16','cycle-v','CloudCab',30),
 r('v15','2024-02-29','art-v','MetroFox',0.29),r('v16','2025-12-31','art-v','MetroFox',9.09)
];
export const comparisonContext=()=>({cats:COMPARISON_CATS.map(c=>({...c})),expenses:COMPARISON_ROWS.map(r=>({...r})),today:'2026-10-20',budgets:{}});
export const namedPeriod=month=>({period:'named_month',month});
export const rangePeriod=(start,end)=>({period:'range',start,end});
export const periodQuery=(a,b,filters={})=>({operation:'compare',period:'all',comparison:{kind:'periods',periods:[a,b],categories:[]},...filters});
export const categoryQuery=(a,b,filters={})=>({operation:'compare',period:'month',comparison:{kind:'categories',periods:[],categories:[a,b]},...filters});
