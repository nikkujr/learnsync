import {useEffect,useRef} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../app/api';
import {useHere} from '../../components/origin';
import {useAuth} from '../../app/providers';
import {markSeen,readSeen} from '../../components/seen';
import {classColor,initials,useClasses} from '../../components/classes';

export const when=(iso:string)=>new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'});
const dateTime=(iso:string)=>new Date(iso).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit',month:'short',day:'numeric'});
const today=()=>new Date().toLocaleDateString(undefined,{weekday:'long',day:'2-digit',month:'long'});
const plural=(n:number,one:string,many=one+'s')=>`${n} ${n===1?one:many}`;

function Page<T>({query,children}:{query:{isPending:boolean;error:Error|null;data?:T};children:(data:T)=>React.ReactNode}){
  if(query.isPending)return <p role="status">Loading your dashboard…</p>;
  if(query.error)return <section className="panel"><h2>The dashboard could not be loaded</h2><p role="alert">{query.error.message}</p></section>;
  return <>{children(query.data as T)}</>;
}
const Heading=({eyebrow,title,line}:{eyebrow:string;title:string;line:string})=>
  <div className="page-heading dash-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{line}</p></div><span className="date-chip">{today()}</span></div>;
const Stats=({items}:{items:[number|string,string,string?][]})=>{
  const here=useHere();
  return <section className="stats" aria-label="At a glance">{items.map(([n,l,to])=><div key={l}><strong>{n}</strong>{to?<Link state={here} to={to}>{l}</Link>:<span>{l}</span>}</div>)}</section>;
};
function Hero({eyebrow,title,detail,action,to,icon}:{eyebrow:string;title:string;detail:string;action?:string;to?:string;icon:string}){
  const here=useHere();
  return <section className="hero"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="muted">{detail}</p>{action&&to&&<Link state={here} className="button primary" to={to}>{action}</Link>}</div><span className="hero-art" aria-hidden="true">{icon}</span></section>;
}

// ---------------------------------------------------------------- student
export interface Work{late_allowed?:boolean;offering_id:string;assessment_id:string;kind:string;title:string;subject:string;deadline:string|null;available_from?:string|null;state?:string;attempts_left?:number}
interface StudentHomeData{name:string;subjects:{offering_id:string;code:string;title:string;percent:number|null;done:number;total:number;to_do:number}[];
  week:{days:{label:string;date:string;count:number;today:boolean;future:boolean}[];lessons_today:number;work_today:number};
  next_step:{type:string;title:string;subject:string;link:string}|null;todo:Work[];todo_total:number;awaiting_feedback:Work[];another_attempt:Work[];
  updates:{type:string;title:string;subject:string;at:string;link:string}[]}
const UPDATE_LABEL:Record<string,string>={announcement:'Announcement',material:'New material',result:'Result',grade:'Grade'};
export const workLink=(w:Work)=>`/student/offerings/${w.offering_id}/work/${w.assessment_id}`;

export const studentHomeQuery={queryKey:['dashboard','student'],queryFn:()=>api<StudentHomeData>('/dashboard/student')};

