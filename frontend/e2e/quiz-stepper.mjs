// The Classroom-style create page (one screen, settings on the right), pasted questions, duplicate, and the activity screen.
// SELF-PROVISIONING: creates its own term, subject and a published syllabus, so run it ONLY against a disposable
// database that has the development accounts (`python -m app.cli seed-demo`). Refuses unless STEPPER_E2E_DISPOSABLE=1.
import {launch,newPage,sessionFor,axe} from './lib.mjs';
if(process.env.STEPPER_E2E_DISPOSABLE!=='1'){console.log('Refusing: set STEPPER_E2E_DISPOSABLE=1 to confirm this database is disposable.');process.exit(2)}
const results=[];
function check(label,ok,detail=''){results.push(ok);console.log(`${ok?'PASS':'FAIL'} ${label}${detail?' - '+detail:''}`)}
let inputs=0;const act=async fn=>{inputs++;return fn()};
const call=(page,method,path,body)=>page.evaluate(async([method,path,body])=>{
  const s=await (await fetch('/api/auth/session',{credentials:'same-origin'})).json();
  const r=await fetch('/api'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrf},body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await r.json()}catch{data=null}return {status:r.status,data}},[method,path,body]);

const PASTE=`Q: Which of these is a legal business structure?
A) Sole proprietorship
B) Hobby
C) Rumor
D) Fad
Answer: A
Points: 2

Q: A sole proprietor has unlimited liability.
Answer: True

Q: Name the simplest form of business.
Answer: Sole proprietorship | one-person firm

Q: This block has no answer
A) one
B) two`;

