import { categoryNames } from './categoryVocabulary.js';
import { normaliseScopeText } from './filterMatching.js';
import { comparisonPeriodHints } from './comparisonRequest.js';
import { MONTH_NAMES } from './periodMention.js';
import { resolveQueryRange } from './queryDates.js';
import { validDate } from './queryContract.js';
import { canonicalPlanQuery, planQuery, planRef, planScopeKey, planScopeContains, planFailure, validatePlan, validPlanCategories, jsonBytes, PLAN_LIMITS } from './planContract.js';

const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const CAT='\uE000c',TERM='\uE000t',END='\uE001';
const ctoken=i=>`${CAT}${i}${END}`,ttoken=i=>`${TERM}${i}${END}`;
const tokenPattern=kind=>new RegExp(`${kind==='c'?CAT:TERM}(\\d+)${END}`,'g');

/** Vocabulary protection precedes clause/date parsing. Input cannot forge tokens. */
function protect(message,cats){
  if(/[\uE000-\uF8FF\u0000-\u001f]/u.test(message))return null;
  const terms=[];let text=message.replace(/["“]([^"”]*)["”]/g,(_,term)=>ttoken(terms.push(term)-1));
  if(/["“”]/.test(text))return null;
  const names=new Map();
  for(const [i,c]of cats.entries())for(const label of categoryNames(c)){
    const key=normaliseScopeText(label);names.set(key,[...new Set([...(names.get(key)??[]),i])]);
  }
  text=normaliseScopeText(text);
  let ambiguous=false;
  const labels=[...names.keys()].sort((a,b)=>b.length-a.length);
  if(labels.length){
    const re=new RegExp(`(^|[^\\p{L}\\p{N}])(${labels.map(escape).join('|')})(?=$|[^\\p{L}\\p{N}])`,'gu');
    const calendarWords=[...MONTH_NAMES.flatMap(m=>[m.toLowerCase(),m.slice(0,3).toLowerCase()]),'sept'];
    // One pass over unquoted segments: generated tokens can never be rematched
    // as another configured label (including labels literally named c0/t0).
    text=text.split(new RegExp(`(${TERM}\\d+${END})`,'g')).map(part=>part.startsWith(TERM)?part:part.replace(re,(_,prefix,label)=>{
      const ids=names.get(label);
      const calendarLabel=calendarWords.some(m=>new RegExp(`^${m}(?: \\d{4})?$`).test(label))||
        /^(?:(?:this|last) (?:month|week)|this year|year-to-date|last\s*\d+\s*days?|today|yesterday|all time)$/.test(label)||
        /^(?:(?:on|during) )?(?:weekdays?|weekends?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)$/.test(label)||/^\d{4}-\d{2}-\d{2}$/.test(label);
      const grammarLabel=/^(?:(?:my|the|total|recorded|spending|share|percent|percentage|difference|and|or|then|what|did|i|spend|how|much)(?:\s+|$))+$/.test(label);
      if(ids.length!==1||calendarLabel||grammarLabel)ambiguous=true;
      return prefix+ctoken(ids[0]);
    })).join('');
  }
  if(ambiguous)return null;
  return {text:text.replace(/[?.!]\s*$/,'').replace(/,\s*/g,', ').replace(/^please\s+/,''),terms,cats};
}

/** Parse period WORDS only. All calendar arithmetic remains in queryDates. */
function commonPeriod(text,today){
  const periods=[];
  const take=(regex,read)=>{text=text.replace(regex,(...args)=>{periods.push(read(args));return ' ';});};
  take(/\b(?:from|between)\s+(\d{4}-\d{2}-\d{2})\s+(?:to|through|and)\s+(\d{4}-\d{2}-\d{2})\b/g,a=>({period:'range',start:a[1],end:a[2]}));
  take(/\b(?:over\s+(?:the\s+)?|in\s+(?:the\s+)?|for\s+(?:the\s+)?)?last\s*(\d+)\s*days?\b/g,a=>({period:'last_days',dayCount:Number(a[1])}));
  take(/\b(?:(?:in|during|for|over)\s+)?(this month|last month|this week|last week|today|yesterday|this year|year-to-date|all time)\b/g,a=>({period:({'this month':'month','last month':'lastmonth','this week':'week','last week':'lastweek',today:'today',yesterday:'yesterday','this year':'year','year-to-date':'year','all time':'all'})[a[1]]}));
  const months=[...new Set(MONTH_NAMES.flatMap(m=>[m.toLowerCase(),m.slice(0,3).toLowerCase()])),'sept'];
  const re=new RegExp(`\\b(?:(?:in|during|for)\\s+)?(?:${months.join('|')})(?:\\s+\\d{4})?\\b`,'g');
  take(re,a=>{const hints=comparisonPeriodHints(a[0],today);if(hints.periods.length!==1)return null;
    const r=resolveQueryRange(hints.periods[0],today,[]);return {period:'range',...r};});
  if(periods.some(p=>p===null)||new Set(periods.map(p=>JSON.stringify(p))).size>1)return null;
  return {text:text.replace(/\s+/g,' ').trim(),period:periods[0]??{period:'month'}};
}

/** Complete consumption, not a keyword-to-query guess. Different attachments clarify. */
function scope(text,common,env){
  let q=planQuery(common),bad=false;
  const set=(key,value)=>{if(q[key]!==null&&q[key]!=='all'&&q[key]!==value)bad=true;else q[key]=value;};
  let amountSeen=false,daySeen=false;
  text=text.replace(/\b(over|under|at least|at most|more than|less than)\s*(?:s\$|\$|sgd\s*)?(\d{1,9}(?:\.\d{1,2})?)\b/g,(_,op,n)=>{
    if(amountSeen)bad=true;amountSeen=true;
    set('amountOperator',({over:'gt',under:'lt','at least':'gte','at most':'lte','more than':'gt','less than':'lt'})[op]);set('amount',n);return ' ';});
  text=text.replace(/\b(?:on|during)\s+(weekdays?|weekends?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/g,(_,day)=>{
    if(daySeen)bad=true;daySeen=true;const singular=day.replace(/s$/,'');
    set('day',['weekday','weekend'].includes(singular)?singular:singular[0].toUpperCase()+singular.slice(1));return ' ';});
  const literal=/\b(?:descriptions? (?:mentioning|containing|matching)|purchases? (?:mentioning|containing)|mentioning|containing|at)\s+(.+)$/.exec(text);
  if(literal){
    const raw=literal[1].trim();const pieces=raw.split(/\s+or\s+/);
    const values=pieces.map(p=>{
      const match=new RegExp(`^${TERM}(\\d+)${END}$`).exec(p);
      if(match)return env.terms[Number(match[1])];
      // Multiword literals need quotes; otherwise additional operations could disappear.
      return /^[\p{L}\p{N}_][\p{L}\p{N}_'.&/-]*$/u.test(p)?p:null;
    });
    if(values.some(v=>v===null)||values.length>8||q.description||q.descriptionTerms.length)bad=true;
    else if(values.length===1)q.description=values[0];else q.descriptionTerms=values;
    text=text.slice(0,literal.index);
  }
  text=text.replace(/\s+/g,' ').trim().replace(/^(?:my|the)\s+/,'')
    .replace(/^(?:total\s+(?:recorded\s+)?spending|recorded spending|spending|total)\s*/,'')
    .replace(/\s+(?:spending|expenses|purchases)$/,'').replace(/^(?:on|for|in|category)\s+/,'').trim();
  if(text){
    const hits=[...text.matchAll(tokenPattern('c'))];
    const remainder=text.replace(tokenPattern('c'),'').replace(/\b(?:or|and)\b|,/g,'').trim();
    if(!hits.length||remainder)bad=true;
    else {
      const ids=[...new Set(hits.map(m=>env.cats[Number(m[1])]?.id))];
      if(q.category||q.categories.length||ids.includes(undefined))bad=true;
      else {if(ids.length===1)q.category=ids[0];else q.categories=ids;
        q.category_terms=ids.map(id=>env.cats.find(c=>c.id===id).label);}
    }
  }
  if(bad)return null;
  const c=canonicalPlanQuery(q,env.cats);return c.ok?c.query:null;
}

const makePlan=(queries,derived)=>({version:1,steps:queries.map((query,i)=>({id:`q${i+1}`,query})),derived:derived.map((d,i)=>({id:`d${i+1}`,...d}))});
const percent=(n,d)=>({operation:'percent_of',numerator:planRef(n),denominator:planRef(d)});
const difference=(l,r)=>({operation:'difference',left:planRef(l),right:planRef(r)});
const totalPrefix=/^(?:what did i spend|how much did i spend|what (?:was|is) my total spending|show (?:my )?total spending)\b\s*/;

/** Independent request requirements. Not wired to live interpretation or offline UI. */
export function recognizePlanRequest(message,{cats=[],today}={}){
  const fail=()=>({recognized:true,...planFailure('plan_request_unsupported',message)});
  if(typeof message!=='string'||jsonBytes(message)>PLAN_LIMITS.instructionBytes||!validDate(today)||!validPlanCategories(cats))return fail();
  const env=protect(message,cats);
  if(!env)return fail();
  if(/\b(?:compare|compared|comparison|comparisons|versus|vs)\b/.test(env.text)&&
    !/\b(?:share|percentage|percent|then)\b/.test(env.text))return {ok:false,recognized:false};
  // Quoted terms and complete category names are protected before these markers.
  const potential=/\b(?:share|percentage|percent)\b/.test(env.text)||
    (/^(?:show|give me|tell me)\b/.test(env.text)&&(env.text.match(/\bspending\b/g)??[]).length>1&&/\band\b/.test(env.text));
  if(!potential)return {ok:false,recognized:false};
  const dates=commonPeriod(env.text,today);if(!dates)return fail();
  const text=dates.text.replace(/\s*,\s*/g,', ');
  let expected=null,family=null;
  const a=/^(.+?),?\s+and\s+(?:what\s+)?(?:percentage|percent|share)(?:\s+of\s+(?:it|that|the total))?\s+(?:was|is|went to)\s+(.+)$/.exec(text);
  if(a&&totalPrefix.test(a[1])){
    const whole=scope(a[1].replace(totalPrefix,'').replace(/,$/,''),dates.period,env);
    const part=whole&&scope(a[2],whole,env);
    if(whole&&part){expected=makePlan([whole,part],[percent('q2','q1')]);family='total_category_share';}
  }else{
    const c=/^(?:what|which)\s+(?:share|percentage|percent)\s+of\s+(.+?)\s+(?:was|is|went|goes)\s+(.+)$/.exec(text);
    if(c){
      const whole=scope(c[1],dates.period,env),part=whole&&scope(c[2].replace(/^(?:to|on|for)\s+/,''),whole,env);
      if(whole&&part){expected=makePlan([whole,part],[percent('q2','q1')]);family='restricted_share';}
    }else{
      const show=/^(?:show|give me|tell me)\s+(.+)$/.exec(text);
      if(show){
        const pieces=show[1].split(/,?\s+then\s+/);if(pieces.length>2)return fail();
        const clauses=pieces[0].split(/\s*(?:,\s*(?:and\s+)?|\s+and\s+)\s*/);
        const queries=[];
        for(const clause of clauses){
          // These are separately requested totals. Only the explicitly common
          // date range is inherited, never a first part's merchant/day/amount.
          const q=scope(clause,dates.period,env);if(!q)return fail();queries.push(q);
        }
        const derived=[];
        const lookup=subject=>{const q=scope(subject,dates.period,env);const i=q?queries.findIndex(candidate=>planScopeKey(candidate)===planScopeKey(q)):-1;return i>=0?`q${i+1}`:null;};
        if(pieces[1])for(const phrase of pieces[1].split(/\s+and\s+/)){
          if(/^(?:the )?difference$/.test(phrase)&&queries.length===2&&!queries[0].category&&!queries[0].categories.length&&
            !queries[0].description&&!queries[0].descriptionTerms.length&&planScopeContains(queries[0],queries[1]))derived.push(difference('q1','q2'));
          else {
            const share=/^(.+?)\s+(?:percentage|share)\s+of\s+(?:the )?total$/.exec(phrase);
            const minus=/^(total|.+?)\s+minus\s+(total|.+)$/.exec(phrase);
            if(share){const id=lookup(share[1]);if(!id)return fail();derived.push(percent(id,'q1'));}
            else if(minus){const left=minus[1]==='total'?'q1':lookup(minus[1]),right=minus[2]==='total'?'q1':lookup(minus[2]);if(!left||!right)return fail();derived.push(difference(left,right));}
            else return fail();
          }
        }
        expected=makePlan(queries,derived);family='totals_difference';
      }
    }
  }
  if(!expected)return fail();
  const checked=validatePlan(expected,{cats,today,message});
  if(!checked.ok)return fail();
  return {ok:true,recognized:true,family,plan:checked.plan};
}

export function auditPlanRequest(plan,context={}){
  const request=recognizePlanRequest(context.message,context);
  if(!request.ok)return request.recognized?request:planFailure('plan_request_unsupported',context.message);
  if(plan.steps.length!==request.plan.steps.length||plan.derived.length!==request.plan.derived.length||
    plan.steps.some((s,i)=>planScopeKey(s.query)!==planScopeKey(request.plan.steps[i].query))||
    JSON.stringify(plan.derived)!==JSON.stringify(request.plan.derived))return planFailure('plan_request_coverage',context.message);
  return {ok:true,family:request.family};
}

/** Future integration guard. Calling this does not change any existing intent path. */
export function guardPlanResponse(message,intent,context={}){
  const req=recognizePlanRequest(message,context);
  if(!req.recognized)return {handled:false};
  if(intent?.type==='clarify')return {handled:false};
  if(intent?.type!=='plan')return {handled:true,...planFailure('plan_complete_request_required',message)};
  const checked=validatePlan(intent.plan,{...context,message});
  if(!checked.ok)return {handled:true,...checked};
  const audit=auditPlanRequest(checked.plan,{...context,message});
  return audit.ok?{handled:false}:{handled:true,...audit};
}
