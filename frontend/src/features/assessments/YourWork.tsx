import {useState} from 'react';
import {Link,useOutletContext} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../app/api';
import {useHere} from '../../components/origin';
import type {OfferingSummary} from '../academics/types';
import {PERIOD_LABEL,fmt,when,type LearnItem,type Results} from './types';

type Filter='all'|'assigned'|'returned'|'missing';
const FILTERS:[Filter,string][]=[['all','All'],['assigned','Assigned'],['returned','Returned with grade'],['missing','Missing']];

/** Classroom's "Your work": every quiz and activity of this class with where it stands, filterable, and the published grades on top. */
export function YourWorkPage(){
  const {offering}=useOutletContext<{offering:OfferingSummary}>();
  const here=useHere();const [filter,setFilter]=useState<Filter>('all');
  const work=useQuery({queryKey:['learn-work',offering.id],queryFn:()=>api<LearnItem[]>(`/learn/offerings/${offering.id}/assessments`)});
  const results=useQuery({queryKey:['learn-results',offering.id],queryFn:()=>api<Results>(`/learn/offerings/${offering.id}/results`)});
  const base=`/student/offerings/${offering.id}`;
  if(work.error||results.error)return <p role="alert">{(work.error??results.error)!.message}</p>;
  if(!work.data||!results.data)return <p>Loading…</p>;
  const now=Date.now();
  const past=(w:LearnItem)=>!!w.deadline&&Date.parse(w.deadline)<now;
  const kind=(w:LearnItem)=>w.excused?'excused':w.bucket==='closed'||((w.bucket==='todo'||w.bucket==='again')&&past(w))?'missing':w.result?'returned':w.bucket==='awaiting'||w.bucket==='done'?'turned':'assigned';
  const label:Record<string,string>={excused:'Excused',missing:'Missing',returned:'Returned',turned:'Turned in',assigned:'Assigned'};
  const rows=work.data;
  const match=(w:LearnItem)=>filter==='all'||(filter==='returned'?kind(w)==='returned':filter==='assigned'?kind(w)==='assigned':kind(w)==='missing');
  const count=(f:Filter)=>rows.filter(w=>f==='all'||(f==='returned'?kind(w)==='returned':f==='assigned'?kind(w)==='assigned':kind(w)==='missing')).length;
  const shown=rows.filter(match);
  return <>
    <h2>Your work</h2>
    {results.data.grades.length>0&&<section aria-labelledby="grades-h"><h3 id="grades-h">Published grades</h3>
      <div className="stats">{results.data.grades.map(g=><div key={g.period}><strong>{fmt(g.grade)}</strong><span>{PERIOD_LABEL[g.period]??g.period} · {g.remark==='passed'?'Passed':'Below passing'}</span></div>)}</div></section>}
    <nav className="type-tabs" aria-label="Filter your work">{FILTERS.map(([k,l])=><button key={k} type="button" className={filter===k?'active':''} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l}<span className="muted tab-count">{count(k)}</span></button>)}</nav>
    {shown.length===0?<p className="muted">{rows.length===0?'Nothing has been assigned yet.':'Nothing here.'}</p>
      :<ul className="seq compact">{shown.map(w=><li key={w.id} data-cat={w.kind==='online_quiz'?'quiz':'activity'}>
        <span className="grow"><Link state={here} to={`${base}/work/${w.id}`}>{w.title}</Link><span className="muted">{w.deadline?`Due ${when(w.deadline)}`:'No due date'}{w.result?` · ${fmt(w.result.score)} / ${fmt(w.result.max_points)}`:''}</span></span>
        <span className={`badge${kind(w)==='missing'?' warn':kind(w)==='returned'?' done':''}`}>{label[kind(w)]}</span></li>)}</ul>}
    <p className="link-row"><Link to={`${base}/results`}>Grades and released results in detail</Link><Link to={`${base}/progress`}>My progress</Link></p>
  </>;
}

/** The People tab for a student: the teacher. Classmates' names are not shown. */
export function StudentPeople(){
  const {offering}=useOutletContext<{offering:OfferingSummary}>();
  const name=offering.faculty.display_name;
  const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]!.toUpperCase()).join('');
  return <>
    <h2 className="people-h">Teachers</h2>
    <p className="person"><span className="avatar" aria-hidden="true">{initials}</span>{name}</p>
    <p className="muted">Your classmates’ names are not shown here, to protect everyone’s privacy.</p>
  </>;
}
