/** Independent fictional OR-filter regression data, not evaluation MAIN data. */
export const OR_CATS=[
  {id:'studio-x',label:'Studio kits',color:'#D85A30'},
  {id:'cycle-y',label:'Bicycle upkeep',color:'#378ADD'},
  {id:'meal-z',label:'Campus meals',color:'#1D9E75'},
];
const row=(id,date,category,description,amount)=>({id,date,category,description,amount,notes:''});
export const OR_EXPENSES=[
  row('u1','2026-10-01','studio-x','BlueCab ticket',10.01),
  row('u2','2026-10-02','cycle-y','SwiftVan hire',20.02),
  row('u3','2026-10-03','studio-x','BlueCab / SwiftVan shared',30.03),
  row('u4','2026-10-04','meal-z','BlueCab snack',40.04),
  row('u5','2026-09-30','cycle-y','SwiftVan late',5.05),
  row('u6','2026-10-05','studio-x','Paper pack',6.06),
  row('u7','2026-10-06','cycle-y','BLUECAB extra',9.99),
  row('u8','2026-10-20','studio-x','BlueCab future',90),
  row('u9','2026-10-19','cycle-y','Boundary SwiftVan',1),
  row('u10','2026-09-20','studio-x','Old BlueCab',2.02),
];
export const orContext=()=>({today:'2026-10-19',cats:OR_CATS.map(c=>({...c})),expenses:OR_EXPENSES.map(r=>({...r})),budgets:{'studio-x':100}});
export const orQuery={operation:'total',period:'month',categories:['studio-x','cycle-y'],descriptionTerms:['BlueCab','SwiftVan'],category_terms:['Studio kits','Bicycle upkeep']};
