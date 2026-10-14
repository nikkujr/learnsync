import {Loading} from '../../components/Loading';
import {Link,NavLink,Outlet,useLocation,useMatch,useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../app/api';
import type {OfferingSummary} from '../academics/types';
import {classArt,classColor,initials} from '../../components/classes';
import type {SyllabusState} from './types';

interface Tab{label:string;to:string;segments:string[];hidden?:boolean}

/** The subject's main tabs, Classroom-style. Each tab owns several routes (its segments), so the old addresses still light up the right tab. */
function MainTabs({role,base}:{role:'faculty'|'student';base:string}){
  const {offeringId}=useParams();const {pathname}=useLocation();
  const segment=pathname.slice(base.length).replace(/^\//,'').split('/')[0];
  const assessments=useQuery({queryKey:['assessments',offeringId],queryFn:()=>api<{published:unknown}[]>(`/teach/offerings/${offeringId}/assessments`),enabled:role==='faculty'});
  const graded=!assessments.data||assessments.data.some(a=>a.published);   // Grades stays hidden until something is published (kept while loading)
  const tabs:Tab[]=role==='faculty'
    ?[{label:'Stream',to:`${base}/stream`,segments:['stream','announcements']},{label:'Classwork',to:`${base}/classwork`,segments:['classwork','syllabus','content','assessments']},
      {label:'People',to:`${base}/people`,segments:['people','attendance','progress','students']},{label:'Grades',to:`${base}/grades`,segments:['grades','gradebook','class-standing'],hidden:!graded}]
    :[{label:'Stream',to:`${base}/stream`,segments:['stream','announcements']},{label:'Classwork',to:`${base}/classwork`,segments:['classwork','syllabus','lessons','work','your-work','results','progress','grades']},
      {label:'People',to:`${base}/people`,segments:['people']}];
  return <nav className="tabs" aria-label="Subject sections">{tabs.filter(t=>!t.hidden).map(t=>{const on=t.segments.includes(segment);
    return <Link key={t.label} to={t.to} className={on?'active':undefined} aria-current={on?'page':undefined}>{t.label}</Link>})}</nav>;
}

/** Shared header + tabs for one subject. role selects the route prefix and tab set. */
export function OfferingLayout({role}:{role:'faculty'|'student'}){
  const {offeringId}=useParams();
  const base=`/${role}/offerings/${offeringId}`;
  const query=useQuery({queryKey:['offering',offeringId],queryFn:()=>api<OfferingSummary&{enrollment_status?:string}>(role==='faculty'?`/offerings/${offeringId}`:`/learn/offerings/${offeringId}`)});
  const setup=!!useMatch('/faculty/offerings/:offeringId/setup');
  const stream=!!useMatch('/:role/offerings/:offeringId/stream');
  // a teacher whose subject has no published syllabus yet is pointed at the guided setup (faculty only)
  const syllabus=useQuery({queryKey:['syllabus',offeringId],queryFn:()=>api<SyllabusState>(`/teach/offerings/${offeringId}/syllabus`),enabled:role==='faculty'});
  const needsSetup=role==='faculty'&&!setup&&query.data?.term_status==='open'&&!!syllabus.data&&!syllabus.data.published;
  return <>
    {query.isPending?<Loading/>:query.error?<section className="panel"><h1>Subject unavailable</h1><p role="alert">{query.error.message}</p></section>:<>
      {(()=>{const o=query.data;const line=`${o.subject.code} · ${role==='faculty'?o.sections.map(s=>s.name).join(', ')||'No sections':o.faculty.display_name} · ${o.term}${o.term_status==='closed'?' · closed (read-only)':''}`;
        return stream?<header className={`banner ${classArt(o.id)}`} style={{'--cc':classColor(o.id)} as React.CSSProperties}><h1>{o.subject.title}</h1><p>{line}</p></header>
          :<header className="class-title" style={{'--cc':classColor(o.id)} as React.CSSProperties}><span className="class-dot" style={{background:classColor(o.id)}} aria-hidden="true">{initials(o.subject.title)[0]}</span><div><h1>{o.subject.title}</h1><p className="muted">{line}</p></div></header>})()}
      {role==='student'&&query.data.enrollment_status==='withdrawn'?<>
        <p className="warn" role="status">You are no longer enrolled in this subject. Course content is not available, but you can still see your own results and your earlier study chats.</p>
        <nav className="tabs" aria-label="Subject sections"><NavLink to={`/student/study-buddy?subject=${query.data.id}`}>Study buddy chats</NavLink><NavLink to={`${base}/results`}>Grades & results</NavLink></nav></>:<>
      {needsSetup&&<p className="notice" role="status"><strong>This subject is not set up yet.</strong> A guided setup takes a few minutes. <Link className="touch" to={`${base}/setup`}>Set up this subject</Link></p>}
      {!setup&&<MainTabs role={role} base={base}/>}</>}
      <Outlet context={{offering:query.data}}/>
    </>}
  </>;
}
