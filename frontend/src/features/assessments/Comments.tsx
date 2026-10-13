import {useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,post,errorText} from '../../app/api';
import {when} from './types';

interface Comment{id:string;author:string;role:string;body:string;at:string}

/** A private conversation between one student and the teacher about one assessment: nobody else can read it. */
export function CommentThread({url,disabled=false}:{url:string;disabled?:boolean}){
  const query=useQuery({queryKey:['comments',url],queryFn:()=>api<Comment[]>(url)});
  const [text,setText]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError('');setBusy(true);
    try{await post(url,{body:text});setText('');await query.refetch()}catch(err){setError(errorText(err))}finally{setBusy(false)}
  }
  return <section className="comments" aria-label="Private comments"><h3>Private comments</h3>
    {query.data&&query.data.length>0?<ul className="comment-list">{query.data.map(c=><li key={c.id} className={c.role==='student'?'from-student':'from-teacher'}>
      <p className="comment-meta"><strong>{c.author}</strong><span className="muted">{when(c.at)}</span></p><p className="pre">{c.body}</p></li>)}</ul>
      :<p className="muted">{query.isPending?'Loading…':'No comments yet. Only you and your teacher can see this.'}</p>}
    {!disabled&&<form onSubmit={submit}><label>Add a private comment<textarea value={text} maxLength={2000} onChange={e=>setText(e.target.value)} required/></label>
      <button disabled={busy||text.trim()===''}>{busy?'Posting…':'Post'}</button></form>}
    {error&&<p role="alert" className="error">{error}</p>}</section>;
}
