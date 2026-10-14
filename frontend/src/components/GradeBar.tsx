/** A slim bar for a 0-100 grade, beside the number (the number is always there for screen readers). */
export function GradeBar({value,pass}:{value:number|null;pass?:boolean}){
  if(value===null||Number.isNaN(value))return null;
  return <span className={`gbar${pass===false?' low':''}`} aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></span>;
}

const BINS:[string,number,number][]=[['Below 60',-Infinity,60],['60–69',60,70],['70–79',70,80],['80–89',80,90],['90–100',90,Infinity]];
/** How the class's grades are spread: five columns, each with its count. */
export function Distribution({values,title}:{values:number[];title:string}){
  const counts=BINS.map(([,lo,hi])=>values.filter(v=>v>=lo&&v<hi).length);
  const top=Math.max(1,...counts);
  return <figure className="dist" role="img" aria-label={`${title}: ${BINS.map(([l],i)=>`${l}, ${counts[i]}`).join('; ')}`}>
    <div className="dist-bars" aria-hidden="true">{BINS.map(([l],i)=><div key={l} className={i===0?'low':''}><span className="dist-n">{counts[i]}</span><i style={{height:`${(counts[i]/top)*100}%`}}/><span className="dist-l">{l}</span></div>)}</div>
    <figcaption className="muted">{title}</figcaption></figure>;
}
