import {Link,useOutletContext,useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../app/api';
import type {OfferingSummary} from '../academics/types';
import {KIND_LABEL,fmt,when,type Assessment} from './types';

/** A teacher's page for one assigned item: its instructions and how many students are where. The counts open the student work page on that group. */
export function AssessmentHub(){
  const {offering}=useOutletContext<{offering:OfferingSummary}>();
  const {assessmentId}=useParams();
  const base=`/faculty/offerings/${offering.id}`;
  const query=useQuery({queryKey:['assessment',assessmentId],queryFn:()=>api<Assessment>(`/teach/offerings/${offering.id}/assessments/${assessmentId}`)});
  const list=useQuery({queryKey:['assessments',offering.id],queryFn:()=>api<(Assessment&{counts?:{total:number;graded:number;turned_in:number;assigned:number;to_return:number}})[]>(`/teach/offerings/${offering.id}/assessments`)});
  if(query.isPending||list.isPending)return <p>Loading…</p>;
  const a=query.data;const rev=a?.published;
  if(query.error||!a||!rev)return <section className="panel"><h2>Not available</h2><p role="alert">{query.error?.message??'This has not been published yet.'}</p><Link to={`${base}/classwork`}>Back to classwork</Link></section>;
  const counts=list.data?.find(x=>x.id===a.id)?.counts;
  const link=(status:string)=>`${base}/assessments/${a.id}/scores${status?`?status=${status}`:''}`;
  const stat=(n:number,label:string,status:string)=><Link className="hub-stat" to={link(status)}><strong>{n}</strong><span>{label}</span></Link>;
  return <div className="compose">
    <header className="compose-bar">
      <Link className="icon-btn" to={`${base}/classwork`} aria-label="Back to Classwork"><span aria-hidden="true">←</span></Link>
      <span className="class-dot compose-icon" style={{background:'var(--action)',color:'var(--action-text)'}} aria-hidden="true">{a.kind==='online_quiz'?'?':a.kind==='activity'?'✎':'✱'}</span>
      <h1>{rev.title}</h1>
      <span className="compose-actions"><Link className="button" to={`${base}/assessments/${a.id}/edit`}>Edit</Link><Link className="button primary" to={link('')}>View student work</Link></span>
    </header>
    <p className="muted">{KIND_LABEL[a.kind]} · {rev.deadline?`Due ${when(rev.deadline)}`:'No due date'} · {rev.include_in_grade?`${fmt(rev.max_points)} points`:'Ungraded'}</p>
    <div className="compose-grid">
      <div className="compose-main"><section className="panel"><h2>Instructions</h2>{rev.instructions?<p className="pre">{rev.instructions}</p>:<p className="muted">No instructions.</p>}</section>
        {rev.attachments&&rev.attachments.length>0&&<section className="panel"><h2>Attachments</h2><ul className="rows">{rev.attachments.map(x=><li key={x.id}>{x.kind==='file'&&x.file?<a href={`/api/files/${x.file.id}/download`}>{x.title}</a>:<a href={x.url??'#'} target="_blank" rel="noopener noreferrer">{x.title}</a>}<span className="muted">{x.kind==='file'?x.file?.name:x.url}</span></li>)}</ul></section>}</div>
      <aside className="compose-side panel" aria-label="Student work"><h2>Student work</h2>
        {counts?<div className="hub-stats">{stat(counts.turned_in,'Turned in','turned_in')}{stat(counts.assigned,'Assigned','assigned')}{stat(counts.graded,'Graded','graded')}</div>:<p className="muted">Counts are not available.</p>}
        {counts&&counts.to_return>0&&<p className="muted">{counts.to_return} scored but not returned yet.</p>}
      </aside>
    </div>
  </div>;
}
