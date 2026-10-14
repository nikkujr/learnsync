/** A progress ring with the percentage inside; the same number is spoken by the progressbar role. */
export function Ring({value,label,size=60}:{value:number;label:string;size?:number}){
  const r=(size-8)/2,c=2*Math.PI*r,v=Math.max(0,Math.min(100,value));
  return <span className="ring" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} style={{width:size,height:size}}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><circle cx={size/2} cy={size/2} r={r} className="ring-track"/>
      <circle cx={size/2} cy={size/2} r={r} className="ring-bar" strokeDasharray={`${(v/100)*c} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`}/></svg>
    <strong aria-hidden="true">{Math.round(v)}%</strong></span>;
}
