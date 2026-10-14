import {useEffect,useRef} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {api,post} from '../app/api';
import {Icon,type IconName} from './Icon';
import {queryClient} from '../app/providers';

interface Note{id:string;kind:string;title:string;detail:string;link:string;at:string;read:boolean}
const ICON:Record<string,IconName>={assigned:'activity',material:'material',announcement:'announcement',returned:'check',grade:'star',turned_in:'upload',comment:'comment',report:'help',accepted:'people'};
const when=(iso:string)=>new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

/** The bell in the top bar: what was assigned, returned, published or said, newest first. It checks again every minute and when the tab is reopened. */
export function NotificationBell(){
  const menu=useRef<HTMLDetailsElement>(null);
  const query=useQuery({queryKey:['notifications'],queryFn:()=>api<{unread:number;items:Note[]}>('/me/notifications'),refetchInterval:60000,refetchOnWindowFocus:true});
  useEffect(()=>{
    const outside=(e:Event)=>{const d=menu.current;if(d?.open&&!(e.target instanceof Node&&d.contains(e.target)))d.open=false};
    const escape=(e:KeyboardEvent)=>{const d=menu.current;if(e.key==='Escape'&&d?.open){d.open=false;d.querySelector('summary')?.focus()}};
    document.addEventListener('click',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('click',outside);document.removeEventListener('keydown',escape)};
  },[]);
  const unread=query.data?.unread??0;
  async function markRead(ids:string[]|null){
    try{await post('/me/notifications/read',ids===null?{}:{ids});await queryClient.invalidateQueries({queryKey:['notifications']})}catch{/* the list still works; it is only the dot */}
  }
  return <details className="dropdown bell" ref={menu}>
    <summary aria-label={unread>0?`Notifications, ${unread} unread`:'Notifications'}><Icon name="bell"/>{unread>0&&<span className="bell-count" aria-hidden="true">{unread>9?'9+':unread}</span>}</summary>
    <div className="menu-list bell-menu" role="group" aria-label="Notifications">
      <div className="bell-head"><strong>Notifications</strong>{unread>0&&<button type="button" className="linklike" onClick={()=>void markRead(null)}>Mark all as read</button>}</div>
      {query.isPending?<p className="muted">Loading…</p>:query.data?.items.length===0?<p className="muted">Nothing new yet. Assignments, results and messages show up here.</p>
        :<ul className="bell-list">{query.data?.items.map(n=><li key={n.id} className={n.read?'':'unread'}>
          <Link to={n.link} onClick={()=>{if(menu.current)menu.current.open=false;if(!n.read)void markRead([n.id])}}>
            <span className="bell-icon"><Icon name={ICON[n.kind]??'material'} size={20}/></span>
            <span className="bell-text"><strong>{n.title}</strong><span className="muted">{[n.detail,when(n.at)].filter(Boolean).join(' · ')}</span></span>
            {!n.read&&<span className="sr-only">Unread</span>}</Link></li>)}</ul>}
    </div>
  </details>;
}
