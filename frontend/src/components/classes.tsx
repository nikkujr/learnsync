import {useQuery} from '@tanstack/react-query';
import {api} from '../app/api';
import type {MySubject,OfferingSummary} from '../features/academics/types';

/** A class gets one banner colour for good, derived from its id (no stored setting). Every colour has 4.5:1 contrast with white text. */
const COLORS=['#1967d2','#137333','#c5221f','#8430ce','#00796b','#b06000','#c2185b','#3949ab','#0b7285','#5f6368'];
export const classColor=(id:string)=>COLORS[[...id].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7)%COLORS.length]!;
export const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]!.toUpperCase()).join('')||'?';

/** One class as the drawer, the home cards and the banner show it, for either role. */
export interface ClassInfo{id:string;code:string;title:string;teacher:string;section:string;term:string;open:boolean;active:boolean}

export function useClasses(role:'faculty'|'student',self:string){
  const faculty=useQuery({queryKey:['my-offerings'],queryFn:()=>api<OfferingSummary[]>('/me/offerings'),enabled:role==='faculty'});
  const student=useQuery({queryKey:['my-subjects'],queryFn:()=>api<MySubject[]>('/me/subjects'),enabled:role==='student'});
  const data:ClassInfo[]|undefined=role==='faculty'
    ?faculty.data?.map(o=>({id:o.id,code:o.subject.code,title:o.subject.title,teacher:self,section:o.sections.map(s=>s.name).join(', ')||'No sections',term:o.term,open:o.term_status==='open',active:true}))
    :student.data?.map(s=>({id:s.offering_id,code:s.subject.code,title:s.subject.title,teacher:s.faculty.display_name,section:s.term,term:s.term,open:s.term_status==='open',active:s.enrollment_status==='enrolled'}));
  return {data,error:(role==='faculty'?faculty:student).error,isPending:(role==='faculty'?faculty:student).isPending};
}
