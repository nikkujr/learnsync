import {Empty} from '../../components/Empty';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQueries,useQuery} from '@tanstack/react-query';
import {api} from '../../app/api';
import {useClasses} from '../../components/classes';
import {useHere} from '../../components/origin';
import {useAuth} from '../../app/providers';
import {workLink,type Work} from './Dashboards';
import type {Assessment} from '../assessments/types';

interface Ev{key:string;title:string;subject:string;at:Date;to:string}
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const sameDay=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();

/** What is due, by month: a student's open work, or a teacher's assigned work across all their classes. Each entry opens the work. */
export function CalendarPage({role}:{role:'student'|'faculty'}){
  const here=useHere();const {session}=useAuth();
  const [month,setMonth]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
  const todo=useQuery({queryKey:['todo','student'],enabled:role==='student',queryFn:()=>api<{todo:Work[];awaiting_feedback:Work[];another_attempt:Work[]}>('/dashboard/student/todo')});
  const classes=useClasses('faculty',session?.user?.display_name??'');
  const open=(role==='faculty'?classes.data??[]:[]).filter(c=>c.open);
  const lists=useQueries({queries:open.map(c=>({queryKey:['assessments',c.id],queryFn:()=>api<Assessment[]>(`/teach/offerings/${c.id}/assessments`)}))});
  const events:Ev[]=role==='student'
    ?[...(todo.data?.todo??[]),...(todo.data?.another_attempt??[]),...(todo.data?.awaiting_feedback??[])].filter(w=>w.deadline).map(w=>({key:w.assessment_id,title:w.title,subject:w.subject,at:new Date(w.deadline!),to:workLink(w)}))
    :open.flatMap((c,i)=>(lists[i]?.data??[]).filter(a=>a.published?.deadline&&!a.archived).map(a=>({key:a.id,title:a.published!.title,subject:c.code,at:new Date(a.published!.deadline!),to:`/faculty/offerings/${c.id}/assessments/${a.id}/scores`})));
  const loading=role==='student'?todo.isPending:classes.isPending||lists.some(l=>l.isPending);
  const first=month.getDay(),count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(),today=new Date();
  const label=month.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const step=(n:number)=>setMonth(new Date(month.getFullYear(),month.getMonth()+n,1));
  const days=Array.from({length:count},(_,i)=>{const date=new Date(month.getFullYear(),month.getMonth(),i+1);return {date,items:events.filter(e=>sameDay(e.at,date)).sort((a,b)=>+a.at-+b.at)}});
  return <>
    <h1>Calendar</h1>
    <div className="cal-bar"><button type="button" className="icon-btn" aria-label="Previous month" onClick={()=>step(-1)}><span aria-hidden="true">‹</span></button>
      <h2 aria-live="polite">{label}</h2>
      <button type="button" className="icon-btn" aria-label="Next month" onClick={()=>step(1)}><span aria-hidden="true">›</span></button>
      <button type="button" onClick={()=>setMonth(new Date(today.getFullYear(),today.getMonth(),1))}>Today</button></div>
    {loading?<p role="status">Loading…</p>:<>
      {events.length===0&&<Empty icon="calendar" title="Nothing due yet">Work with a due date appears on your calendar.</Empty>}
      <div className="month-head" aria-hidden="true">{DAYS.map(d=><span key={d}>{d}</span>)}</div>
      <ol className="month" aria-label={label}>
        {Array.from({length:first},(_,i)=><li key={'b'+i} className="blank" aria-hidden="true"/>)}
        {days.map(({date,items})=><li key={date.getDate()} className={sameDay(date,today)?'today':undefined} data-empty={items.length===0}>
          <time dateTime={date.toISOString().slice(0,10)} className="day-n"><span className="day-name">{DAYS[date.getDay()]} </span>{date.getDate()}</time>
          {items.length>0&&<ul>{items.map(e=><li key={e.key}><Link state={here} to={e.to}><strong>{e.title}</strong><span className="muted">{e.subject} · {e.at.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span></Link></li>)}</ul>}</li>)}
      </ol></>}
  </>;
}
