import type React from 'react';
import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useOutletContext,useSearchParams} from 'react-router-dom';
import {FACULTY_CATS,catOf,catOfKind,CATS,type Cat} from '../../components/ClassworkTypes';
import {useHere} from '../../components/origin';
import {useQuery} from '@tanstack/react-query';
import {api,send,errorText} from '../../app/api';
import {queryClient} from '../../app/providers';
import type {OfferingSummary} from '../academics/types';
import {useUndo} from '../../components/undo';
import {useConfirm} from '../../components/confirm';
import {GenerateDialog} from '../study/Generate';
import {NewDialog,assessmentStatus,assessmentTitle} from '../assessments/Assessments';
import {detail as workDetail} from '../assessments/Work';
import {KIND_LABEL,fmt,type Assessment,type Counts,type Kind,type LearnItem as Work} from '../assessments/types';
import {KIND,NewItemDialog,itemTitle,stateLabel,useNodes} from './Content';
import {type Item,type LearnItem,type LearnSyllabus,type Outline,type SyllabusState} from './types';

type Create={type:'item';kind:Item['kind']}|{type:'assessment';kind:Kind}|{type:'ai'}|null;
interface Row{canUnpublish:boolean;pending:boolean;cat:Cat;key:string;type:'item'|'assessment';id:string;title:string;label:string;anchor:string|null;archived:boolean;status:string;published:boolean;to:string;meta:string;counts?:Counts}

const CREATE:[string,Create|'stream'][]=[['Lesson',{type:'item',kind:'lesson'}],['File',{type:'item',kind:'file'}],['Link',{type:'item',kind:'reference'}],
  ['Quiz',{type:'assessment',kind:'online_quiz'}],['Paper quiz',{type:'assessment',kind:'offline_quiz'}],['Activity',{type:'assessment',kind:'activity'}],['Examination',{type:'assessment',kind:'exam'}],
  ['Teacher-scored item',{type:'assessment',kind:'manual'}],['Quiz drafted by AI',{type:'ai'}],['Announcement','stream']];

