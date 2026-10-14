import {useEffect,useMemo,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Icon,type IconName} from './Icon';

export interface Command{label:string;hint?:string;to:string;icon:IconName}

/** Ctrl+K / ⌘K: type to jump to a page or a class tab. Arrow keys move, Enter goes, Escape closes. */
export function CommandPalette({commands,onClose}:{commands:Command[];onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);const input=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState('');const [active,setActive]=useState(0);
  const navigate=useNavigate();
  useEffect(()=>{const d=ref.current;const origin=document.activeElement as HTMLElement|null;d?.showModal();input.current?.focus();return()=>{d?.close();origin?.focus()}},[]);
  const results=useMemo(()=>{
    const words=query.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter(c=>words.every(w=>`${c.label} ${c.hint??''}`.toLowerCase().includes(w))).slice(0,9);
  },[commands,query]);
  const go=(c:Command|undefined)=>{if(!c)return;onClose();navigate(c.to)};
  const key=(e:React.KeyboardEvent)=>{
    if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>Math.min(a+1,results.length-1))}
    else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(a-1,0))}
    else if(e.key==='Enter'){e.preventDefault();go(results[active])}
  };
  return <dialog ref={ref} className="palette" aria-label="Search" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===ref.current)onClose()}}>
    <div className="palette-box">
      <input ref={input} role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={results[active]?`pal-${active}`:undefined} aria-label="Search pages and classes"
        placeholder="Search pages and classes…" value={query} onChange={e=>{setQuery(e.target.value);setActive(0)}} onKeyDown={key}/>
      <ul id="palette-list" role="listbox" aria-label="Results">
        {results.map((c,i)=><li key={c.to+c.label} id={`pal-${i}`} role="option" aria-selected={i===active} className={i===active?'on':''} onMouseEnter={()=>setActive(i)} onClick={()=>go(c)}>
          <Icon name={c.icon} size={20}/><span className="grow"><strong>{c.label}</strong>{c.hint&&<span className="muted">{c.hint}</span>}</span></li>)}
        {results.length===0&&<li className="none muted" role="option" aria-selected="false">Nothing matches “{query}”.</li>}
      </ul>
      <p className="palette-foot muted" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</p>
    </div></dialog>;
}
