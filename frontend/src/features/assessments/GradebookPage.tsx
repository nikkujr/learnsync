import {useToast} from '../../components/undo';
import {useRef,useState} from 'react';
import {Link,useOutletContext} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ApiError,api,post,send,errorText} from '../../app/api';
import {queryClient} from '../../app/providers';
import {Dialog} from '../../components/Dialog';
import {initials} from '../../components/classes';
import {useHere,type Origin} from '../../components/origin';
import type {OfferingSummary} from '../academics/types';
import {PERIOD_LABEL,fmt,type Cell,type Gradebook,type GradeRow} from './types';

interface Publication{published:number;unchanged:number;pending:{student_id:string;student:string;reasons:string[]}[]}
interface Stats{ready:number;changes:number;unchanged:number;review:number;notReady:string[]}

/** What publishing a period would do, from the working values the page already has. */
export function periodStats(book:Gradebook,period:string):Stats{
  const ready=book.rows.filter(r=>r.grades[period]?.grade!=null);
  const changes=ready.filter(r=>{const p=r.published[period];return !p||p.needs_review||Number(p.grade)!==Number(r.grades[period]!.grade)});
  return {ready:ready.length,changes:changes.length,unchanged:ready.length-changes.length,
    review:book.rows.filter(r=>r.published[period]?.needs_review).length,
    notReady:book.rows.filter(r=>r.grades[period]?.grade==null).map(r=>r.display_name)};
}
const cellKey=(columnId:string,studentId:string)=>`${columnId}:${studentId}`;