/** Teachers: everything you teach and assign in one place, grouped by syllabus topic, with one Create menu. */
export function FacultyClasswork(){
  const {offering}=useOutletContext<{offering:OfferingSummary}>();
  const closed=offering.term_status==='closed';
  const navigate=useNavigate();
  const base=`/faculty/offerings/${offering.id}`;
  const items=useQuery({queryKey:['items',offering.id],queryFn:()=>api<Item[]>(`/teach/offerings/${offering.id}/items`)});
  const assessments=useQuery({queryKey:['assessments',offering.id],queryFn:()=>api<Assessment[]>(`/teach/offerings/${offering.id}/assessments`)});
  const syllabus=useQuery({queryKey:['syllabus',offering.id],queryFn:()=>api<SyllabusState>(`/teach/offerings/${offering.id}/syllabus`)});
  const nodes=useNodes(offering.id);
  const offer=useUndo();const ask=useConfirm();
  const [create,setCreate]=useState<Create>(null);
  const [search,setSearch]=useState('');const [archived,setArchived]=useState(false);
  const cat=catOf(useSearchParams()[0].get('type'),FACULTY_CATS);const topic=useSearchParams()[0].get('topic');
  const {folded,fold,setFolded}=useFolds();
  const [statuses,setStatuses]=useState<Record<string,'all'|'published'|'draft'>>({});const status=statuses[cat]??'all';
  const [reorder,setReorder]=useState<string|null>(null);const [moved,setMoved]=useState('');const [dragging,setDragging]=useState<string|null>(null);
  const menu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const outside=(e:Event)=>{const d=menu.current;if(d?.open&&!(e.target instanceof Node&&d.contains(e.target)))d.open=false;
      document.querySelectorAll('details.row-menu[open]').forEach(m=>{if(!(e.target instanceof Node&&m.contains(e.target)))m.removeAttribute('open')})};
    const escape=(e:KeyboardEvent)=>{const d=menu.current;if(e.key==='Escape'&&d?.open){d.open=false;d.querySelector('summary')?.focus()}};
    document.addEventListener('click',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('click',outside);document.removeEventListener('keydown',escape)};
  },[]);
  // Quizzes, activities and exams open their create page at once, like Classroom, as a draft the teacher names there
  const choose=async(c:Create|'stream')=>{
    if(menu.current)menu.current.open=false;
    if(c==='stream')navigate(`${base}/stream`);
    else if(c?.type==='assessment'){
      try{const a=await send<Assessment>('POST',`/teach/offerings/${offering.id}/assessments`,{kind:c.kind,title:`Untitled ${KIND_LABEL[c.kind].toLowerCase()}`,section_ids:[]});created(`${base}/assessments/${a.id}/edit`)}
      catch(e){setMoved(errorText(e))}}
    else if(c?.type==='item'){
      try{const i=await send<Item>('POST',`/teach/offerings/${offering.id}/items`,{kind:c.kind,title:`Untitled ${KIND[c.kind].toLowerCase()}`,section_ids:[],anchor_node_id:null});created(`${base}/content/${i.id}/edit`)}
      catch(e){setMoved(errorText(e))}}
    else setCreate(c);
  };

  const rows:Row[]=[
    ...(items.data??[]).map(i=>({canUnpublish:false,pending:!!i.draft,cat:'lesson' as Cat,key:'i'+i.id,type:'item' as const,id:i.id,title:itemTitle(i),label:KIND[i.kind],anchor:(i.published??i.draft)?.anchor_node_id??null,archived:i.archived,
      status:stateLabel(i),published:!!i.published,to:`${base}/content/${i.id}/edit`,meta:`${KIND[i.kind]}${i.section_ids.length>0?` · ${i.section_ids.length} section${i.section_ids.length===1?'':'s'}`:''}`})),
    ...(assessments.data??[]).map(a=>{const rev=a.draft??a.published;
      return {canUnpublish:a.can_unpublish,pending:!!a.draft,cat:catOfKind(a.kind),key:'a'+a.id,type:'assessment' as const,id:a.id,title:assessmentTitle(a),label:KIND_LABEL[a.kind],anchor:rev?.anchor_node_id??null,archived:a.archived,status:assessmentStatus(a),published:!!a.published,
        to:a.published?`${base}/assessments/${a.id}`:`${base}/assessments/${a.id}/edit`,counts:a.counts,
        meta:`${KIND_LABEL[a.kind]}${rev?.ai_generated?` · AI draft${rev.reviewed?' reviewed':' needs review'}`:''}${rev?.include_in_grade?` · ${fmt(rev.max_points??0)} pts`:' · not graded'}${a.published?.deadline?` · due ${new Date(a.published.deadline).toLocaleDateString()}`:''}`}})];
  const match=(r:Row)=>r.title.toLowerCase().includes(search.trim().toLowerCase());
  const byStatus=(r:Row,k:'all'|'published'|'draft')=>k==='all'||(k==='published'?r.published&&!r.pending:!r.published||r.pending);   // Drafts: never published, or a newer draft waiting to be published
  const shown=(r:Row)=>(cat==='all'||r.cat===cat)&&(archived||!r.archived)&&match(r)&&byStatus(r,status);
  const outline=syllabus.data?.draft?.outline??syllabus.data?.published?.outline;
  const known=new Set(nodes.map(n=>n.id));
  const tree=buildTree(outline,rows.filter(shown));
  const published=syllabus.data?.published;const draft=syllabus.data?.draft;

  const inNode=(n:TNode<Row>,r:Row)=>n.id==='other'?(!r.anchor||!known.has(r.anchor)):r.anchor===n.id;
  async function move(n:TNode<Row>,visible:Row[],row:Row,step:number){
    const other=visible[visible.indexOf(row)+step];if(!other)return;
    const everyone=rows.filter(r=>r.type==='item'&&inNode(n,r)).map(r=>r.id);const all=[...everyone];const a=all.indexOf(row.id),b=all.indexOf(other.id);[all[a],all[b]]=[all[b],all[a]];
    try{await send('PUT',`/teach/offerings/${offering.id}/items-order`,{anchor_node_id:n.id==='other'?null:n.id,expected_ids:everyone,item_ids:all});
      await queryClient.invalidateQueries({queryKey:['items',offering.id]});setMoved(`Moved “${row.title}” ${step<0?'up':'down'} to position ${visible.indexOf(row)+step+1} of ${visible.length}.`)}
    catch(e){setMoved(errorText(e));queryClient.invalidateQueries({queryKey:['items',offering.id]})}
  }
  /** Drag and drop: the dragged item takes the place of the one it is dropped on. The arrow buttons stay for keyboard use. */
  async function place(n:TNode<Row>,row:Row,target:Row){
    const everyone=rows.filter(r=>r.type==='item'&&inNode(n,r)).map(r=>r.id);const all=[...everyone];
    const a=all.indexOf(row.id),b=all.indexOf(target.id);if(a<0||b<0||a===b)return;
    all.splice(a,1);all.splice(b,0,row.id);
    try{await send('PUT',`/teach/offerings/${offering.id}/items-order`,{anchor_node_id:n.id==='other'?null:n.id,expected_ids:everyone,item_ids:all});
      await queryClient.invalidateQueries({queryKey:['items',offering.id]});setMoved(`Moved “${row.title}” to position ${b+1} of ${all.length}.`)}
    catch(e){setMoved(errorText(e));queryClient.invalidateQueries({queryKey:['items',offering.id]})}
  }
  async function unpublish(r:Row){
    try{
      const view=await send<Assessment>('POST',`/teach/offerings/${offering.id}/assessments/${r.id}/unpublish`,{});
      await Promise.all([queryClient.invalidateQueries({queryKey:['assessments',offering.id]}),queryClient.invalidateQueries({queryKey:['assessment',r.id]})]);
      offer(`“${r.title}” is unpublished. Students no longer see it.`,async()=>{
        try{await send('POST',`/teach/offerings/${offering.id}/assessments/${r.id}/draft/publish`,{expected_counter:view.draft!.counter});
          await queryClient.invalidateQueries({queryKey:['assessments',offering.id]})}
        catch(e){setMoved(errorText(e))}})}
    catch(e){setMoved(errorText(e))}
  }
  const path=(r:Row)=>r.type==='item'?`/teach/offerings/${offering.id}/items/${r.id}`:`/teach/offerings/${offering.id}/assessments/${r.id}`;
  const refreshLists=()=>Promise.all([queryClient.invalidateQueries({queryKey:['items',offering.id]}),queryClient.invalidateQueries({queryKey:['assessments',offering.id]})]);
  const editTo=(r:Row)=>r.type==='item'?r.to:`${base}/assessments/${r.id}/edit`;
  async function archive(r:Row,on:boolean){
    try{await send('PATCH',path(r),{archived:on});await refreshLists();
      offer(on?`“${r.title}” is archived.`:`“${r.title}” is restored.`,async()=>{try{await send('PATCH',path(r),{archived:!on});await refreshLists()}catch(e){setMoved(errorText(e))}})}
    catch(e){setMoved(errorText(e))}
  }
  async function remove(r:Row){
    if(!await ask({title:`Delete “${r.title}”?`,message:'It was never published, so no student has seen it. This cannot be undone.',yes:'Delete',danger:true}))return;
    try{await send('DELETE',path(r));await refreshLists();offer(`“${r.title}” was deleted.`)}catch(e){setMoved(errorText(e))}
  }
  async function copyOf(r:Row){
    try{const made=await send<{id:string}>('POST',`${path(r)}/duplicate`,{});await refreshLists();navigate(`${base}/assessments/${made.id}/edit`)}catch(e){setMoved(errorText(e))}
  }
  async function copyLink(r:Row){try{await navigator.clipboard.writeText(location.origin+r.to);offer('Link copied.')}catch{offer('Could not copy the link.')}}
  const closeMenu=(e:React.MouseEvent<HTMLElement>)=>{(e.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open')};
  const created=(to:string)=>{setCreate(null);queryClient.invalidateQueries({queryKey:['items',offering.id]});queryClient.invalidateQueries({queryKey:['assessments',offering.id]});navigate(to)};

  const stranded=rows.find(r=>r.type==='item'&&r.anchor&&!known.has(r.anchor));   // its topic left the syllabus: fix it before reordering
  const count=(k:'all'|'published'|'draft')=>rows.filter(r=>(cat==='all'||r.cat===cat)&&(archived||!r.archived)&&byStatus(r,k)).length;
  const branch=(n:TNode<Row>,depth:number):React.ReactElement=>{
    const Heading=(['h3','h4','h5'] as const)[Math.min(depth,2)];
    const items=n.rows.filter(r=>r.type==='item');
    return <section key={n.id} className={`tree d${Math.min(depth,2)}`} aria-labelledby={`c-${n.id}`}>
      <header><Heading id={`c-${n.id}`}><button type="button" className="topic-toggle" aria-expanded={!folded.has(n.id)} onClick={()=>fold(n.id)}>{n.title}</button></Heading><span className="count">{total(n)}</span>{depth===0&&chips(n.id)}
        {items.length>1&&!closed&&!stranded&&<button type="button" className="linklike" aria-pressed={reorder===n.id} onClick={()=>setReorder(reorder===n.id?null:n.id)}>{reorder===n.id?'Done reordering':'Reorder'}</button>}</header>
      {reorder===n.id&&<p className="muted">Drag a row onto another to move it, or use the arrow buttons.</p>}
      {!folded.has(n.id)&&n.rows.length>0&&grouped(n.id==='other',n.rows,rs=><ul className="seq compact">{rs.map(r=>{const drag=reorder===n.id&&r.type==='item'&&!closed;
        return <li key={r.key} data-cat={r.cat} className={dragging===r.id?'dragging':drag?'draggable':undefined} draggable={drag||undefined}
          onDragStart={drag?e=>{setDragging(r.id);e.dataTransfer.effectAllowed='move'}:undefined} onDragEnd={drag?()=>setDragging(null):undefined}
          onDragOver={drag&&dragging?e=>e.preventDefault():undefined} onDrop={drag?e=>{e.preventDefault();const d=n.rows.find(x=>x.id===dragging);setDragging(null);if(d)void place(n,d,r)}:undefined}>
        {drag&&<span className="drag-handle" aria-hidden="true">⋮⋮</span>}<span className="grow"><Link to={r.to}>{r.title}</Link><span className="muted">{r.meta}</span></span>
        {r.counts&&!r.archived&&<span className="row-counts" aria-label="Student work"><Link to={`${r.to}/scores?status=turned_in`}><strong>{r.counts.turned_in}</strong> Turned in</Link><Link to={`${r.to}/scores?status=assigned`}><strong>{r.counts.assigned}</strong> Assigned</Link><Link to={`${r.to}/scores?status=graded`}><strong>{r.counts.graded}</strong> Graded</Link></span>}
        <span className={r.published&&!r.archived?'badge done':'badge'}>{r.status}</span>{!closed&&<details className="dropdown row-menu"><summary className="icon-btn" aria-label={`More actions for ${r.title}`}><span aria-hidden="true">⋮</span></summary>
          <div className="menu-list" role="group" aria-label={`Actions for ${r.title}`}>
            <Link to={editTo(r)} onClick={closeMenu}>Edit</Link>
            {r.type==='assessment'&&r.published&&<Link to={`${base}/assessments/${r.id}/scores`} onClick={closeMenu}>View student work</Link>}
            <button type="button" onClick={e=>{closeMenu(e);void copyLink(r)}}>Copy link</button>
            {r.type==='assessment'&&<button type="button" onClick={e=>{closeMenu(e);void copyOf(r)}}>Make a copy</button>}
            {r.canUnpublish&&<button type="button" onClick={e=>{closeMenu(e);void unpublish(r)}}>Unpublish</button>}
            <button type="button" onClick={e=>{closeMenu(e);void archive(r,!r.archived)}}>{r.archived?'Restore':'Archive'}</button>
            {!r.published&&<><hr/><button type="button" onClick={e=>{closeMenu(e);void remove(r)}}>Delete</button></>}
          </div></details>}
        {reorder===n.id&&r.type==='item'&&<span className="actions"><button type="button" aria-label={`Move ${r.title} up`} disabled={closed||items.indexOf(r)===0} onClick={()=>move(n,items,r,-1)}>↑</button>
          <button type="button" aria-label={`Move ${r.title} down`} disabled={closed||items.indexOf(r)===items.length-1} onClick={()=>move(n,items,r,1)}>↓</button></span>}</li>})}</ul>)}
      {!folded.has(n.id)&&n.kids.map(k=>branch(k,depth+1))}</section>};
  const label=FACULTY_CATS.find(c=>c[0]===cat)?.[1]??'classwork';
  const chips=topicChips(catCounts(buildTree(outline,rows.filter(r=>archived||!r.archived))));
  return <>
    <div className="type-row"><Link className="button" to={`${base}/syllabus`}>Syllabus</Link>
      <details className="dropdown" ref={menu}><summary className={`button primary${closed?' disabled':''}`} aria-disabled={closed} onClick={e=>{if(closed)e.preventDefault()}}>+ Create</summary>
        <div className="menu-list" role="group" aria-label="Create">{CREATE.map(([label,target],i)=><span key={label} className="menu-item">{(i===3||i===8)&&<hr/>}
          <button type="button" onClick={()=>choose(target)}>{label}</button></span>)}</div></details></div>
    {cat!=='all'&&<p className="filter-note muted">Showing {label.toLowerCase()} only. <Link to={`${base}/classwork`}>Show everything</Link></p>}
    {!published&&!draft&&!closed&&<section className="panel" aria-labelledby="syl-h"><h3 id="syl-h">Set up this subject</h3><p className="muted">Not set up yet. A guided setup creates the syllabus, grading policy and first topics in a few steps.</p>
      <Link className="button primary" to={`${base}/setup`}>Set up this subject</Link></section>}
    <div className="cw-bar"><p className="muted">Students only see what you publish: edits stay drafts until you do.</p>
      <div className="segmented" role="group" aria-label="Show">{([['all','Everything'],['published','Published'],['draft','Drafts']] as const).map(([k,l])=>
        <button key={k} type="button" className={status===k?'on':''} aria-pressed={status===k} onClick={()=>setStatuses({...statuses,[cat]:k})}>{l} <span className="muted">{count(k)}</span></button>)}</div></div>
    <details className="more"><summary>Search and archived</summary><div className="actions"><label>Search<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Title"/></label>
      <label className="inline"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> Show archived</label></div></details>
    {moved&&<p role="status" className="muted">{moved}</p>}
    {(items.isPending||assessments.isPending)?<p>Loading…</p>:items.error||assessments.error?<p role="alert">{(items.error??assessments.error)!.message}</p>:
      tree.length===0?<section className="panel"><h2>{search||status!=='all'?'Nothing matches':`No ${label.toLowerCase()} yet`}</h2><p>{search||status!=='all'?'Change the search or the filter.':'Use Create to add one.'}</p></section>:
      <>
      {stranded&&<p className="warn" role="status">Items cannot be reordered because some are attached to a topic that is no longer in the syllabus. <Link to={stranded.to}>Open “{stranded.title}”</Link> and choose a current topic.</p>}
      <div className="cw-layout"><TopicNav tree={tree}/><div className="cw-main"><FoldBar tree={tree} setFolded={setFolded}/>{inTopic(tree,topic).map(n=>branch(n,0))}</div></div></>}
    {create?.type==='item'&&<NewItemDialog offering={offering} nodes={nodes} kind={create.kind} onClose={()=>setCreate(null)} onCreated={i=>created(`${base}/content/${i.id}/edit`)}/>}
    {create?.type==='assessment'&&<NewDialog offering={offering} kind={create.kind} onClose={()=>setCreate(null)} onCreated={a=>created(`${base}/assessments/${a.id}/edit`)}/>}
    {create?.type==='ai'&&<GenerateDialog offering={offering} onClose={()=>setCreate(null)} onCreated={a=>created(`${base}/assessments/${a.id}/edit`)}/>}
  </>;
}

interface WorkRow extends Work{anchor_node_id?:string|null}
interface SRow{key:string;kind:'item'|'work';cat:'lesson'|'quiz'|'activity';title:string;anchor:string|null;to:string;label:string;detail:string;chips:{text:string;cls?:string}[];todo:boolean;done:boolean;result?:string}
type Filter='all'|'todo'|'done';

interface TNode<T=SRow>{id:string;title:string;rows:T[];kids:TNode<T>[]}
const total=<T,>(n:TNode<T>):number=>n.rows.length+n.kids.reduce((t,k)=>t+total(k),0);

/** Classroom's left-hand topic list: "All topics" and one entry per chapter, kept in the address (?topic=) next to the type. */
function TopicNav<T>({tree}:{tree:TNode<T>[]}){
  const [params]=useSearchParams();const current=params.get('topic');
  const to=(id:string|null)=>{const q=new URLSearchParams(params);if(id)q.set('topic',id);else q.delete('topic');const text=q.toString();return text?`?${text}`:'?'};
  if(tree.length<2)return null;
  const known=tree.some(n=>n.id===current);
  return <nav className="topic-nav" aria-label="Topics"><Link to={to(null)} replace className={!known?'active':undefined} aria-current={!known?'page':undefined}><span className="t">All topics</span></Link>
    {tree.map(n=><Link key={n.id} to={to(n.id)} replace title={n.title} className={n.id===current?'active':undefined} aria-current={n.id===current?'page':undefined}><span className="t">{n.title}</span><span className="tab-count">{total(n)}</span></Link>)}</nav>;
}
/** How many of each kind sit under each top-level topic, whatever the current type filter: the numbers behind the shortcuts. */
const rowsUnder=<T,>(n:TNode<T>):T[]=>[...n.rows,...n.kids.flatMap(rowsUnder)];
function catCounts<T extends {cat:string}>(tree:TNode<T>[]){
  return Object.fromEntries(tree.map(n=>{const c:Record<string,number>={};for(const r of rowsUnder(n))c[r.cat]=(c[r.cat]??0)+1;return [n.id,c]}));
}
const NAMES:Record<string,[string,string]>={lesson:['lesson','lessons'],quiz:['quiz','quizzes'],activity:['activity','activities'],exam:['exam','exams']};
/** A topic heading's one-line summary of what it holds ("1 lesson · 2 quizzes"), shown only when it holds more than one kind. */
function topicChips(counts:Record<string,Record<string,number>>){
  return (id:string)=>{
    const c=counts[id]??{};const kinds=Object.keys(NAMES).filter(k=>(c[k]??0)>0);
    if(kinds.length<2)return null;
    return <span className="topic-summary muted">{kinds.map(k=>`${c[k]} ${NAMES[k]![c[k]===1?0:1]}`).join(' · ')}</span>;
  };
}
const KIND_ORDER:[string,string][]=[['lesson','Lessons'],['quiz','Quizzes'],['activity','Activities'],['exam','Exams']];
/** The pile "Not under a topic" is split by kind so a long list is easy to scan; a real topic keeps its rows in one list. */
function grouped<T extends {cat:string}>(split:boolean,rows:T[],render:(rows:T[])=>React.ReactElement){
  const parts=KIND_ORDER.map(([k,l])=>[l,rows.filter(r=>r.cat===k)] as const).filter(([,list])=>list.length>0);
  if(!split||parts.length<2)return render(rows);
  return <>{parts.map(([l,list])=><div className="kind-group" key={l}><h4 className="kind-head">{l}<span className="count">{list.length}</span></h4>{render(list)}</div>)}</>;
}
const idsOf=<T,>(tree:TNode<T>[]):string[]=>tree.flatMap(n=>[n.id,...idsOf(n.kids)]);
/** Which topics are folded, and the two buttons that fold or unfold all of them. */
function useFolds(){
  const [folded,setFolded]=useState<Set<string>>(new Set());
  const fold=(id:string)=>setFolded(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n});
  return {folded,fold,setFolded};
}
function FoldBar<T>({tree,setFolded}:{tree:TNode<T>[];setFolded:(s:Set<string>)=>void}){
  return idsOf(tree).length>1?<p className="fold-all"><button type="button" className="linklike" onClick={()=>setFolded(new Set(idsOf(tree)))}>Collapse all</button><button type="button" className="linklike" onClick={()=>setFolded(new Set())}>Expand all</button></p>:null;
}
/** The branches to show: the chosen topic, or all of them when none (or a topic that no longer has anything) is chosen. */
const inTopic=<T,>(tree:TNode<T>[],topic:string|null)=>topic&&tree.some(n=>n.id===topic)?tree.filter(n=>n.id===topic):tree;