export function StudentHome(){
  const here=useHere();const {session}=useAuth();const uid=session?.user?.id??'';
  const seenBefore=useRef(readSeen(uid));          // fixed for this visit so the "New" tags stay readable
  const query=useQuery(studentHomeQuery);
  const teachers=new Map((useClasses('student','').data??[]).map(c=>[c.id,c]));
  const latest=query.data?.updates[0]?.at;
  useEffect(()=>{if(latest)markSeen(uid,latest)},[uid,latest]);
  return <Page query={query}>{d=>{
    const only=d.subjects.length===1?d.subjects[0]:null;
    return <>
      <h1 className="sr-only">Home</h1>
      <section aria-labelledby="subjects-h"><h2 id="subjects-h" className="sr-only">Your classes</h2>
        {d.subjects.length===0?<p className="panel muted">No current subjects. You are not enrolled in a current subject yet.</p>:<div className="class-grid">{d.subjects.map(s=>{const c=teachers.get(s.offering_id);
          return <SubjectCard key={s.offering_id} id={s.offering_id} title={s.title} section={c?.section??s.code} teacher={c?.teacher??''} meta={s.to_do?plural(s.to_do,'item')+' to do':'Nothing to do'}
            progress={s.percent} detail={s.total?`${s.done} of ${s.total} steps done`:'No lessons or work yet'} to={`/student/offerings/${s.offering_id}/stream`} links={[['Classwork',`/student/offerings/${s.offering_id}/classwork`],['Grades',`/student/offerings/${s.offering_id}/results`]]}/>})}</div>}</section>
      <div className="dash-grid home-more">
        <div className="dash-main">
          {d.next_step?<Hero eyebrow={d.next_step.type==='lesson'?'Your next step':'Your next task'} title={d.next_step.title} detail={d.next_step.subject} action={d.next_step.type==='lesson'?'Continue learning':'Open work'} to={d.next_step.link} icon="▤"/>
            :<Hero eyebrow="Your next step" title="You’re up to date" detail={d.subjects.length?'Nothing is waiting for you right now. New lessons and work appear here when your teacher publishes them. You can review your subjects or ask study help about what you have learned.':'You are not enrolled in a current subject yet.'} action={d.subjects.length?'See my subjects':undefined} to="/student/subjects" icon="✓"/>}
          <section className="panel"><h2>Learning activity this week</h2>
            <p className="muted">Lessons, files and links you marked complete and quizzes or activities you submitted. Opening or reading something does not count.</p>
            <ol className="week" aria-label="Activity by day this week">{d.week.days.map(day=>
              <li key={day.date} className={`${day.count>0?'done':''} ${day.today?'today':''} ${day.future?'future':''}`}>
                <span>{day.today?'Today':day.label}</span><b aria-hidden="true">{day.count>0?'✓':day.today?'○':''}</b>
                <span className="sr-only">{day.count>0?`${plural(day.count,'step')} completed`:day.future?'upcoming':'nothing completed'}</span></li>)}</ol>
            <Stats items={[[d.week.lessons_today,'Lessons completed today'],[d.week.work_today,'Quizzes and activities submitted today']]}/>
            {only&&<Link state={here} className="button" to={`/student/offerings/${only.offering_id}/progress`}>View my progress</Link>}
          </section>
        </div>
        <div className="dash-side">
          <section className="panel"><h2>To do</h2>
            {d.todo.length===0?<p className="muted">Nothing needs your action.</p>:<ul className="rows">{d.todo.map(w=><li key={w.assessment_id}><Link state={here} to={workLink(w)}>{w.title}</Link>
              <span className="muted">{w.subject} · {w.kind==='online_quiz'?'Quiz':'Activity'} · {w.state==='not_open'?(w.available_from?`opens ${dateTime(w.available_from)}`:'not open yet'):w.deadline?(w.late_allowed?`late submission allowed, was due ${dateTime(w.deadline)}`:`due ${dateTime(w.deadline)}`):'no deadline'}</span></li>)}</ul>}
            {d.todo_total>d.todo.length&&<p className="muted">and {d.todo_total-d.todo.length} more. </p>}
            <Link state={here} className="touch" to="/student/todo">See everything to do</Link>
            {d.awaiting_feedback.length>0&&<><h3>Awaiting feedback</h3><ul className="rows">{d.awaiting_feedback.map(w=><li key={w.assessment_id}><Link state={here} to={workLink(w)}>{w.title}</Link><span className="muted">{w.subject} · submitted</span></li>)}</ul></>}
            {d.another_attempt.length>0&&<><h3>Another attempt available</h3><ul className="rows">{d.another_attempt.map(w=><li key={w.assessment_id}><Link state={here} to={workLink(w)}>{w.title}</Link><span className="muted">{w.subject} · {plural(w.attempts_left??0,'attempt')} left</span></li>)}</ul></>}
          </section>
          <section className="panel"><h2>Course updates</h2>
            {d.updates.length===0?<p className="muted">No updates in the last 30 days.</p>:<ul className="rows updates">{d.updates.map((u,i)=><li key={i}><span className="eyebrow">{UPDATE_LABEL[u.type]??u.type} · {when(u.at)}{Date.parse(u.at)>seenBefore.current&&<> · <span className="badge">New</span></>}</span><Link state={here} to={u.link}>{u.title}</Link><span className="muted">{u.subject}</span></li>)}</ul>}
          </section>

        </div>
      </div></>;
  }}</Page>;
}