export function GradebookPage(){
  const {offering}=useOutletContext<{offering:OfferingSummary}>();
  const closed=offering.term_status==='closed';
  const here=useHere();
  const query=useQuery({queryKey:['gradebook',offering.id],queryFn:()=>api<Gradebook>(`/teach/offerings/${offering.id}/gradebook`)});
  const [detail,setDetail]=useState<GradeRow|null>(null);
  const [publishing,setPublishing]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const [find,setFind]=useState('');const [section,setSection]=useState('');const [only,setOnly]=useState('');   // view filters: they never change what Publish acts on
  const [edits,setEdits]=useState<Record<string,string>>({});          // cellKey -> typed score, only for cells that differ
  const [rejected,setRejected]=useState<Record<string,string>>({});    // cellKey -> why the server refused it
  const [saving,setSaving]=useState(false);
  const inflight=useRef(new Set<string>());                              // a cell being saved is not saved twice (Enter and leaving the cell both commit)
  const refresh=()=>queryClient.invalidateQueries({queryKey:['gradebook',offering.id]});

  if(query.isPending)return <p>Loading gradebook…</p>;
  if(query.error){
    const code=query.error instanceof ApiError?query.error.code:'';
    return <section className="panel"><h2>The gradebook is not ready</h2><p role="alert">{query.error.message}</p>
      {(code==='policy_missing'||code==='policy_incomplete')&&<Link className="button primary" to={`/faculty/offerings/${offering.id}/syllabus`}>Open the syllabus</Link>}</section>;
  }
  const book=query.data;
  const periods=[...book.policy.periods.map(p=>p.key),'course'];
  const shown=periods.filter(p=>!only||p==='course'||p===only);
  const sections=[...new Set(book.rows.map(r=>r.section).filter((s):s is string=>!!s))].sort();
  const rows=book.rows.filter(r=>(!section||r.section===section)&&`${r.display_name} ${r.student_number}`.toLowerCase().includes(find.trim().toLowerCase()));
  const byPeriod=(period:string)=>book.columns.filter(c=>c.period===period);
  const label=(key:string|null)=>book.policy.categories.find(c=>c.key===key)?.label??key??'';
  const stats=Object.fromEntries(periods.map(p=>[p,periodStats(book,p)])) as Record<string,Stats>;
  const next=periods.find(p=>stats[p].changes>0);
  const courseUnlocked=book.policy.periods.every(p=>book.rows.some(r=>r.published[p.key]));
  const flaggedRows=book.rows.filter(r=>Object.values(r.published).some(p=>p.needs_review));
  const editing=!closed;                                                  // like Classroom: type straight into a cell; a closed term is read-only

  const editable=(kind:string,cell?:Cell)=>!!cell&&!(kind==='online_quiz'&&cell.attempt_state==='submitted');
  function typeScore(column:string,student:string,original:Cell,value:string){
    const key=cellKey(column,student);const before=original.score===null?'':String(original.score);
    setEdits(prev=>{const n={...prev};if(value.trim()===before.trim())delete n[key];else n[key]=value;return n});
    setRejected(prev=>{if(!prev[key])return prev;const n={...prev};delete n[key];return n});
  }
  /** Save one typed cell (working score only: students see it after Return). The server still checks the cell's revision, so a colleague's change is reported, not overwritten. */
  async function commit(columnId:string,studentId:string){
    const key=cellKey(columnId,studentId);const value=edits[key];
    if(value===undefined||inflight.current.has(key))return;
    const cell=book.rows.find(r=>r.student_id===studentId)!.cells[columnId];
    inflight.current.add(key);setSaving(true);setMessage('');
    try{await send('PUT',`/teach/offerings/${offering.id}/gradebook/scores`,{cells:[{assessment_id:columnId,student_id:studentId,score:value.trim()===''?null:value.trim(),feedback:cell.feedback,expected_revision:cell.revision}]});
      setEdits(prev=>{const n={...prev};delete n[key];return n});setRejected(prev=>{if(!prev[key])return prev;const n={...prev};delete n[key];return n});
      setMessage('Saved. Students see scores only after you return them.');await refresh()}
    catch(e){
      if(e instanceof ApiError&&e.code==='batch_rejected'){setRejected(prev=>({...prev,...e.fields}));setMessage('A colleague changed this score first. Their value is shown; your typed value is kept (Esc undoes it).');await refresh()}
      else setMessage(errorText(e));
    }finally{inflight.current.delete(key);setSaving(false)}
  }
  const focusCell=(col:string,row:number)=>{document.querySelector<HTMLInputElement>(`input.score-input[data-col="${col}"][data-row="${row}"]`)?.focus()};
  const revert=(columnId:string,studentId:string)=>{const key=cellKey(columnId,studentId);setEdits(prev=>{const n={...prev};delete n[key];return n});setRejected(prev=>{if(!prev[key])return prev;const n={...prev};delete n[key];return n})};

  const periodRow=(p:string)=><li key={p}><span className="grow"><strong>{PERIOD_LABEL[p]??p}</strong>
    <span className="muted">{stats[p].changes>0?`${stats[p].changes} ready to publish`:stats[p].ready>0?'Nothing new to publish':'No grades are ready yet'}{stats[p].review>0?` · ${stats[p].review} need review`:''}{stats[p].notReady.length>0&&stats[p].ready>0?` · ${stats[p].notReady.length} not ready`:''}</span></span>
    <button className={p===next?'primary':''} disabled={closed||stats[p].ready===0||(p==='course'&&!courseUnlocked)} title={p==='course'&&!courseUnlocked?'Publish Midterm and Finals first':undefined} onClick={()=>setPublishing(p)}>Publish {PERIOD_LABEL[p]??p}…</button></li>;

  return <>
    <div className="page-heading"><div><h2>Gradebook</h2>
      <p className="muted">Working values: students see only the results you return and the grades you publish. Policy version {book.policy_version} · {book.policy.transmutation==='transmuted'?'transmuted':'raw'} scores · passing {book.policy.passing}.</p></div></div>
    {message&&<p role="status">{message}</p>}

    <section className="panel" aria-labelledby="pub-h"><h3 id="pub-h">Ready to publish</h3>
      {next?<ul className="rows">{periodRow(next)}</ul>:<p className="muted">{periods.some(p=>stats[p].ready>0)?'Everything that is ready has been published.':'No grades are ready yet. They appear when all graded work for a period is scored.'}</p>}
      <details className="more"><summary>All periods{flaggedRows.length>0?` · ${flaggedRows.length} need review`:''}</summary>
        <ul className="rows">{periods.filter(p=>p!==next).map(periodRow)}</ul>
        {periods.includes('course')&&!courseUnlocked&&<p className="muted">The Course grade unlocks once Midterm and Finals have each been published.</p>}
        {flaggedRows.length>0&&<><p className="warn" role="status">{flaggedRows.length} student{flaggedRows.length===1?' has':'s have'} a published grade that needs your review because working data changed. Students keep seeing the last published grade until you republish.</p>
          <ul className="rows" aria-label="Grades needing review">{flaggedRows.map(r=><li key={r.student_id}><span className="grow"><strong>{r.display_name}</strong><span className="muted">{Object.entries(r.published).filter(([,p])=>p.needs_review).map(([k,p])=>`${PERIOD_LABEL[k]??k}: ${p.review_reason??'working data changed'}`).join(' · ')}</span></span><button onClick={()=>setDetail(r)}>Review</button></li>)}</ul></>}
      </details></section>

    <section className="panel"><h3>Scores and grades</h3>
      <details className="more"><summary>How to read this table</summary><p className="muted">— means pending (not scored yet). 0.00 is a real recorded zero. “Unreleased change” means the student still sees an older result. Grades and ranks to share or download are on the Class standing tab.</p></details>
      <details className="more"><summary>Filter students</summary>
        <div className="actions"><label>Find a student<input type="search" value={find} onChange={e=>setFind(e.target.value)} placeholder="Name or student number"/></label>
          <label>Section<select value={section} onChange={e=>setSection(e.target.value)}><option value="">All sections</option>{sections.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
          <label>Period<select value={only} onChange={e=>setOnly(e.target.value)}><option value="">All periods</option>{book.policy.periods.map(p=><option key={p.key} value={p.key}>{PERIOD_LABEL[p.key]??p.key}</option>)}</select></label></div></details>
      <p className="muted" role="status">Showing {rows.length} of {book.rows.length} students.{closed?' This term is closed, so scores are read-only.':' Type a score in any cell: it saves when you press Enter or leave the cell. Enter moves down, Tab moves across, Esc undoes.'}{saving?' Saving…':''}</p>
      <div className="table-wrap gradebook" role="region" aria-label="Gradebook, scrolls sideways" tabIndex={0}><table>
        <thead>
          <tr><th className="sticky">Student</th>{shown.filter(p=>p!=='course').map(p=><th key={p} colSpan={byPeriod(p).length+1}>{PERIOD_LABEL[p]??p}</th>)}<th>Course</th></tr>
          <tr><th className="sticky"><span className="sr-only">Student</span></th>
            {shown.filter(p=>p!=='course').flatMap(p=>[...byPeriod(p).map(c=><th key={c.id}><Link state={here} to={`/faculty/offerings/${offering.id}/assessments/${c.id}/scores`} title="Open this assessment's scores and attempts">{c.title}</Link><br/><span className="muted">Out of {fmt(c.max_points)}</span><br/><span className="muted">{label(c.category_key)}</span></th>),<th key={p+'g'}>Grade</th>])}
            <th>Grade</th></tr></thead>
        <tbody>{rows.map((r,rowIndex)=><tr key={r.student_id}>
          <th className="sticky" scope="row"><span className="person-cell"><span className="avatar" aria-hidden="true">{initials(r.display_name)}</span><span><button className="linklike" onClick={()=>setDetail(r)}>{r.display_name}</button><br/><span className="muted">{r.section??''}{r.grades.course?.grade!=null?` · Overall ${fmt(r.grades.course.grade)}`:''}</span></span></span></th>
          {shown.filter(p=>p!=='course').flatMap(p=>[...byPeriod(p).map(c=><td key={c.id}><CellView cell={r.cells[c.id]} kind={c.kind} deadline={c.deadline} column={c.title} student={r.display_name} editing={editing&&editable(c.kind,r.cells[c.id])} value={edits[cellKey(c.id,r.student_id)]} problem={rejected[cellKey(c.id,r.student_id)]}
            onType={v=>typeScore(c.id,r.student_id,r.cells[c.id],v)} nav={{col:c.id,row:rowIndex}}
            onCommit={()=>void commit(c.id,r.student_id)} onRevert={()=>revert(c.id,r.student_id)} onMove={d=>focusCell(c.id,rowIndex+d)}/></td>),
            <td key={p+'g'}><GradeCell row={r} period={p} onReview={setDetail}/></td>])}
          <td><GradeCell row={r} period="course" onReview={setDetail}/></td></tr>)}</tbody></table></div></section>

    {detail&&<DetailDialog row={detail} here={here} base={`/faculty/offerings/${offering.id}`} onClose={()=>setDetail(null)}/>}
    {publishing&&<PublishDialog offeringId={offering.id} period={publishing} stats={stats[publishing]} onClose={()=>setPublishing(null)} onPublished={refresh}/>}
  </>;
}

function PublishDialog({offeringId,period,stats,onClose,onPublished}:{offeringId:string;period:string;stats:Stats;onClose:()=>void;onPublished:()=>void}){
  const [result,setResult]=useState<Publication|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const name=PERIOD_LABEL[period]??period;const toast=useToast();
  async function go(){setBusy(true);setError('');
    try{setResult(await post<Publication>(`/teach/offerings/${offeringId}/grades/publish`,{period}));toast(`${name} grades published.`);onPublished()}
    catch(e){setError(errorText(e))}finally{setBusy(false)}}
  if(result)return <Dialog title={`${name} grades published`} onClose={onClose}>
    <p role="status">{result.published} published · {result.unchanged} unchanged · {result.pending.length} not ready.</p>
    {result.pending.length>0&&<><h3>Not ready</h3><ul>{result.pending.map(p=><li key={p.student_id}><strong>{p.student}</strong>: {p.reasons.join('; ')}</li>)}</ul></>}
    <div className="actions"><button className="primary" onClick={onClose}>Done</button></div></Dialog>;
  return <Dialog title={`Review and publish ${name}`} onClose={onClose}>
    <p>Students see these grades <strong>immediately</strong>. The table filters do not limit this: it covers every ready student in this subject, across all sections.</p>
    <ul className="rows"><li><strong>{stats.changes}</strong><span className="muted">grade{stats.changes===1?'':'s'} will be published or updated</span></li>
      <li><strong>{stats.unchanged}</strong><span className="muted">already published and unchanged</span></li>
      <li><strong>{stats.notReady.length}</strong><span className="muted">not ready, so skipped{stats.notReady.length>0?`: ${stats.notReady.slice(0,5).join(', ')}${stats.notReady.length>5?', …':''}`:''}</span></li></ul>
    <p className="muted">Publishing never changes results you already returned for individual assessments.</p>
    {error&&<p role="alert">{error}</p>}
    <div className="actions"><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy||stats.changes===0} onClick={go}>{busy?'Publishing…':stats.changes===0?'Nothing new to publish':`Publish ${stats.changes} grade${stats.changes===1?'':'s'}`}</button></div></Dialog>;
}

