import {Fragment,useEffect,useRef,useState} from 'react';
import {Link,NavLink,Outlet,Navigate} from 'react-router-dom';
import {useAuth,useTheme,queryClient} from '../app/providers';
import {useQuery} from '@tanstack/react-query';
import {api,post,setCsrf} from '../app/api';
import {studentHomeQuery} from '../features/dashboard/Dashboards';
import {useUnread} from './seen';
import {StudyBuddy} from '../features/study/StudyBuddy';
import {useConfirm} from './confirm';
import {classColor,initials,useClasses} from './classes';

type NavItem={to:string;label:string;icon:string;end?:boolean;dot?:boolean};
const ROLE_LABEL={admin:'Academic administrator',faculty:'Teaching faculty',student:'Student'} as const;

/** Drawer entries. Icons are decoration only (aria-hidden); every entry has a visible text label. Faculty and students also get their class list (see ClassList). */
function navigation(role:'admin'|'faculty'|'student'):{label:string;items:NavItem[]}[]{
  const home='/'+role;
  const settings={label:'',items:[{to:'/account',label:'Settings',icon:'⚙'}]};
  if(role==='admin')return [
    {label:'',items:[{to:home,label:'Home',icon:'⌂',end:true},{to:`${home}/accounts`,label:'User accounts',icon:'♙'}]},
    {label:'Academic management',items:[{to:`${home}/academics`,label:'School years',icon:'☰'},{to:`${home}/subjects`,label:'Prospectus',icon:'▤'}]},
    {label:'Oversight',items:[{to:`${home}/issues`,label:'Reports',icon:'?'},{to:`${home}/audit`,label:'Audit history',icon:'◷'}]},
    settings];
  const student=role==='student';
  return [
    {label:'',items:[{to:home,label:'Home',icon:'⌂',end:true,dot:student},...(student?[{to:`${home}/todo`,label:'To-do',icon:'☑'},{to:`${home}/study-buddy`,label:'Study buddy',icon:'✦'}]:[{to:`${home}/review`,label:'To review',icon:'✎'}])]},
    {label:'',items:[{to:`${home}/subjects`,label:'All subjects',icon:'▤'},{to:`${home}/issues`,label:'Report a problem',icon:'?'},...settings.items]}];
}

/** The user's current classes under the drawer's Home group, each with its banner colour. */
function ClassList({role,self}:{role:'faculty'|'student';self:string}){
  const classes=useClasses(role,self);
  const list=(classes.data??[]).filter(c=>c.open&&c.active);
  if(list.length===0)return null;
  return <div className="nav-group"><p className="nav-label">{role==='faculty'?'Teaching':'Enrolled'}</p>
    {list.map(c=><NavLink key={c.id} to={`/${role}/offerings/${c.id}`} className="class-link"><span className="class-dot" style={{background:classColor(c.id)}} aria-hidden="true">{c.title[0]}</span>
      <span className="class-link-text"><strong>{c.title}</strong><span>{c.code} · {c.section}</span></span></NavLink>)}</div>;
}

/** A dot beside Dashboard while there are course updates this browser has not shown yet (students only). */
function UpdatesDot({userId}:{userId:string}){
  const latest=useQuery(studentHomeQuery).data?.updates[0]?.at;
  return useUnread(userId,latest)?<span className="dot" role="img" aria-label="New course updates"/>:null;
}