/** The syllabus as a tree (chapter, then topic or section, then topic) holding only the rows given; empty branches are dropped. */
function buildTree<T extends {anchor:string|null}>(outline:Outline|undefined,rows:T[]):TNode<T>[]{
  const known=new Set<string>();
  const leaf=(id:string,title:string,kids:TNode<T>[]=[]):TNode<T>=>{known.add(id);return {id,title,rows:rows.filter(r=>r.anchor===id),kids}};
  const tree=(outline?.chapters??[]).map(c=>leaf(c.id,c.title||'Untitled chapter',[
    ...c.topics.map(t=>leaf(t.id,t.title||'Untitled topic')),
    ...c.subsections.map(x=>leaf(x.id,x.title||'Untitled section',x.topics.map(t=>leaf(t.id,t.title||'Untitled topic'))))]));
  const prune=(n:TNode<T>):TNode<T>=>({...n,kids:n.kids.map(prune).filter(k=>total(k)>0)});
  const out=tree.map(prune).filter(n=>total(n)>0);
  const rest=rows.filter(r=>!r.anchor||!known.has(r.anchor));
  return rest.length?[...out,{id:'other',title:'Not under a topic',rows:rest,kids:[]}]:out;
}
const rank=(r:SRow)=>r.todo?0:r.done?2:1;      // inside one topic: what needs you first, then the rest, then what is finished