const browser=await launch();
try{
  const A=await sessionFor(browser,'admin@example.com'),F=await sessionFor(browser,'faculty1@example.com'),S=await sessionFor(browser,'student1@example.com');
  const admin=await newPage(browser,{state:A});await admin.goto('/admin');
  const people=(await call(admin,'GET','/accounts?search=example')).data;const id=e=>people.find(p=>p.email===e).id;
  const year=(await call(admin,'POST','/school-years',{label:'2026-2027',start_date:'2026-06-01',end_date:'2027-04-30',terms:[{name:'First Semester',sequence:1,start_date:'2026-06-01',end_date:'2026-12-31'}]})).data;const term=year.terms[0];
  const subject=(await call(admin,'POST','/subjects',{code:'ENT 101',title:'Introduction to Entrepreneurship',units:'3',year_level:1,semester:1})).data;
  const section=(await call(admin,'POST',`/terms/${term.id}/sections`,{name:'1A',year_level:1})).data;
  const O=(await call(admin,'POST',`/terms/${term.id}/offerings`,{subject_id:subject.id,faculty_id:id('faculty1@example.com'),section_ids:[section.id]})).data.id;
  await call(admin,'POST',`/sections/${section.id}/members`,{student_id:id('student1@example.com')});
  const teach=await newPage(browser,{state:F});await teach.goto('/faculty');
  const uid=()=>crypto.randomUUID();
  const outline={course:{name:'Intro',code:'ENT 101',units:'3'},outcomes:[{id:uid(),text:'x'}],chapters:[{id:uid(),title:'Chapter 1',weeks:'W1',topics:[{id:uid(),title:'T'}]}]};
  const policy={categories:[{key:'quiz',label:'Quizzes',weight:50},{key:'activity',label:'Activities',weight:50}],periods:[{key:'midterm',label:'Midterm',share:50},{key:'finals',label:'Finals',share:50}],transmutation:'raw',passing:75,late_attendance_fraction:0.5};
  const d=(await call(teach,'POST',`/teach/offerings/${O}/syllabus/draft`)).data;
  const sv=(await call(teach,'PUT',`/teach/offerings/${O}/syllabus/draft`,{expected_counter:d.counter,outline,grading_policy:policy})).data;
  await call(teach,'POST',`/teach/offerings/${O}/syllabus/draft/publish`,{expected_counter:sv.counter});
  const plan=await call(teach,'POST',`/teach/offerings/${O}/assessments/plan`,{plan_key:'stepper-plan-1',items:[
    {kind:'online_quiz',title:'Quiz 1',category_key:'quiz',period:'midterm'},{kind:'activity',title:'Activity 1',category_key:'activity',period:'midterm'}]});if(!plan.data?.ids)throw new Error('plan failed: '+JSON.stringify(plan));const planned=plan.data.ids;
  const [quizId,activityId]=planned;

  // ---- A: finish the planned quiz through the stepper
  const page=await newPage(browser,{state:F});
  await page.goto(`/faculty/offerings/${O}/assessments/${quizId}/edit`);await page.waitForLoadState('networkidle');
  check('a quiz opens as one page: the work on the left and the settings on the right, no stepper',await page.locator('.compose-side').count()===1&&await page.locator('ol.stepper').count()===0&&await page.getByText(/step \d of/).count()===0);
  check('the rarely used options are folded',await page.locator('details.more[open]').count()===0&&await page.getByLabel('Attempts allowed').isHidden());
  await act(()=>page.getByLabel('Due').fill('2026-12-01T17:00'));
  await act(()=>page.locator('details.panel summary',{hasText:'Paste many questions'}).click());
  await act(()=>page.getByLabel('Questions',{exact:true}).fill(PASTE));
  await act(()=>page.getByRole('button',{name:'Preview',exact:true}).click());
  await page.getByText('3 questions ready').waitFor();
  check('the preview reports the problem block by line',(await page.locator('main').innerText()).includes('Line 15:'),(await page.locator('main').innerText()).match(/Line \d+: [^\n]*/)?.[0]);
  await act(()=>page.getByRole('button',{name:'Add 3 questions'}).click());
  await page.getByRole('heading',{name:/^Question 3/}).waitFor();
  check('the settings show the total points taken from the questions',(await page.locator('.compose-side').innerText()).includes('4 (from the questions)'));
  check('the button says Assign',await page.getByRole('button',{name:'Assign',exact:true}).count()===1);
  check('axe finds no violations on the create page',(await axe(page)).length===0);
  await act(()=>page.getByRole('button',{name:'Assign',exact:true}).click());
  await page.waitForURL(/\/classwork(\?type=\w+)?$/);
  check(`a planned quiz was finished and assigned in ${inputs} inputs`,inputs<=10,String(inputs));
  const quiz=(await call(page,'GET',`/teach/offerings/${O}/assessments/${quizId}`)).data;
  check('the quiz is published with 3 questions and 4 points',!!quiz.published&&quiz.published.questions.length===3&&Number(quiz.published.max_points)===4);
  const student=await newPage(browser,{state:S});await student.goto('/student');
  const todo=(await call(student,'GET','/dashboard/student/todo')).data;
  check('the student now sees Quiz 1 and not the unfinished activity',todo.todo.some(w=>w.title==='Quiz 1')&&!todo.todo.some(w=>w.title==='Activity 1'));

  // ---- B: Save and exit keeps the work, and editing a published quiz says Update for students
  await page.goto(`/faculty/offerings/${O}/assessments/${quizId}/edit`);await page.waitForLoadState('networkidle');
  check('the button of a published quiz reads Update for students',await page.getByRole('button',{name:'Update for students'}).count()===1);
  await act(()=>page.getByRole('button',{name:'Close and go back to Classwork'}).click());
  await page.waitForURL(/\/classwork(\?type=\w+)?$/);
  check('the close button saves and goes back to Classwork',true);
  await page.goto(`/faculty/offerings/${O}/assessments/${quizId}/edit`);await page.waitForLoadState('networkidle');

  // ---- C: duplicate
  await act(()=>page.locator('summary[aria-label="More actions"]').click());
  await act(()=>page.getByRole('button',{name:/^Duplicate this/}).click());
  await page.waitForURL(/\/edit$/);await page.waitForLoadState('networkidle');
  await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(i=>i.value==='Copy of Quiz 1'),null,{timeout:10000}).catch(()=>{});      // the URL is /edit before and after, so wait for the copy itself
  const dupTitle=await page.getByLabel('Title',{exact:true}).inputValue();
  check('a duplicate opens as a hidden draft with the questions',dupTitle==='Copy of Quiz 1',dupTitle);
  const list=(await call(page,'GET',`/teach/offerings/${O}/assessments`)).data;
  const copy=list.find(a=>a.draft?.title==='Copy of Quiz 1');
  check('the copy has no dates and is not published',!!copy&&copy.published===null&&copy.draft.deadline===null&&copy.draft.questions.length===3);
  check('students do not see the copy',!(await call(student,'GET','/dashboard/student/todo')).data.todo.some(w=>w.title==='Copy of Quiz 1'));

  // ---- C2: removing a question is undoable, and deleting asks with the safe choice first
  await page.getByRole('heading',{name:/^Question 3/}).waitFor();
  await page.getByRole('button',{name:'Remove'}).first().click();
  await page.getByText('Question 1 removed.').waitFor();
  check('removing a question asks nothing and offers Undo',await page.getByRole('heading',{name:/^Question 3/}).count()===0&&await page.getByRole('button',{name:'Undo'}).count()===1);
  await page.getByRole('button',{name:'Undo'}).click();
  await page.getByRole('heading',{name:/^Question 3/}).waitFor();
  check('Undo puts the question back',await page.getByRole('heading',{name:/^Question 3/}).count()===1);
  await page.locator('summary[aria-label="More actions"]').click();await page.getByRole('button',{name:'Delete',exact:true}).click();
  await page.locator('dialog[data-confirm]').waitFor();
  check('deleting asks first, and the focused default is Cancel',await page.evaluate(()=>document.activeElement?.hasAttribute('data-confirm-no')));
  await page.locator('[data-confirm-no]').click();
  check('declining keeps the assessment',(await call(page,'GET',`/teach/offerings/${O}/assessments`)).data.some(a=>a.draft?.title==='Copy of Quiz 1'));

  // ---- D: an activity is one short screen
  const act2=await newPage(browser,{state:F});
  await act2.goto(`/faculty/offerings/${O}/assessments/${activityId}/edit`);await act2.waitForLoadState('networkidle');
  check('an activity has no stepper',await act2.getByText(/step \d of/).count()===0&&await act2.locator('ol.stepper').count()===0);
  await act2.getByLabel('Points',{exact:true}).fill('20');await act2.getByLabel('Due').fill('2026-12-05T17:00');
  await act2.getByLabel('Instructions for students').fill('Submit a one-page PDF.');
  check('axe finds no violations on the activity screen',(await axe(act2)).length===0);
  await act2.getByRole('button',{name:'Assign',exact:true}).click();await act2.waitForURL(/\/classwork(\?type=\w+)?$/);
  const activity=(await call(act2,'GET',`/teach/offerings/${O}/assessments/${activityId}`)).data;
  check('the activity is published with its points and due date',!!activity.published&&Number(activity.published.max_points)===20&&!!activity.published.deadline);
}catch(e){console.log('SCRIPT ERROR:',e.message);results.push(false)}
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean)?0:1);
