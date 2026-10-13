import {useEffect,useState,type FormEvent} from 'react';
import {Link,useNavigate,useOutletContext,useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {api,post,send,errorText} from '../../app/api';
import {queryClient,useAuth} from '../../app/providers';
import {catOfKind} from '../../components/ClassworkTypes';
import {useConfirm} from '../../components/confirm';
import {Dialog} from '../../components/Dialog';
import {useUndo} from '../../components/undo';
import type {OfferingSummary} from '../academics/types';
import {DraftNotices,SaveIndicator,draftKey,useAutosave,useFlushOnLeave} from '../teaching/autosave';
import {nodeLabels,type SyllabusState} from '../teaching/types';
import {usePolicy} from './Assessments';
import {QuestionList} from './QuestionEditor';
import {KIND_LABEL,toIso,toLocal,type Assessment,type AssessmentRev,type DraftContent,type Question} from './types';

const toContent=(r:AssessmentRev):DraftContent=>({title:r.title,instructions:r.instructions,category_key:r.category_key??'',period:r.period??'',max_points:String(r.max_points??0),available_from:toLocal(r.available_from),deadline:toLocal(r.deadline),allow_late:r.allow_late,requires_file:r.requires_file??true,max_attempts:r.max_attempts,score_rule:r.score_rule,include_in_grade:r.include_in_grade,anchor_node_id:r.anchor_node_id,questions:r.questions});
const toPayload=(v:DraftContent,counter:number)=>({expected_counter:counter,title:v.title,instructions:v.instructions,category_key:v.category_key||null,period:v.period||null,max_points:v.max_points||'0',available_from:toIso(v.available_from),deadline:toIso(v.deadline),allow_late:v.allow_late,requires_file:v.requires_file,max_attempts:v.max_attempts,score_rule:v.score_rule,include_in_grade:v.include_in_grade,anchor_node_id:v.anchor_node_id,questions:v.questions.map(q=>({...q,points:String(q.points||0)}))});

export function AssessmentEditorPage(){
  const {offering}=useOutletContext<{offering:OfferingSummary}>();
  const {assessmentId}=useParams();
  const closed=offering.term_status==='closed';
  const base=`/teach/offerings/${offering.id}/assessments/${assessmentId}`;
  const query=useQuery({queryKey:['assessment',assessmentId],queryFn:()=>api<Assessment>(base)});
  const [starting,setStarting]=useState(false);
  const item=query.data;
  const back=`/faculty/offerings/${offering.id}/classwork${item?`?type=${catOfKind(item.kind)}`:''}`;      // return to the pill this belongs to
  const needsDraft=!!item&&!item.draft&&!closed;
  useEffect(()=>{
    if(!needsDraft||starting)return;
    setStarting(true);
    post(`${base}/draft`,{}).then(()=>query.refetch()).finally(()=>setStarting(false));
  },[needsDraft]); // eslint-disable-line react-hooks/exhaustive-deps
  if(query.isPending)return <p>Loading…</p>;
  if(query.error||!item)return <section className="panel"><h2>Assessment unavailable</h2><p role="alert">{query.error?.message}</p><Link to={back}>Back to classwork</Link></section>;
  if(!item.draft)return closed?<section className="panel"><p className="back"><Link to={back}>← Classwork</Link></p><h2>{item.published?.title}</h2><p className="muted">This term is closed, so it cannot be edited.</p></section>:<p>Preparing a draft…</p>;
  return <Editor key={item.draft.version} offering={offering} assessment={item} refetch={()=>query.refetch()}/>;
}

const SCORED_BY_TEACHER=['exam','offline_quiz','manual'];
const PASTE_EXAMPLE=`Q: Which of these is a legal business structure?
A) Sole proprietorship
B) Hobby
C) Rumor
D) Fad
Answer: A
Points: 2
Why: A sole proprietorship is owned by one person.

Q: A sole proprietor has unlimited liability.
Answer: True

Q: Name the simplest form of business.
Answer: Sole proprietorship | one-person firm`;

interface Parsed{questions:Question[];errors:{line:number;message:string}[]}
/** Many questions at once from plain text: a preview first, nothing is added until the teacher says so. */
function PasteQuestions({offeringId,locked,onAdd}:{offeringId:string;locked:boolean;onAdd:(q:Question[])=>void}){
  const [text,setText]=useState('');const [parsed,setParsed]=useState<Parsed|null>(null);const [problem,setProblem]=useState('');
  async function preview(){setProblem('');try{setParsed(await post<Parsed>(`/teach/offerings/${offeringId}/assessments/parse-questions`,{text}))}catch(e){setProblem(errorText(e))}}
  return <details className="panel"><summary><strong>Paste many questions at once</strong></summary>
    <p className="muted">Write or paste questions in plain text, separated by a blank line. Choices (A, B, C…) make a multiple-choice question, an answer of True or False makes a true/false question, anything else is short answer (separate accepted answers with |). You see a preview before anything is added.</p>
    <pre className="code" aria-label="Example format">{PASTE_EXAMPLE}</pre>
    <label>Questions<textarea rows={10} value={text} disabled={locked} onChange={e=>{setText(e.target.value);setParsed(null)}}/></label>
    <div className="actions"><button type="button" disabled={locked||!text.trim()} onClick={preview}>Preview</button></div>
    {problem&&<p role="alert">{problem}</p>}
    {parsed&&<div role="status"><p><strong>{parsed.questions.length} question{parsed.questions.length===1?'':'s'} ready</strong>{parsed.errors.length>0?`, ${parsed.errors.length} with a problem (skipped)`:''}.</p>
      {parsed.errors.length>0&&<ul className="rows">{parsed.errors.map((e,i)=><li key={i} className="error">Line {e.line}: {e.message}</li>)}</ul>}
      <button type="button" className="primary" disabled={parsed.questions.length===0} onClick={()=>{onAdd(parsed.questions);setText('');setParsed(null)}}>Add {parsed.questions.length} question{parsed.questions.length===1?'':'s'}</button></div>}
  </details>;
}

function Editor({offering,assessment,refetch}:{offering:OfferingSummary;assessment:Assessment;refetch:()=>void}){
  const ask=useConfirm();const offer=useUndo();
  const draft=assessment.draft!;
  const {session}=useAuth();
  const navigate=useNavigate();
  const {policy}=usePolicy(offering.id);
  const syllabus=useQuery({queryKey:['syllabus',offering.id],queryFn:()=>api<SyllabusState>(`/teach/offerings/${offering.id}/syllabus`)});
  const outline=syllabus.data?.published?.outline??syllabus.data?.draft?.outline;
  const nodes=outline?nodeLabels(outline):[];
  const base=`/teach/offerings/${offering.id}/assessments/${assessment.id}`;
  const back=`/faculty/offerings/${offering.id}/classwork?type=${catOfKind(assessment.kind)}`;
  const quiz=assessment.kind==='online_quiz';
  const locked=quiz&&assessment.has_attempts&&!!assessment.published;
  const [message,setMessage]=useState('');
  const [sections,setSections]=useState(assessment.section_ids);
  const [scheduling,setScheduling]=useState(false);
  const [reviewedAt,setReviewedAt]=useState<number|null>(draft.reviewed?draft.counter:null);
  const auto=useAutosave<DraftContent>({storageKey:draftKey(session?.user?.id,offering.id,`assessment-${assessment.id}`),counter:draft.counter,initial:toContent(draft),
    save:(v,counter)=>send<{counter:number}>('PUT',`${base}/draft`,toPayload(v,counter))});
  useFlushOnLeave(auto.status,auto.flush);
  const v=auto.value;const set=(patch:Partial<DraftContent>)=>auto.setValue({...v,...patch});
  const needsReview=!!draft.ai_generated;
  const reviewed=!needsReview||(reviewedAt!==null&&reviewedAt===auto.counter()&&auto.status==='saved');   // any later edit cancels it
  const total=v.questions.reduce((a,q)=>a+(Number(q.points)||0),0);
  const interactive=quiz||assessment.kind==='activity';
  const assignLabel=assessment.published?(interactive?'Update for students':'Update'):SCORED_BY_TEACHER.includes(assessment.kind)?'Add to gradebook':'Assign';

  async function serverDraft(){const fresh=await api<Assessment>(base);if(!fresh.draft)throw new Error('The draft no longer exists.');return {value:toContent(fresh.draft),counter:fresh.draft.counter}}
  async function publish(){
    setMessage('');
    if(!await auto.flush()){setMessage('Resolve the save problem above before publishing.');return}
    try{await post(`${base}/draft/publish`,{expected_counter:auto.counter()});auto.discardRecovered();queryClient.invalidateQueries({queryKey:['assessments',offering.id]});offer('Published.');navigate(back)}
    catch(e){setMessage(errorText(e))}
  }
  async function markReviewed(){
    setMessage('');
    if(!await auto.flush()){setMessage('Resolve the save problem above first.');return}
    try{await post(`${base}/draft/review`,{expected_counter:auto.counter()});setReviewedAt(auto.counter())}catch(e){setMessage(errorText(e))}
  }
  async function discard(){
    const published=!!assessment.published;
    if(!await ask({title:published?'Discard this draft?':'Delete this assessment?',message:published?'The published version stays as it is.':'It was never published.',yes:published?'Discard draft':'Delete',danger:true}))return;
    await auto.flush();
    try{
      if(published)await send('DELETE',`${base}/draft?expected_counter=${auto.counter()}`);else await send('DELETE',base);
      auto.discardRecovered();queryClient.invalidateQueries({queryKey:['assessments',offering.id]});navigate(back);
    }catch(e){setMessage(errorText(e))}
  }
  async function settings(patch:{section_ids?:string[];archived?:boolean}){
    try{await send('PATCH',base,patch);queryClient.invalidateQueries({queryKey:['assessments',offering.id]});refetch()}catch(e){setMessage(errorText(e))}
  }
  async function unpublish(){
    await auto.flush();
    try{
      const view=await post<Assessment>(`${base}/unpublish`,{});
      auto.discardRecovered();await queryClient.invalidateQueries({queryKey:['assessments',offering.id]});
      offer(`“${view.draft?.title||'This'}” is unpublished. Students no longer see it.`,async()=>{
        try{await post(`${base}/draft/publish`,{expected_counter:view.draft!.counter});await queryClient.invalidateQueries({queryKey:['assessments',offering.id]})}catch{/* the draft is still there; the teacher can publish it by hand */}});
      navigate(back);
    }catch(e){setMessage(errorText(e))}
  }
  async function duplicate(){
    setMessage('');
    if(!await auto.flush()){setMessage('Resolve the save problem above first.');return}
    try{const made=await post<{id:string}>(`${base}/duplicate`,{});queryClient.invalidateQueries({queryKey:['assessments',offering.id]});navigate(`/faculty/offerings/${offering.id}/assessments/${made.id}/edit`)}
    catch(e){setMessage(errorText(e))}
  }
  async function leave(){if(await auto.flush())navigate(back);else setMessage('Resolve the save problem above first.')}
  const categories=policy?.categories.filter(c=>c.key!=='attendance')??[];

  const closeMenu=(e:React.MouseEvent<HTMLElement>)=>{(e.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open')};
  const sectionNames=sections.length===0?'All sections':offering.sections.filter(s=>sections.includes(s.id)).map(s=>s.name).join(', ');
  const side=<aside className="compose-side panel" aria-label="Settings">
    <fieldset><legend>For</legend><p className="muted">{sectionNames}. Leave all unchecked for every section.</p>
      {offering.sections.map(s=><label className="inline" key={s.id}><input type="checkbox" checked={sections.includes(s.id)} onChange={e=>{const ids=e.target.checked?[...sections,s.id]:sections.filter(x=>x!==s.id);setSections(ids);void settings({section_ids:ids})}}/> {s.name}</label>)}</fieldset>
    {quiz?<p><strong>Points</strong><br/>{total} (from the questions)</p>:<label>Points<input type="number" min="0" step="0.5" value={v.max_points} onChange={e=>set({max_points:e.target.value})}/></label>}
    {assessment.kind==='activity'&&<label>Students turn in<select value={v.requires_file?'file':'none'} onChange={e=>set({requires_file:e.target.value==='file'})}><option value="file">A PDF file</option><option value="none">Nothing, they mark it done</option></select></label>}
    {interactive&&<label>Due<input type="datetime-local" value={v.deadline} onChange={e=>set({deadline:e.target.value})}/></label>}
    <label>Topic<select value={v.anchor_node_id??''} onChange={e=>set({anchor_node_id:e.target.value||null})}><option value="">No topic</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
    <label className="inline"><input type="checkbox" checked={v.include_in_grade} onChange={e=>set({include_in_grade:e.target.checked})}/> Counts toward the grade</label>
    {v.include_in_grade&&<>
      <label>Grading category<select value={v.category_key} onChange={e=>set({category_key:e.target.value})}><option value="">Choose…</option>{categories.map(c=><option key={c.key} value={c.key}>{c.label} ({c.weight}%)</option>)}</select></label>
      <label>Grading period<select value={v.period} onChange={e=>set({period:e.target.value})}><option value="">Choose…</option>{(policy?.periods??[]).map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label></>}
    {v.include_in_grade&&!policy&&<p className="warn" role="status">No confirmed grading policy yet. Publish a syllabus with one first, or turn off “Counts toward the grade”.</p>}
    <details className="more"><summary>More options</summary>
      {interactive&&<label>Opens (students cannot see it before then)<input type="datetime-local" value={v.available_from} onChange={e=>set({available_from:e.target.value})}/></label>}
      {interactive&&<label className="inline"><input type="checkbox" checked={v.allow_late} onChange={e=>set({allow_late:e.target.checked})}/> Accept late work after the deadline{assessment.kind==='activity'?' (first submission only; replacing work later needs your permission)':''}</label>}
      {quiz&&<>
        <label>Attempts allowed<select value={v.max_attempts} disabled={locked} onChange={e=>set({max_attempts:Number(e.target.value)})}>{[1,2,3,4,5,10].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        {v.max_attempts>1&&<label>Score used<select value={v.score_rule} disabled={locked} onChange={e=>set({score_rule:e.target.value as DraftContent['score_rule']})}><option value="highest">Highest attempt</option><option value="latest">Latest attempt</option></select></label>}</>}
    </details></aside>;

  const manage=<details className="dropdown manage"><summary className="button icon-btn" aria-label="More actions"><span aria-hidden="true">⋮</span></summary>
    <div className="menu-list" role="group" aria-label="More actions">
      <button type="button" onClick={e=>{closeMenu(e);void duplicate()}}>Duplicate this {KIND_LABEL[assessment.kind].toLowerCase()}</button>
      {assessment.can_unpublish&&<button type="button" onClick={e=>{closeMenu(e);void unpublish()}}>Unpublish</button>}
      <button type="button" onClick={e=>{closeMenu(e);void settings({archived:!assessment.archived})}}>{assessment.archived?'Restore':'Archive'}</button>
      <hr/><button type="button" onClick={e=>{closeMenu(e);void discard()}}>{assessment.published?'Discard draft':'Delete'}</button>
      <p className="muted menu-note">Unpublish returns it to a draft while nobody has started it. Once students have worked on it, archive it instead: archiving removes it from students and from grade calculations, and records are kept.</p></div></details>;

  const reviewBlock=needsReview&&<section className={reviewed?'panel':'warn'} role="status" aria-label="AI draft review"><p>{reviewed?<strong>✓ You have reviewed this AI draft. You can publish it.</strong>:<><strong>Drafted by AI{draft.ai_language?` in ${({same:'the language of your materials',english:'English',filipino:'Filipino',taglish:'Taglish'} as Record<string,string>)[draft.ai_language]??draft.ai_language}`:''}.</strong> AI can be wrong. Read every question, check each answer against the source shown under it, and check the language as well as the content. Students cannot see this quiz until you mark it reviewed and publish; changing anything afterwards means reviewing again.</>}</p>
    {!reviewed&&<div className="actions"><button type="button" className="primary" disabled={auto.status!=='saved'&&auto.status!=='dirty'} onClick={markReviewed}>I have read and checked every question</button></div>}</section>;

  const assignButton=<button className="primary" disabled={needsReview&&!reviewed} title={needsReview&&!reviewed?'Mark the quiz as reviewed first':undefined} onClick={publish}>{assignLabel}</button>;
  const blocked=needsReview&&!reviewed;
  const tomorrow=toLocal(new Date(new Date().setHours(8,0,0,0)+864e5).toISOString());
  /** Schedule = set the opening time and assign. Students do not see it until then. Only quizzes and activities have an opening time. */
  async function schedule(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const when=String(new FormData(e.currentTarget).get('when'));
    if(new Date(when).getTime()<=Date.now()){setMessage('Choose a time in the future.');return}
    setScheduling(false);auto.setValue({...v,available_from:when});await publish();
  }
  const assignMenu=<span className="split">{assignButton}<details className="dropdown manage"><summary className="button primary split-more" aria-label="More ways to assign"><span aria-hidden="true">▾</span></summary>
    <div className="menu-list" role="group" aria-label="More ways to assign">
      {interactive&&<button type="button" disabled={blocked} onClick={e=>{closeMenu(e);setScheduling(true)}}>Schedule…</button>}
      <button type="button" onClick={e=>{closeMenu(e);void leave()}}>Save draft and close</button></div></details></span>;

  return <div className="compose">
    <header className="compose-bar">
      <button type="button" className="icon-btn" aria-label={`Close and go back to Classwork`} onClick={leave}><span aria-hidden="true">×</span></button>
      <span className="class-dot compose-icon" style={{background:'var(--action)',color:'var(--action-text)'}} aria-hidden="true">{quiz?'?':assessment.kind==='activity'?'✎':'▤'}</span>
      <h1>{KIND_LABEL[assessment.kind]}</h1>
      <span className="compose-actions"><SaveIndicator status={auto.status} message={auto.message} storageFailed={auto.storageFailed} onRetry={auto.retry}/>{manage}{assignMenu}</span>
    </header>
    <p className="muted">{assessment.published?`Students see version ${assessment.published.version} until you ${assignLabel.toLowerCase()}.`:'Not visible to students or the gradebook until you assign it. Your changes are saved as a draft as you go.'}</p>
    <DraftNotices auto={auto} reload={serverDraft} onError={setMessage}/>
    {message&&<p role="alert">{message}</p>}
    <div className="compose-grid">
      <div className="compose-main">
        {reviewBlock}
        <section className="panel">
          <label>Title<input value={v.title} maxLength={200} placeholder="Title" autoFocus={/^Untitled /.test(v.title)} onFocus={e=>{if(/^Untitled /.test(e.target.value))e.target.select()}} onChange={e=>set({title:e.target.value})}/></label>
          <label>Instructions for students (optional)<textarea value={v.instructions} maxLength={10000} onChange={e=>set({instructions:e.target.value})}/></label></section>
        {quiz&&<>
          {locked&&<p className="warn" role="status">Students have started this quiz, so questions and answer keys are locked.</p>}
          <QuestionList questions={v.questions} locked={locked} onChange={q=>set({questions:q})}/>
          <PasteQuestions offeringId={offering.id} locked={locked} onAdd={added=>set({questions:[...v.questions,...added]})}/></>}
      </div>
      {side}
    </div>
    {scheduling&&<Dialog title="Schedule" onClose={()=>setScheduling(false)}><form onSubmit={schedule}>
      <p>Students will not see this at all until the time you choose. You still see it, as scheduled.</p>
      <label>Opens<input name="when" type="datetime-local" required defaultValue={v.available_from||tomorrow}/></label>
      <div className="actions"><button type="button" onClick={()=>setScheduling(false)}>Cancel</button><button className="primary">Schedule</button></div></form></Dialog>}
  </div>;
}
