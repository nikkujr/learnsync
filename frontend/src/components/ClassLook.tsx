import {useState} from 'react';
import {send,errorText} from '../app/api';
import {queryClient} from '../app/providers';
import {Dialog} from './Dialog';
import {COLORS,COLOR_NAMES,ART_NAMES,useLook} from './classes';

/** "Customize" on the banner: the teacher picks the class colour and header drawing; students and the admin see the same look. */
export function ClassLookButton({offeringId}:{offeringId:string}){
  const [open,setOpen]=useState(false);
  return <>
    <button type="button" className="banner-action" onClick={()=>setOpen(true)}>Customize</button>
    {open&&<LookDialog offeringId={offeringId} onClose={()=>setOpen(false)}/>}
  </>;
}

function LookDialog({offeringId,onClose}:{offeringId:string;onClose:()=>void}){
  const current=useLook()(offeringId);
  const [color,setColor]=useState(COLORS.indexOf(current.color));
  const [art,setArt]=useState(Number(current.art.replace('art-','')));
  const [error,setError]=useState('');
  async function save(c:number|null,a:number|null){
    try{await send('PUT',`/teach/offerings/${offeringId}/theme`,{color:c,art:a});await queryClient.invalidateQueries({queryKey:['class-themes']});onClose()}
    catch(e){setError(errorText(e))}
  }
  return <Dialog title="Customize this class" onClose={onClose}>
    <div className={`look-preview art-${art}`} style={{'--cc':COLORS[color]} as React.CSSProperties} aria-hidden="true"><strong>Preview</strong></div>
    <fieldset className="look-colors"><legend>Colour</legend>
      {COLORS.map((c,i)=><label key={c} className="swatch"><input type="radio" name="color" checked={color===i} onChange={()=>setColor(i)}/><span style={{background:c}}/><span className="sr-only">{COLOR_NAMES[i]}</span></label>)}</fieldset>
    <fieldset className="look-arts"><legend>Header drawing</legend>
      {ART_NAMES.map((n,i)=><label key={n} className="swatch art"><input type="radio" name="art" checked={art===i} onChange={()=>setArt(i)}/><span className={`art-${i}`} style={{'--cc':COLORS[color]} as React.CSSProperties}/><span className="sr-only">{n}</span></label>)}</fieldset>
    {error&&<p role="alert">{error}</p>}
    <div className="actions"><button type="button" onClick={()=>void save(null,null)}>Use the default</button><span className="grow"/><button type="button" onClick={onClose}>Cancel</button><button type="button" className="primary" onClick={()=>void save(color,art)}>Save</button></div>
  </Dialog>;
}
