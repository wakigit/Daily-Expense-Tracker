import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { byDay, addDays, sum } from '../lib/stats';
import { money } from '../lib/format';
import { weekday } from '../lib/queryContract.js';
const fullDate=date=>new Date(`${date}T00:00:00Z`).toLocaleDateString('en-SG',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
function DayDetails({date,expenses,cats,onClose}) {
  const dialog=useRef(null),close=useRef(null);
  useEffect(()=>{dialog.current.showModal();close.current.focus();return()=>dialog.current?.close();},[]);
  const rows=expenses.filter(e=>e.date===date);
  return createPortal(<dialog ref={dialog} className="day-dialog" aria-labelledby="day-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <button ref={close} type="button" className="btn-ghost" onClick={onClose}>Close day details</button>
    <h2 id="day-title">{fullDate(date)}</h2><p className="money">{money(sum(rows))} · {rows.length} {rows.length===1?'transaction':'transactions'}</p>
    {rows.length===0?<p>No expenses recorded for this date.</p>:<ul>{rows.map(row=><li key={row.id}><span><strong>{row.description}</strong><small>{cats.find(c=>c.id===row.category)?.label??row.category}</small></span><strong className="money">{money(row.amount)}</strong></li>)}</ul>}
  </dialog>,document.body);
}
/** Daily rows are selected from the full ledger, independent of the header month. */
export default function WeekBars({expenses=[],cats=[],anchor,days=7}) {
  const [selected,setSelected]=useState(null),trigger=useRef(null);
  const dates=Array.from({length:days},(_,i)=>addDays(anchor,i-days+1)),totals=byDay(expenses);
  const bars=dates.map(date=>({date,total:totals[date]||0}));
  const windowTotal=sum(expenses.filter(e=>dates.includes(e.date))),peak=Math.max(...bars.map(b=>b.total),0),avg=windowTotal/days;
  const close=()=>{setSelected(null);requestAnimationFrame(()=>trigger.current?.focus());};
  return <section className="card week-bars" style={{'--i':1}}>
    <div className="week-head"><p className="lbl">Last {days} days</p><p className="lbl money week-total">{money(windowTotal)}</p></div>
    <p className="week-average-label money">Daily average {money(avg)} · Select a day</p>
    <div className="week-plot" role="group" aria-label={`Daily spending for the last ${days} days`}>
      {peak>0&&<div className="week-avg" style={{'--wk-ratio':avg/peak}}/>}
      {bars.map(b=><button type="button" key={b.date} className="week-col" aria-label={`${fullDate(b.date)}, ${money(b.total)}. Show transactions`} onClick={e=>{trigger.current=e.currentTarget;setSelected(b.date);}}>
        <span className={`week-bar${peak>0&&b.total===peak?' top':''}${b.total===0?' none':''}`} style={{height:`${peak?Math.max(b.total/peak*100,b.total>0?4:1.5):1.5}%`}}><span className="week-tip money">{money(b.total)}</span></span>
        <span className="week-day"><span>{new Date(`${b.date}T00:00:00Z`).toLocaleDateString('en-SG',{day:'numeric',month:'short',timeZone:'UTC'})}</span><span>{weekday(b.date).slice(0,3)}</span></span>
      </button>)}
    </div>
    {selected&&<DayDetails date={selected} expenses={expenses} cats={cats} onClose={close}/>}
  </section>;
}