function Branch({node,depth,here,folded,fold,chips,bare=false}:{node:TNode;depth:number;here:{from:string;label:string};folded:Set<string>;fold:(id:string)=>void;chips:(id:string)=>React.ReactNode;bare?:boolean}){
  const Heading=(['h3','h4','h5'] as const)[Math.min(depth,2)];
  return <section className={`tree d${Math.min(depth,2)}`} aria-labelledby={`t-${node.id}`}>
    {bare?<h3 id={`t-${node.id}`} className="sr-only">{node.title}</h3>:<header><Heading id={`t-${node.id}`}><button type="button" className="topic-toggle" aria-expanded={!folded.has(node.id)} onClick={()=>fold(node.id)}>{node.title}</button></Heading><span className="count">{total(node)}</span>{depth===0&&chips(node.id)}</header>}
    {!folded.has(node.id)&&node.rows.length>0&&grouped(node.id==='other',[...node.rows].sort((a,b)=>rank(a)-rank(b)),rs=><ul className="seq compact">{rs.map(r=><li key={r.key} data-cat={r.cat} className={r.chips.some(c=>c.cls==='next')?'next':undefined}>
      <span className="grow"><Link state={here} to={r.to}>{r.title}</Link>{(r.detail||r.result)&&<span className="muted">{r.detail}{r.detail&&r.result?' · ':''}{r.result&&<strong>{r.result}</strong>}</span>}</span>
      {r.chips.map(c=><span key={c.text} className={`badge ${c.cls??''}`}>{c.text}</span>)}
      {r.kind==='item'&&r.todo&&<Link state={here} className="start" to={r.to} title="Open this" aria-hidden="true" tabIndex={-1}>▶</Link>}</li>)}</ul>)}
    {!folded.has(node.id)&&node.kids.map(k=><Branch key={k.id} node={k} depth={depth+1} here={here} folded={folded} fold={fold} chips={chips}/>)}
  </section>;
}