function CellView({cell,kind,deadline,column,student,editing,value,problem,onType,nav,onCommit,onRevert,onMove}:{cell?:Cell;kind:string;deadline?:string|null;column:string;student:string;editing:boolean;value?:string;problem?:string;onType:(v:string)=>void;nav:{col:string;row:number};onCommit:()=>void;onRevert:()=>void;onMove:(delta:number)=>void}){
  if(!cell)return <span className="muted" title="Does not apply to this student's section">n/a</span>;
  const state=kind==='online_quiz'&&cell.score===null?(cell.attempt_state==='in_progress'?'In progress':'Not attempted'):null;
  const shownValue=value??(cell.score===null?'':String(cell.score));
  // the state shows as a colour-coded icon beside the score (see Flag); the score text itself stays plain
  const handedIn=kind==='online_quiz'?cell.attempt_state==='submitted':!!cell.turned_in;
  const missing=!cell.excused&&cell.score===null&&!handedIn&&(kind==='activity'||kind==='online_quiz')&&!!deadline&&Date.parse(deadline)<Date.now();
  return <div className="cell score-cell">
    {editing?<input className="score-input" inputMode="decimal" data-col={nav.col} data-row={nav.row} aria-label={`${column}, score for ${student}`} aria-invalid={!!problem} value={shownValue} placeholder="—" onChange={e=>onType(e.target.value)} onBlur={onCommit}
        onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='Enter'){e.preventDefault();onCommit();onMove(e.shiftKey?-1:1)}else if(e.key==='Escape'){e.preventDefault();onRevert()}}}/>
      :<span>{cell.score===null?'—':fmt(cell.score)}</span>}
    {problem&&<span className="error" role="alert"> {problem}</span>}
    {state&&!missing&&<Flag tone="muted" icon={state==='In progress'?'clock':'circle'} text={state==='In progress'?'In progress: the student has started but not submitted.':'Not attempted: the student has not started this quiz.'}/>}
    {missing&&<Flag tone="danger" icon="alert" text="Missing: past due and not turned in."/>}
    {cell.score===null&&handedIn&&<Flag tone="success" icon="check" text="Turned in: waiting for a score."/>}
    {cell.excused&&<Flag tone="muted" icon="minus" text="Excused: left out of the grade."/>}
    {cell.unreleased_change&&!cell.excused&&<Flag tone="warning" icon="pencil" text="Unreleased change: the student still sees the older result."/>}</div>;
}