/** A Classroom-style class card: coloured header with title, section and teacher, a round avatar, a short body and shortcuts. The whole header opens the class. */
export function SubjectCard({id,title,section,teacher,meta,progress,detail,to,links}:{id:string;title:string;section:string;teacher:string;meta?:string;progress?:number|null;detail?:string;to:string;links:[string,string][]}){
  const here=useHere();
  return <article className="class-card" style={{'--cc':classColor(id)} as React.CSSProperties}>
    <div className="class-head"><h3><Link state={here} to={to}>{title}</Link></h3><p>{section}</p>{teacher&&<p>{teacher}</p>}</div>
    <span className="class-avatar" aria-hidden="true">{initials(teacher||title)}</span>
    <div className="class-body">{meta&&<p><strong>{meta}</strong></p>}
      {progress!==undefined&&progress!==null&&<div className="bar-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${title} progress`}><span style={{width:`${progress}%`}}/></div>}
      {detail&&<p>{detail}</p>}</div>
    <div className="class-foot">{links.map(([l,h])=><Link key={h} state={here} to={h}>{l}</Link>)}</div></article>;
}

// ---------------------------------------------------------------- faculty
interface FacultyHomeData{name:string;subjects:{offering_id:string;code:string;title:string;sections:string[];students:number;term:string;drafts_content:number;drafts_assessments:number;to_grade:number;needs_review:number;average_progress:number|null;quiet_students:number}[];
  closed_subjects:number;task:{headline:string;detail:string;action:string;link:string;icon:string}|null;queue:{title:string;count:number;subject:string;link:string}[];review_link:string|null;deadlines:{title:string;deadline:string;subject:string;link:string}[];
  totals:{subjects:number;students:number;to_grade:number;needs_review:number;drafts:number}}

export function FacultyHome(){
  const here=useHere();
  const query=useQuery({queryKey:['dashboard','faculty'],queryFn:()=>api<FacultyHomeData>('/dashboard/faculty')});
  return <Page query={query}>{d=>{
    return <>
      <h1 className="sr-only">Home</h1>
      <section aria-labelledby="my-subjects-h"><h2 id="my-subjects-h" className="sr-only">Your classes</h2>
        {d.subjects.length===0?<p className="panel muted">No subjects are assigned to you in an open term.</p>:<div className="class-grid">{d.subjects.map(s=>{
          const o=`/faculty/offerings/${s.offering_id}`;const drafts=s.drafts_content+s.drafts_assessments;
          return <SubjectCard key={s.offering_id} id={s.offering_id} title={s.title} section={s.sections.join(', ')||'No sections'} teacher={d.name} meta={s.to_grade?`${s.to_grade} to grade`:undefined}
            detail={`${plural(s.students,'student')}${s.needs_review?` · ${s.needs_review} to review`:''}${drafts?` · ${plural(drafts,'draft')}`:''}`}
            to={`${o}/stream`} links={[['Classwork',`${o}/classwork`],['Grades',`${o}/gradebook`]]}/>})}</div>}
        <p><Link state={here} className="touch" to="/faculty/subjects">{d.closed_subjects?`All subjects, including ${plural(d.closed_subjects,'past one')}`:'All subjects'}</Link></p></section>
      <div className="dash-grid home-more">
        <div className="dash-main">
          {d.task?<Hero eyebrow="Your next teaching task" title={d.task.headline} detail={d.task.detail} action={d.task.action} to={d.task.link} icon={d.task.icon}/>
            :<Hero eyebrow="Your next teaching task" title="Nothing is waiting for you" detail="No activity submissions to grade, no grades to review and no drafts in progress." icon="✓"/>}
          <Stats items={[[d.totals.subjects,'Assigned subjects in open terms'],[d.totals.students,'Subject enrollments'],[d.totals.to_grade,'Activity submissions to grade',d.queue[0]?.link],[d.totals.needs_review,'Students with grades to review',d.review_link??undefined]]}/>
        </div>
        <div className="dash-side">
          {d.queue.length>0&&<section className="panel"><h2>Activity submissions needing grading</h2><p className="muted">Top 5 by number awaiting grading. <Link state={here} className="touch" to="/faculty/review">See everything to review</Link></p><ul className="rows">{d.queue.map((q,i)=><li key={i}><Link state={here} to={q.link}>{q.title}</Link><span className="muted">{q.subject} · {plural(q.count,'submission')} waiting</span></li>)}</ul></section>}
          <section className="panel"><h2>Upcoming deadlines</h2>
            {d.deadlines.length===0?<p className="muted">No deadlines in the next two weeks.</p>:<ul className="rows">{d.deadlines.map((x,i)=><li key={i}><Link state={here} to={x.link}>{x.title}</Link><span className="muted">{x.subject} · {dateTime(x.deadline)}</span></li>)}</ul>}</section>
          <section className="panel"><h2>Student progress</h2>
            {d.subjects.length===0?<p className="muted">Appears when you have subjects.</p>:<ul className="rows">{d.subjects.map(s=><li key={s.offering_id}><Link state={here} to={`/faculty/offerings/${s.offering_id}/progress`}>{s.code}</Link>
              <span className="muted">{s.average_progress===null?'No completable steps yet':`Average completion ${s.average_progress}%`}{s.quiet_students?` · ${plural(s.quiet_students,'enrolled student')} with no recorded learning activity in the last 7 days`:''}</span></li>)}</ul>}
            <p className="muted">Average completion is the mean of each student’s completed steps out of the steps that apply to them. “No recorded activity” counts lesson completions and submissions only: it is not attendance, effort or risk, and it is not a grade.</p></section>
          <section className="panel"><h2>Prepare for your class</h2><p className="muted">Create learning content or an assessment inside one of your subjects.</p>
            <Link state={here} className="button" to="/faculty/subjects">Choose a subject</Link></section>
        </div>
      </div></>;
  }}</Page>;
}

// ---------------------------------------------------------------- admin
interface AdminHomeData{name:string;setup:{key:string;label:string;done:boolean;link:string}[];terms:{id:string;name:string;school_year:string;sections:number;offerings:number;students:number}[];
  accounts:{students:number;faculty:number;admins:number;invited:number;inactive:number};subjects:number;pending_imports:number;issues:{open:number;in_progress:number};
  recent_activity:{action:string;who:string;at:string}[]}
const ACTION_LABEL:Record<string,string>={'account.invited':'Invitation sent','account.activated':'Account activated','account.status_changed':'Access changed','account.bootstrapped':'Administrator created','account.handed_over':'Ownership transferred','account.handover_initiated':'Ownership transfer started','account.link_sent':'Sign-in link sent','account.password_reset':'Password reset'};

export function AdminHome(){
  const here=useHere();
  const query=useQuery({queryKey:['dashboard','admin'],queryFn:()=>api<AdminHomeData>('/dashboard/admin')});
  return <Page query={query}>{d=>{
    const attention=d.issues.open?{t:`${plural(d.issues.open,'open report')} to review`,s:'Students and teachers are waiting for a reply.',a:'Review reports',to:'/admin/issues'}
      :d.accounts.invited?{t:`${plural(d.accounts.invited,'invitation')} not accepted yet`,s:'These people cannot sign in until they accept their invitation.',a:'Review accounts',to:'/admin/accounts?status=invited'}
      :d.pending_imports?{t:`${plural(d.pending_imports,'student import')} waiting to be confirmed`,s:'A previewed file has not been committed.',a:'Open school years',to:'/admin/academics'}:null;
    return <>
      <Heading eyebrow="Admin dashboard" title="Your academic workspace." line="Manage the academic year, students, teachers and accounts."/>
      <div className="dash-grid">
        <div className="dash-main">
          {d.setup.length>0&&<section className="panel"><h2>Get started</h2><p className="muted">Set up in this order. Finished steps are ticked.</p>
            <ol className="rows">{d.setup.map(x=><li key={x.key}>{x.done?<span><span aria-hidden="true">✓ </span>{x.label}<span className="sr-only"> (done)</span></span>:<Link state={here} to={x.link}>{x.label}</Link>}</li>)}</ol></section>}
          <section className="panel"><h2>Academic management</h2><div className="actions">
            <Link state={here} className="button primary" to="/admin/academics">School years and terms</Link><Link state={here} className="button" to="/admin/subjects">Prospectus</Link>
            <Link state={here} className="button" to="/admin/subjects/import">Import a prospectus</Link></div></section>
          {attention?<Hero eyebrow="Needs your attention" title={attention.t} detail={attention.s} action={attention.a} to={attention.to} icon="!"/>
            :<Hero eyebrow="Needs your attention" title="Nothing needs attention" detail="No open reports, pending invitations or unconfirmed imports." icon="✓"/>}
          <Stats items={[[d.accounts.students,'Active students'],[d.accounts.faculty,'Active faculty'],[d.accounts.inactive,'Inactive accounts'],[d.subjects,'Subjects in the catalog']]}/>
          <section className="panel"><h2>Open terms</h2>
            {d.terms.length===0?<p className="muted">No term is open. Create a school year and its terms in academic setup.</p>:
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Open terms"><table><thead><tr><th>Term</th><th>Sections</th><th>Offerings</th><th>Students</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>
                {d.terms.map(t=><tr key={t.id}><td>{t.name}<br/><span className="muted">{t.school_year}</span></td><td>{t.sections}</td><td>{t.offerings}</td><td>{t.students}</td><td><Link state={here} to={`/admin/terms/${t.id}`}>Open</Link></td></tr>)}</tbody></table></div>}</section>
        </div>
        <div className="dash-side">
          <section className="panel"><h2>Recent account activity</h2>
            {d.recent_activity.length===0?<p className="muted">No account activity yet.</p>:<ul className="rows updates">{d.recent_activity.map((a,i)=><li key={i}><strong>{ACTION_LABEL[a.action]??a.action.replace('account.','').replace(/_/g,' ')}</strong><span className="muted">{a.who} · {dateTime(a.at)}</span></li>)}</ul>}</section>
          <section className="panel"><h2>Reports</h2><p className="muted">{plural(d.issues.open,'open report')}{d.issues.in_progress?`, ${d.issues.in_progress} being looked at`:''}.</p><Link state={here} className="button" to="/admin/issues">Open reports</Link></section>
        </div>
      </div></>;
  }}</Page>;
}

const TODO_TABS=[['assigned','Assigned'],['missing','Missing'],['done','Done']] as const;
const WEEK=7*864e5;
/** The end of this week (Sunday night, local time). */
function endOfWeek(now:number){const d=new Date(now);d.setHours(23,59,59,999);return d.getTime()+((7-d.getDay())%7)*864e5}

/** Classroom's To-do: Assigned (by when it is due), Missing (late work still accepted) and Done (submitted). */
export function StudentTodo(){
  const here=useHere();
  const [params]=useSearchParams();
  const tab=TODO_TABS.find(t=>t[0]===params.get('tab'))?.[0]??'assigned';
  const query=useQuery({queryKey:['todo','student'],queryFn:()=>api<{todo:Work[];awaiting_feedback:Work[];another_attempt:Work[]}>('/dashboard/student/todo')});
  const row=(w:Work,note:string)=><li key={w.assessment_id} data-cat={w.kind==='online_quiz'?'quiz':'activity'}><span className="grow"><Link state={here} to={workLink(w)}>{w.title}</Link><span className="muted">{w.subject} · {w.kind==='online_quiz'?'Quiz':'Activity'} · {note}</span></span></li>;
  const group=(title:string,hint:string,items:Work[],note:(w:Work)=>string)=><section className="tree d0" key={title}><header><h2>{title}</h2><span className="count">{items.length}</span></header>{hint&&<p className="muted">{hint}</p>}
    <ul className="seq compact">{items.map(w=>row(w,note(w)))}</ul></section>;
  return <>
    <div className="page-heading"><div><h1>To-do</h1><p className="muted">Quizzes and activities from every current subject.</p></div></div>
    <Page query={query}>{d=>{
      const now=Date.now();const past=(w:Work)=>!!w.deadline&&Date.parse(w.deadline)<now;
      const missing=d.todo.filter(past),assigned=d.todo.filter(w=>!past(w)),done=[...d.another_attempt,...d.awaiting_feedback];
      const counts={assigned:assigned.length,missing:missing.length,done:done.length};
      const thisWeek=endOfWeek(now);
      const bucket=(w:Work)=>!w.deadline?'No due date':Date.parse(w.deadline)<=thisWeek?'This week':Date.parse(w.deadline)<=thisWeek+WEEK?'Next week':'Later';
      const due=(w:Work)=>w.state==='not_open'&&w.available_from?`opens ${dateTime(w.available_from)}`:w.deadline?`due ${dateTime(w.deadline)}`:'no deadline';
      const pastNote=(w:Work)=>`was due ${dateTime(w.deadline!)}${w.late_allowed?' · late submission allowed':''}`;
      const doneNote=(w:Work)=>d.another_attempt.includes(w)?`${plural(w.attempts_left??0,'attempt')} left, you can try again`:'submitted, awaiting feedback';
      const everything=counts.assigned+counts.missing+counts.done===0;
      return <>
        <nav className="tabs" aria-label="To-do sections">{TODO_TABS.map(([k,l])=><Link key={k} to={`?tab=${k}`} replace className={tab===k?'active':undefined} aria-current={tab===k?'page':undefined}>{l}{counts[k]>0&&<span className="tab-count">{counts[k]}</span>}</Link>)}</nav>
        {everything&&<section className="panel"><h2>You’re up to date</h2><p className="muted">Nothing needs your action. New work appears here when your teacher publishes it.</p><Link state={here} className="button" to="/student/subjects">See my subjects</Link></section>}
        {!everything&&tab==='assigned'&&(assigned.length===0?<p className="muted">Nothing is assigned right now.</p>
          :(['No due date','This week','Next week','Later'] as const).map(b=>{const items=assigned.filter(w=>bucket(w)===b);return items.length>0&&group(b,'',items,due)}))}
        {!everything&&tab==='missing'&&(missing.length===0?<p className="muted">Nothing is missing. Overdue work shows here only while your teacher still accepts it late.</p>:group('Past due','Your teacher still accepts these late.',missing,pastNote))}
        {!everything&&tab==='done'&&(done.length===0?<p className="muted">Nothing is done yet.</p>:group('Done','Submitted work, and quizzes you can try again.',done,doneNote))}
      </>}}</Page>
  </>;
}