/** Students: lessons, files, links, quizzes and activities together, by syllabus topic. */
export function StudentClasswork(){
  const {offering}=useOutletContext<{offering:OfferingSummary}>();
  const base=`/student/offerings/${offering.id}`;
  const items=useQuery({queryKey:['learn-items',offering.id],queryFn:()=>api<LearnItem[]>(`/learn/offerings/${offering.id}/items`)});
  const work=useQuery({queryKey:['learn-work',offering.id],queryFn:()=>api<WorkRow[]>(`/learn/offerings/${offering.id}/assessments`)});
  const syllabus=useQuery({queryKey:['learn-syllabus',offering.id],queryFn:()=>api<LearnSyllabus>(`/learn/offerings/${offering.id}/syllabus`)});
  const cat=catOf(useSearchParams()[0].get('type'));const topic=useSearchParams()[0].get('topic');const here=useHere();
  const {folded,fold,setFolded}=useFolds();
  const [filters,setFilters]=useState<Record<string,Filter>>({});const filter=filters[cat]??'all';      // each tab remembers its own filter
  const setFilter=(f:Filter)=>setFilters({...filters,[cat]:f});
  const error=items.error??work.error;if(error)return <p role="alert">{error.message}</p>;
  if(!items.data||!work.data)return <p>Loading…</p>;
  const nearest=work.data.find(w=>w.bucket==='todo');                // sorted by deadline, so this is the nearest
  const lessons=items.data;const finished=lessons.filter(i=>i.completed).length;      // lessons, files and links are one sequence
  const next=items.data.find(i=>i.up_next);
  const KIND_NAME={lesson:'Lesson',file:'File',reference:'Link'} as const;
  const rows:SRow[]=[
    ...items.data.map(i=>({key:'i'+i.id,kind:'item' as const,cat:'lesson' as const,title:i.title,anchor:i.anchor_node_id,to:`${base}/lessons/${i.id}`,label:KIND_NAME[i.kind],
      detail:i.kind==='file'?(i.file?.name??''):'',chips:[...(i.up_next?[{text:'Up next',cls:'next'}]:[]),...[i.completed?{text:'✓ Completed',cls:'done'}:{text:'Not marked complete'}]],
      todo:!i.completed,done:!!i.completed})),
    ...work.data.map(w=>({key:'w'+w.id,kind:'work' as const,cat:(w.kind==='online_quiz'?'quiz':'activity') as 'quiz'|'activity',title:w.title,anchor:w.anchor_node_id??null,to:`${base}/work/${w.id}`,label:w.kind==='online_quiz'?'Quiz':'Activity',
      detail:workDetail(w),
      chips:[...(w===nearest?[{text:'Up next',cls:'next'}]:[]),...(w.state==='in_progress'?[{text:'In progress'}]:[]),...(w.late_allowed?[{text:'Late submission allowed',cls:'warn'}]:[])],
      todo:w.bucket==='todo'||w.bucket==='again',done:w.bucket==='done'||w.bucket==='awaiting',
      result:w.result?`Your result: ${fmt(w.result.score)} / ${fmt(w.result.max_points)}`:undefined}))];
  const want=(r:SRow)=>(cat==='all'||r.cat===cat)&&(filter==='all'||(filter==='todo'?r.todo:r.done));
  const outline=syllabus.data?.published?.outline;
  const shownRows=rows.filter(want);
  const tree=buildTree(outline,shownRows);
  const chips=topicChips(catCounts(buildTree(outline,rows)));
  const count=(k:Filter)=>rows.filter(r=>(cat==='all'||r.cat===cat)&&(k==='all'||(k==='todo'?r.todo:r.done))).length;
  return <>
    {rows.length===0?<section className="panel"><h2>Nothing yet</h2><p>Published lessons, files, links, quizzes and activities appear here.</p></section>:<>
      <div className="type-row"><Link className="button" to={`${base}/syllabus`}>Syllabus</Link><Link className="button" to={`${base}/your-work`}>View your work</Link></div>
      {cat!=='all'&&<p className="filter-note muted">Showing {CATS.find(c=>c[0]===cat)?.[1]?.toLowerCase()} only. <Link to={`${base}/classwork`}>Show everything</Link></p>}
      <div className="cw-bar">
        {(cat==='lesson'||cat==='all')&&lessons.length>0&&<div className="seq-head"><p><strong>{finished} of {lessons.length}</strong> complete</p>
          {next&&<Link className="button primary" to={`${base}/lessons/${next.id}`}>Continue: {next.title}</Link>}</div>}
        <div className="segmented" role="group" aria-label="Show">{([['all','Everything'],['todo',cat==='lesson'?'Not completed':'To do'],['done',cat==='lesson'?'Completed':'Done']] as const).map(([k,l])=>
          <button key={k} type="button" className={filter===k?'on':''} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l} <span className="muted">{count(k)}</span></button>)}</div></div>
      {shownRows.length===0?<section className="panel"><h2>{filter==='todo'?'Nothing to do':filter==='done'?'Nothing done yet':'Nothing here yet'}</h2><p className="muted">{filter==='todo'?'You are up to date.':filter==='done'?'Completed lessons and finished work appear here.':'Your teacher has not published any yet.'}</p></section>
        :tree.length===1&&tree[0].id==='other'?<Branch node={tree[0]} depth={0} here={here} folded={folded} fold={fold} chips={chips} bare/>:<div className="cw-layout"><TopicNav tree={tree}/><div className="cw-main"><FoldBar tree={tree} setFolded={setFolded}/>{inTopic(tree,topic).map(n=><Branch key={n.id} node={n} depth={0} here={here} folded={folded} fold={fold} chips={chips}/>)}</div></div>}</>}
  </>;
}
