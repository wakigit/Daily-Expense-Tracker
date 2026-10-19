/** One bounded comparison descriptor, never independent executable queries. */
export function validateComparison(raw,{cats,periods,validDate}) {
  if(raw==null)return {ok:true,comparison:null};
  const bad=()=>({ok:false});
  if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['kind','periods','categories'].includes(k)))return bad();
  if(!['periods','categories'].includes(raw.kind)||!Array.isArray(raw.periods)||!Array.isArray(raw.categories))return bad();
  if(raw.kind==='categories'){
    if(raw.periods.length||raw.categories.length!==2||new Set(raw.categories).size!==2||raw.categories.some(id=>typeof id!=='string'||!cats.some(c=>c.id===id)))return bad();
    return {ok:true,comparison:{kind:'categories',periods:[],categories:[...raw.categories]}};
  }
  if(raw.categories.length||raw.periods.length!==2)return bad();
  const normal=[];
  for(const side of raw.periods){
    if(!side||typeof side!=='object'||Array.isArray(side)||Object.keys(side).some(k=>!['period','start','end','dayCount','month'].includes(k)))return bad();
    const {period,start=null,end=null,dayCount=null,month=null}=side;
    if(![...periods,'named_month'].includes(period))return bad();
    if(period==='range'?!validDate(start)||!validDate(end)||start>end:start!==null||end!==null)return bad();
    if(period==='last_days'?!Number.isInteger(dayCount)||dayCount<1||dayCount>3660:dayCount!==null)return bad();
    if(period==='named_month'?typeof month!=='string'||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)||!validDate(month+'-01'):month!==null)return bad();
    normal.push({period,start,end,dayCount,month});
  }
  return {ok:true,comparison:{kind:'periods',periods:normal,categories:[]}};
}
export function comparisonSchema(category,periods){
  const categoryIds=(category.enum??[]).filter(id=>id!==null);
  const periodSide={type:'object',additionalProperties:false,required:['period','start','end','dayCount','month'],properties:{
    period:{type:'string',enum:[...periods,'named_month']},start:{type:['string','null']},end:{type:['string','null']},dayCount:{type:['integer','null']},month:{type:['string','null'],description:'YYYY-MM only for named_month; completed months mean full calendar months'}
  }};
  const branch=kind=>({type:'object',additionalProperties:false,required:['kind','periods','categories'],properties:{
    kind:{type:'string',enum:[kind]},
    categories:{type:'array',...(kind==='categories'?{minItems:2,maxItems:2}:{maxItems:0}),items:{type:'string',...(categoryIds.length?{enum:categoryIds}:{})}},
    periods:{type:'array',...(kind==='periods'?{minItems:2,maxItems:2}:{maxItems:0}),items:periodSide}
  }});
  return {anyOf:[{type:'null'},branch('periods'),branch('categories')],description:'Exactly two periods with shared filters OR two category IDs over the root period, otherwise null.'};
}
