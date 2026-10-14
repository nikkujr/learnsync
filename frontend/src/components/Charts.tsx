/** Horizontal bars, one per row, each with its number in words (the bars are decoration). */
export function BarList({rows,title}:{rows:{label:string;value:number|null;note:string}[];title:string}){
  return <figure className="barlist"><figcaption>{title}</figcaption>
    <ul>{rows.map(r=><li key={r.label}><span className="bl-label">{r.label}</span>
      <span className="bl-track" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,r.value??0))}%`}} className={r.value!==null&&r.value<60?'low':''}/></span>
      <span className="bl-note">{r.value===null?'—':`${Math.round(r.value)}%`} <span className="muted">{r.note}</span></span></li>)}</ul></figure>;
}

/** A line through a student's scores in order, as percentages of the points available. */
export function TrendLine({points,title}:{points:{label:string;value:number}[];title:string}){
  const w=560,h=170,l=34,r=12,t=12,b=26,n=points.length;
  const x=(i:number)=>l+(n===1?(w-l-r)/2:i*(w-l-r)/(n-1));const y=(v:number)=>t+(100-Math.max(0,Math.min(100,v)))/100*(h-t-b);
  const line=points.map((p,i)=>`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const avg=points.reduce((a,p)=>a+p.value,0)/Math.max(1,n);
  return <figure className="trend" role="img" aria-label={`${title}: ${points.map(p=>`${p.label} ${Math.round(p.value)} percent`).join('; ')}. Average ${Math.round(avg)} percent.`}>
    <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {[0,25,50,75,100].map(g=><g key={g}><line x1={l} x2={w-r} y1={y(g)} y2={y(g)} className="trend-grid"/><text x={l-6} y={y(g)+4} textAnchor="end" className="trend-axis">{g}</text></g>)}
      {n>1&&<polygon points={`${x(0)},${y(0)} ${line} ${x(n-1)},${y(0)}`} className="trend-fill"/>}
      <polyline points={line} fill="none" className="trend-line"/>
      {points.map((p,i)=><circle key={i} cx={x(i)} cy={y(p.value)} r="4" className="trend-dot"><title>{`${p.label}: ${Math.round(p.value)}%`}</title></circle>)}
    </svg>
    <figcaption className="muted">{title} · average {Math.round(avg)}%</figcaption></figure>;
}