// Material-style 24px glyphs; the message shows on hover (title) and is read out by screen readers (aria-label). Not focusable, so Tab keeps moving between score cells.
const FLAGS:Record<string,string>={
  alert:'M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  check:'M12 2a10 10 0 100 20 10 10 0 000-20zm-2 15l-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z',
  clock:'M12 2a10 10 0 100 20 10 10 0 000-20zm.5 5v5.2l4.5 2.7-.8 1.3L11 13V7h1.5z',
  circle:'M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z',
  minus:'M12 2a10 10 0 100 20 10 10 0 000-20zm5 11H7v-2h10v2z',
  pencil:'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'};
function Flag({tone,icon,text}:{tone:'danger'|'success'|'warning'|'muted';icon:string;text:string}){
  return <span className={`flag ${tone}`} role="img" aria-label={text} title={text}><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d={FLAGS[icon]}/></svg></span>;
}

function GradeCell({row,period,onReview}:{row:GradeRow;period:string;onReview:(r:GradeRow)=>void}){
  const g=row.grades[period];const p=row.published[period];
  return <div className="cell">
    <strong>{g?.grade===null||g?.grade===undefined?'Pending':fmt(g.grade)}</strong>
    {p&&<><br/><span className="muted">Published {fmt(p.grade)} (v{p.release_number})</span>{p.needs_review&&<button className="badge linklike" onClick={()=>onReview(row)} aria-label={`Needs review: ${row.display_name}, open details`}>Needs review</button>}</>}</div>;
}

