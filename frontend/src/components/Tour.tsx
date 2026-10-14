import {useEffect,useRef,useState} from 'react';
import {Icon,type IconName} from './Icon';

interface Step{icon:IconName;title:string;text:string}
const STEPS:Record<'admin'|'faculty'|'student',Step[]>={
  admin:[
    {icon:'school',title:'Welcome to LearnSync',text:'You set up the school year, the people and the catalog. Teachers and students take it from there.'},
    {icon:'term',title:'School years and terms',text:'Open a term to follow three steps: add sections, assign subjects to teachers, place students.'},
    {icon:'people',title:'User accounts',text:'Invite teachers and students, resend invitations and manage access. Each row has a ⋮ menu.'},
    {icon:'help',title:'Reports and history',text:'Problems people report land in Reports, and the Audit history keeps a record of important changes.'},
    {icon:'search',title:'Find anything fast',text:'Press Ctrl K (or ⌘ K) to jump to any page.'},
  ],
  faculty:[
    {icon:'school',title:'Welcome to LearnSync',text:'Each class is a card on your home page with its own Stream, Classwork, People and Grades.'},
    {icon:'material',title:'Classwork',text:'Create lessons, quizzes, activities and exams under topics. Students see them only when you assign them; you can schedule or save a draft.'},
    {icon:'chart',title:'Grades',text:'Type scores straight into the grid. Students see results only after you return them and grades only after you publish.'},
    {icon:'bell',title:'Stay in the loop',text:'The bell tells you when students turn work in or comment. Customize a class’s colour and header from its Stream.'},
    {icon:'search',title:'Find anything fast',text:'Press Ctrl K (or ⌘ K) to jump to any class or page.'},
  ],
  student:[
    {icon:'school',title:'Welcome to LearnSync',text:'Each class is a card on your home page. Open it to see the Stream, Classwork and People.'},
    {icon:'todo',title:'Your to-do list',text:'To-do shows what is assigned, missing and done. Home lists what is due soon.'},
    {icon:'upload',title:'Turning in work',text:'Open an assignment, attach your file or mark it done, and turn it in. You can Unsubmit until your teacher grades it, and send a private comment.'},
    {icon:'chat',title:'Study buddy',text:'Ask a question about a lesson from the owl button. It answers from your class material.'},
    {icon:'search',title:'Find anything fast',text:'Press Ctrl K (or ⌘ K) to jump to a class or page.'},
  ],
};
const key=(userId:string)=>`learnsync:tour:${userId}`;

/** True the first time someone signs in on this browser (never under automated browsers, so scripted checks are not blocked). */
export function shouldAutoTour(userId:string){
  try{return !navigator.webdriver&&localStorage.getItem(key(userId))===null}catch{return false}
}

/** A short welcome tour for each role: a card at a time, Back/Next/Skip, Escape closes. */
export function Tour({role,userId,onClose}:{role:'admin'|'faculty'|'student';userId:string;onClose:()=>void}){
  const steps=STEPS[role];const [i,setI]=useState(0);const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current;const origin=document.activeElement as HTMLElement|null;d?.showModal();return()=>{d?.close();origin?.focus()}},[]);
  const finish=()=>{try{localStorage.setItem(key(userId),'seen')}catch{/* it may show again next time */}onClose()};
  const s=steps[i]!;const last=i===steps.length-1;
  return <dialog ref={ref} className="tour" aria-labelledby="tour-title" onCancel={e=>{e.preventDefault();finish()}}>
    <div className="tour-art" aria-hidden="true"><span><Icon name={s.icon} size={38}/></span></div>
    <p className="tour-count muted" aria-live="polite">Step {i+1} of {steps.length}</p>
    <h2 id="tour-title">{s.title}</h2><p>{s.text}</p>
    <div className="tour-dots" aria-hidden="true">{steps.map((_,n)=><i key={n} className={n===i?'on':''}/>)}</div>
    <div className="actions"><button type="button" onClick={finish}>{last?'Close':'Skip tour'}</button><span className="grow"/>
      {i>0&&<button type="button" onClick={()=>setI(i-1)}>Back</button>}
      <button type="button" className="primary" onClick={()=>last?finish():setI(i+1)} autoFocus>{last?'Get started':'Next'}</button></div>
  </dialog>;
}
