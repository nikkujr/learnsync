import {useEffect,useMemo,useRef,useState} from 'react';

/** A lesson as a reader sees it: reading time, a progress line, an outline of its headings that follows the scroll, and callouts. */
export function LessonReader({html}:{html:string}){
  const body=useRef<HTMLDivElement>(null);const pinned=useRef('');           // the entry just chosen, kept current when a short page cannot scroll far enough
  const [progress,setProgress]=useState(0);const [active,setActive]=useState('');
  const parsed=useMemo(()=>{
    const doc=new DOMParser().parseFromString(html||'','text/html');
    const heads=[...doc.body.querySelectorAll('h2,h3')].map((h,i)=>{h.id=`sec-${i}`;return {id:h.id,text:h.textContent??'',level:h.tagName==='H3'?3:2}});
    const words=(doc.body.textContent??'').trim().split(/\s+/).filter(Boolean).length;
    return {html:doc.body.innerHTML,heads,minutes:Math.max(1,Math.round(words/200))};
  },[html]);
  useEffect(()=>{
    const onScroll=()=>{
      const el=body.current;if(!el)return;
      const r=el.getBoundingClientRect(),vh=window.innerHeight;
      setProgress(Math.max(0,Math.min(100,((vh*0.85-r.top)/Math.max(1,r.height))*100)));
      let current='';for(const h of parsed.heads){const t=document.getElementById(h.id);if(t&&t.getBoundingClientRect().top<140)current=h.id}
      if(current)pinned.current='';
      setActive(current||pinned.current);
    };
    onScroll();window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onScroll);
    return()=>{window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll)};
  },[parsed]);
  const go=(id:string)=>(e:React.MouseEvent)=>{e.preventDefault();pinned.current=id;setActive(id);document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})};
  return <div className="reader">
    <div className="reader-progress" role="progressbar" aria-label="Reading progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${progress}%`}}/></div>
    <p className="muted reader-meta">About {parsed.minutes} min read</p>
    <div className={parsed.heads.length>1?'reader-grid has-toc':'reader-grid'}>
      <div className="rich-content reader-body" ref={body} dangerouslySetInnerHTML={{__html:parsed.html}}/>
      {parsed.heads.length>1&&<nav className="reader-toc" aria-label="In this lesson"><p className="eyebrow">In this lesson</p>
        <ul>{parsed.heads.map(h=><li key={h.id} className={`${h.level===3?'sub ':''}${active===h.id?'on':''}`}><a href={`#${h.id}`} onClick={go(h.id)} aria-current={active===h.id?'location':undefined}>{h.text}</a></li>)}</ul></nav>}
    </div></div>;
}