export function Shell(){
  const ask=useConfirm();
  const {session,loading,error}=useAuth();const {theme,setTheme}=useTheme();
  const wide=()=>matchMedia('(min-width:1024px)').matches;
  const [open,setOpen]=useState(()=>{try{return wide()&&localStorage.getItem('learnsync:drawer')!=='closed'}catch{return wide()}});const [failure,setFailure]=useState('');
  const account=useRef<HTMLDetailsElement>(null);
  const toggle=()=>{setOpen(!open);try{if(wide())localStorage.setItem('learnsync:drawer',open?'closed':'open')}catch{/* the choice still applies now */}};
  const menuButton=useRef<HTMLButtonElement>(null);
  // the phone menu is a disclosure: Escape closes it and gives focus back to the button that opened it
  useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!wide()){setOpen(false);menuButton.current?.focus()}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[open]);
  // the sticky sidebar sits under the header, whose height changes when it wraps
  useEffect(()=>{const h=document.querySelector('.header');if(!h)return;const set=()=>document.documentElement.style.setProperty('--header-h',h.getBoundingClientRect().height+'px');set();const ro=new ResizeObserver(set);ro.observe(h);return()=>ro.disconnect()},[loading,session?.user]);
  useEffect(()=>{const outside=(e:Event)=>{const d=account.current;if(d?.open&&!(e.target instanceof Node&&d.contains(e.target)))d.open=false};const esc=(e:KeyboardEvent)=>{const d=account.current;if(e.key==='Escape'&&d?.open){d.open=false;d.querySelector('summary')?.focus()}};document.addEventListener('click',outside);document.addEventListener('keydown',esc);return()=>{document.removeEventListener('click',outside);document.removeEventListener('keydown',esc)}},[]);
  if(loading)return <main className="content">Loading your workspace…</main>;
  if(error)return <main className="content"><p role="alert">Cannot reach the server. Please refresh after starting it.</p></main>;
  if(!session?.user)return <Navigate to="/login" replace/>;
  const user=session.user;const home='/'+user.role;
  // the header selector saves to the account too, otherwise a saved preference would undo it on the next load
  async function chooseTheme(value:'system'|'light'|'dark'){
    setTheme(value);
    try{await api('/me/preferences',{method:'PATCH',body:JSON.stringify({theme:value})});await queryClient.invalidateQueries({queryKey:['session']})}
    catch{/* the choice still applies in this browser */}
  }
  async function logout(){
    // A recovery copy exists only while edits are not on the server, so its presence means unsaved work.
    const unsaved=(()=>{try{return Object.keys(localStorage).some(k=>k.startsWith(`learnsync:draft:${user.id}:`))}catch{return false}})();
    if(unsaved&&!await ask({title:'Sign out?',message:'Some of your changes are saved only in this browser, not on the server yet. Signing out deletes them.',yes:'Sign out anyway',danger:true}))return;
    try{await post('/auth/logout',{});for(const key of Object.keys(localStorage)){if(key.startsWith('learnsync:draft:'))localStorage.removeItem(key)}setCsrf('');queryClient.clear();window.location.assign('/login')}
    catch(e){setFailure(e instanceof Error?e.message:'Sign out failed.')}
  }
  const classRole=user.role==='admin'?null:user.role;
  return <div className={'app-shell'+(open?' drawer-on':'')}>
    <a href="#main" className="skip">Skip to content</a>
    <header className="header">
      <button ref={menuButton} className="menu" aria-label="Toggle navigation" aria-expanded={open} aria-controls="drawer" onClick={toggle}><span aria-hidden="true">☰</span></button>
      <Link to={home} className="brand"><span className="mark" aria-hidden="true">L</span>LearnSync</Link>
      <details className="dropdown account" ref={account}>
        <summary aria-label={`Account menu for ${user.display_name}`}><span className="avatar" aria-hidden="true">{initials(user.display_name)}</span></summary>
        <div className="menu-list account-menu">
          <div className="account-who"><span className="avatar big-avatar" aria-hidden="true">{initials(user.display_name)}</span><strong>{user.display_name}</strong><span className="muted">{ROLE_LABEL[user.role]}</span></div>
          <label className="theme-label">Theme<select value={theme} onChange={e=>void chooseTheme(e.target.value as 'system'|'light'|'dark')}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <Link className="button" to="/account" onClick={()=>{if(account.current)account.current.open=false}}>Account settings</Link>
          <button onClick={logout}>Sign out</button>
        </div>
      </details>
    </header>
    <div className="scrim" onClick={()=>setOpen(false)} hidden={!open}/>
    <aside id="drawer" className={'sidebar '+(open?'open':'')}>
      <nav aria-label="Main" onClick={()=>{if(!wide())setOpen(false)}}>
        {navigation(user.role).map((group,gi)=><Fragment key={gi}>
          <div className="nav-group">
            {group.label&&<p className="nav-label">{group.label}</p>}
            {group.items.map(i=><NavLink key={i.to} to={i.to} end={i.end}><span className="nav-icon" aria-hidden="true">{i.icon}</span>{i.label}{i.dot&&<UpdatesDot userId={user.id}/>}</NavLink>)}
          </div>
          {gi===0&&classRole&&<ClassList role={classRole} self={user.display_name}/>}
        </Fragment>)}
      </nav>
    </aside>
    <main id="main" className="content">{failure&&<p role="alert" className="error">{failure}</p>}<Outlet/></main>
    {user.role==='student'&&<StudyBuddy userId={user.id}/>}
  </div>;
}
