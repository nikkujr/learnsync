export type Cat='lesson'|'quiz'|'activity'|'exam';
export const CATS:[Cat,string][]=[['lesson','Lessons'],['quiz','Quizzes'],['activity','Activities']];
export const FACULTY_CATS:[Cat,string][]=[...CATS,['exam','Exams']];
/** Which Classwork pill an assessment kind belongs to. */
export const catOfKind=(kind:string):Cat=>kind==='online_quiz'||kind==='offline_quiz'?'quiz':kind==='exam'?'exam':'activity';
/** The Classwork view named by ?type=. Without it (or with a value that is not a type) everything is shown together, like Classroom. */
export const catOf=(v:string|null,cats:[Cat,string][]=CATS):Cat|'all'=>cats.find(c=>c[0]===v)?.[0]??'all';
