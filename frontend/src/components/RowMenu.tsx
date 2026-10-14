import {useEffect,useRef,type ReactNode} from 'react';
import {Icon} from './Icon';

/** A ⋮ button with a small menu of actions. Closes on an outside click, Escape, or choosing an item. */
export function RowMenu({label,children}:{label:string;children:ReactNode}){
  const menu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const outside=(e:Event)=>{const d=menu.current;if(d?.open&&!(e.target instanceof Node&&d.contains(e.target)))d.open=false};
    const escape=(e:KeyboardEvent)=>{const d=menu.current;if(e.key==='Escape'&&d?.open){d.open=false;d.querySelector('summary')?.focus()}};
    document.addEventListener('click',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('click',outside);document.removeEventListener('keydown',escape)};
  },[]);
  return <details className="dropdown row-menu" ref={menu}><summary className="icon-btn" aria-label={label}><Icon name="more"/></summary>
    <div className="menu-list" role="group" aria-label={label} onClick={e=>{if((e.target as HTMLElement).closest('button,a')&&menu.current)menu.current.open=false}}>{children}</div></details>;
}
