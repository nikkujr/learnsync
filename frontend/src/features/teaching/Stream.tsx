import {Link,useOutletContext} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../app/api';
import type {OfferingSummary} from '../academics/types';
import {FacultyAnnouncements} from './Announcements';
import {itemTitle} from './Content';
import {assessmentTitle} from '../assessments/Assessments';
import type {Assessment} from '../assessments/types';
import type {Item,LearnItem} from './types';
import {studentHomeQuery,workLink} from '../dashboard/Dashboards';

const day=(iso:string)=>new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'});
const ICON:Record<string,string>={Quiz:'?','Paper quiz':'?',Activity:'✎',Examination:'✱','Teacher-scored item':'✎'};
const KIND:Record<string,string>={lesson:'Lesson',file:'File',reference:'Link',online_quiz:'Quiz',offline_quiz:'Paper quiz',activity:'Activity',exam:'Examination',manual:'Teacher-scored item'};

/** Teachers: announcements to the sections, then what was published lately. */
export function FacultyStream(){
  const {offering}=useOutletContext<{offering:OfferingSummary}>();
  const items=useQuery({queryKey:['items',offering.id],queryFn:()=>api<Item[]>(`/teach/offerings/${offering.id}/items`)});
  const assessments=useQuery({queryKey:['assessments',offering.id],queryFn:()=>api<Assessment[]>(`/teach/offerings/${offering.id}/assessments`)});
  const base=`/faculty/offerings/${offering.id}`;
  const recent=[
    ...(items.data??[]).filter(i=>i.published&&!i.archived).map(i=>({key:'i'+i.id,title:itemTitle(i),kind:KIND[i.kind],at:i.published!.published_at!,to:`${base}/content/${i.id}/edit`})),
    ...(assessments.data??[]).filter(a=>a.published&&!a.archived).map(a=>({key:'a'+a.id,title:assessmentTitle(a),kind:KIND[a.kind],at:a.published!.published_at!,to:`${base}/assessments/${a.id}`})),
  ].filter(r=>r.at).sort((a,b)=>a.at<b.at?1:-1).slice(0,6);
  const soon=(assessments.data??[]).filter(a=>a.published&&!a.archived&&a.published.deadline&&Date.parse(a.published.deadline)>Date.now())
    .sort((a,b)=>a.published!.deadline!<b.published!.deadline!?-1:1).slice(0,3);
  return <div className="stream">
    <aside className="stream-side" aria-label="Upcoming"><section className="panel"><h2>Upcoming</h2>
      {soon.length===0?<p className="muted">Nothing is due soon.</p>:<ul className="upcoming-list">{soon.map(a=><li key={a.id}><Link to={`${base}/assessments/${a.id}`}>{assessmentTitle(a)}</Link><span className="muted">Due {day(a.published!.deadline!)}</span></li>)}</ul>}</section></aside>
    <div className="stream-feed">
      <FacultyAnnouncements/>
      {recent.map(r=><article className="panel post" key={r.key}><span className="post-icon" aria-hidden="true">{ICON[r.kind]??'▤'}</span>
        <div className="post-head"><h3>You posted a new {r.kind.toLowerCase()}</h3><time dateTime={r.at}>{day(r.at)}</time></div><p className="post-body"><Link className="post-link" to={r.to}>{r.title}</Link></p></article>)}
      {recent.length===0&&<p className="muted">Lessons, files, links and assessments you publish appear here.</p>}
    </div></div>;
}

interface Post{id:string;title:string;body:string;published_at:string|null}
interface Results{results:{assessment_id:string;title:string;released_at:string}[];grades:{period:string;published_at:string}[]}
interface Entry{key:string;type:string;icon:string;title:string;at:string;body?:string;to?:string}

/** Students: one feed of announcements, new materials, released results and published grades, newest first. */
export function StudentStream(){
  const {offering}=useOutletContext<{offering:OfferingSummary}>();
  const base=`/student/offerings/${offering.id}`;
  const posts=useQuery({queryKey:['learn-stream-posts',offering.id],queryFn:()=>api<{items:Post[]}>(`/learn/offerings/${offering.id}/announcements?limit=25&offset=0`)});
  const items=useQuery({queryKey:['learn-items',offering.id],queryFn:()=>api<LearnItem[]>(`/learn/offerings/${offering.id}/items`)});
  const results=useQuery({queryKey:['learn-stream-results',offering.id],queryFn:()=>api<Results>(`/learn/offerings/${offering.id}/results`)});
  const home=useQuery(studentHomeQuery);
  const error=posts.error??items.error??results.error;
  if(error)return <p role="alert">{error.message}</p>;
  if(!posts.data||!items.data||!results.data)return <p>Loading…</p>;
  const feed:Entry[]=[
    ...posts.data.items.filter(p=>p.published_at).map(p=>({key:'p'+p.id,type:offering.faculty.display_name,icon:'✉',title:p.title,at:p.published_at!,body:p.body})),
    ...items.data.map(i=>({key:'i'+i.id,type:`${offering.faculty.display_name} posted a new ${i.kind==='lesson'?'lesson':i.kind==='file'?'file':'link'}`,icon:'▤',title:i.title,at:i.published_at,to:`${base}/lessons/${i.id}`})),
    ...results.data.results.map(r=>({key:'r'+r.assessment_id,type:'Your result was released',icon:'✓',title:r.title,at:r.released_at,to:`${base}/results`})),
    ...results.data.grades.map(g=>({key:'g'+g.period,type:'A grade was published',icon:'★',title:`${g.period.charAt(0).toUpperCase()+g.period.slice(1)} grade`,at:g.published_at,to:`${base}/results`})),
  ].sort((a,b)=>a.at<b.at?1:-1).slice(0,30);
  const mine=(home.data?.todo??[]).filter(w=>w.offering_id===offering.id&&w.deadline&&Date.parse(w.deadline)>Date.now()).slice(0,3);
  return <div className="stream">
    <aside className="stream-side" aria-label="Upcoming"><section className="panel"><h2>Upcoming</h2>
      {mine.length===0?<p className="muted">Nothing is due soon.</p>:<ul className="upcoming-list">{mine.map(w=><li key={w.assessment_id}><Link to={workLink(w)}>{w.title}</Link><span className="muted">Due {day(w.deadline!)}</span></li>)}</ul>}
      <Link className="touch" to="/student/todo">View all</Link></section></aside>
    <div className="stream-feed">{feed.length===0?<section className="panel"><h2>Nothing yet</h2><p className="muted">Announcements, new lessons and released results from your teacher appear here.</p></section>
      :feed.map(e=><article className="panel post" key={e.key}><span className={`post-icon${e.icon==='✉'?' announcement':''}`} aria-hidden="true">{e.icon}</span>
        <div className="post-head"><h3>{e.type}</h3><time dateTime={e.at}>{day(e.at)}</time></div>
        {e.body?<p className="post-body pre"><strong>{e.title}</strong>{'\n'}{e.body}</p>:<p className="post-body"><Link className="post-link" to={e.to!}>{e.title}</Link></p>}</article>)}</div></div>;
}
