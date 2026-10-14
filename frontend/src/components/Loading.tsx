/** Placeholder lines shown while a page loads; screen readers hear "Loading…". */
export function Loading({lines=3}:{lines?:number}){
  return <div className="skeleton" role="status" aria-busy="true"><span className="sr-only">Loading…</span>{Array.from({length:lines},(_,i)=><i key={i} style={{width:`${92-i*14}%`}}/>)}</div>;
}