function DetailDialog({row,base,here,onClose}:{row:GradeRow;base:string;here:Origin;onClose:()=>void}){
  const flagged=Object.entries(row.published).filter(([,p])=>p.needs_review);
  return <Dialog title={`${row.display_name}: how the grade is calculated`} onClose={onClose}>
    {flagged.length>0&&<div className="warn" role="status">{flagged.map(([k,p])=><p key={k}><strong>{PERIOD_LABEL[k]??k} needs review.</strong> Students see {fmt(p.grade)} (v{p.release_number}); the working grade is now {row.grades[k]?.grade==null?'pending':fmt(row.grades[k]?.grade)}. {p.review_reason??'Working data changed.'}</p>)}<p>Fix anything pending below (links beside each item), then close this and publish that period. Nothing changes for the student until you do.</p></div>}
    {Object.entries(row.grades).filter(([k])=>k!=='course').map(([period,g])=><section key={period}>
      <h3>{PERIOD_LABEL[period]??period}: {g.grade===null?'Pending':fmt(g.grade)}</h3>
      <ul>{g.categories.map(c=><li key={c.key}><strong>{c.label}</strong> ({c.weight}%): {c.status==='ok'?`${fmt(c.percent)}% (${fmt(c.earned)} of ${fmt(c.possible)})`:c.status==='pending'?`Pending: ${c.missing.join('; ')}`:c.missing.join('; ')}{c.status!=='ok'&&<> <Link to={c.key==='attendance'?`${base}/attendance`:`${base}/assessments`}>{c.key==='attendance'?'Open attendance':'Open assessments'}</Link></>}</li>)}</ul>
      {g.grade===null&&<p className="muted">The {PERIOD_LABEL[period]??period} grade cannot be republished until the pending items above are done.</p>}</section>)}
    <p className="muted">Course grade: {row.grades.course?.grade===null?'Pending (both periods must be ready)':fmt(row.grades.course?.grade)}</p>
    <div className="actions"><Link className="button" state={here} to={`${base}/students/${row.student_id}`}>Open full standing</Link><button className="primary" onClick={onClose}>Close</button></div></Dialog>;
}
