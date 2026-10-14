/** A tiny seven-day line for "how active was this class"; the total is spoken instead of the shape. */
export function Sparkline({values,label}:{values:number[];label:string}){
  const w=120,h=28,top=Math.max(1,...values),step=w/(values.length-1||1);
  const pts=values.map((v,i)=>[i*step,h-3-(v/top)*(h-8)] as const);
  const line=pts.map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const total=values.reduce((a,b)=>a+b,0);
  return <span className="spark" role="img" aria-label={`${label}: ${total} in the last 7 days`}>
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true"><polygon points={`0,${h} ${line} ${w},${h}`} className="spark-fill"/><polyline points={line} className="spark-line" fill="none"/>{pts.length>0&&<circle cx={pts[pts.length-1]![0]} cy={pts[pts.length-1]![1]} r="2.5" className="spark-dot"/>}</svg>
    <span className="muted">{total===0?'No activity this week':`${total} this week`}</span></span>;
}
