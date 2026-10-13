// Schedule (opening time), the lesson page and the To-do tabs.
// SELF-PROVISIONING: creates its own term, subject and a published syllabus, so run it ONLY against a disposable
// database that has the development accounts (`python -m app.cli seed-demo`). Refuses unless SCHEDULE_E2E_DISPOSABLE=1.
import {launch,newPage,sessionFor,axe,shot} from './lib.mjs';
if(process.env.SCHEDULE_E2E_DISPOSABLE!=='1'){console.log('Refusing: set SCHEDULE_E2E_DISPOSABLE=1 to confirm this database is disposable.');process.exit(2)}
const results=[];
function check(label,ok,detail=''){results.push(ok);console.log(`${ok?'PASS':'FAIL'} ${label}${detail?' - '+detail:''}`)}
const call=(page,method,path,body)=>page.evaluate(async([method,path,body])=>{
  const s=await (await fetch('/api/auth/session',{credentials:'same-origin'})).json();
  const r=await fetch('/api'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrf},body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await r.json()}catch{data=null}return {status:r.status,data}},[method,path,body]);


const browser=await launch();
try{
  const A=await sessionFor(browser,'admin@example.com'),F=await sessionFor(browser,'faculty1@example.com'),S=await sessionFor(browser,'student1@example.com');
  const admin=await newPage(browser,{state:A});await admin.goto('/admin');
  const people=(await call(admin,'GET','/accounts?search=example')).data;const id=e=>people.find(p=>p.email===e).id;
  const year=(await call(admin,'POST','/school-years',{label:'2027-2028',start_date:'2027-06-01',end_date:'2028-04-30',terms:[{name:'First Semester',sequence:1,start_date:'2027-06-01',end_date:'2027-12-31'}]})).data;const term=year.terms[0];
  const subject=(await call(admin,'POST','/subjects',{code:'ENT 301',title:'Introduction to Entrepreneurship',units:'3',year_level:1,semester:1})).data;
  const section=(await call(admin,'POST',`/terms/${term.id}/sections`,{name:'1A',year_level:1})).data;
  const O=(await call(admin,'POST',`/terms/${term.id}/offerings`,{subject_id:subject.id,faculty_id:id('faculty1@example.com'),section_ids:[section.id]})).data.id;
  await call(admin,'POST',`/sections/${section.id}/members`,{student_id:id('student1@example.com')});
  const teach=await newPage(browser,{state:F});await teach.goto('/faculty');
  const uid=()=>crypto.randomUUID();
  const outline={course:{name:'Intro',code:'ENT 301',units:'3'},outcomes:[{id:uid(),text:'x'}],chapters:[{id:uid(),title:'Chapter 1',weeks:'W1',topics:[{id:uid(),title:'T'}]}]};
  const policy={categories:[{key:'quiz',label:'Quizzes',weight:50},{key:'activity',label:'Activities',weight:50}],periods:[{key:'midterm',label:'Midterm',share:50},{key:'finals',label:'Finals',share:50}],transmutation:'raw',passing:75,late_attendance_fraction:0.5};
  const d=(await call(teach,'POST',`/teach/offerings/${O}/syllabus/draft`)).data;
  const sv=(await call(teach,'PUT',`/teach/offerings/${O}/syllabus/draft`,{expected_counter:d.counter,outline,grading_policy:policy})).data;
  await call(teach,'POST',`/teach/offerings/${O}/syllabus/draft/publish`,{expected_counter:sv.counter});
  const S1=await newPage(browser,{state:S});await S1.goto('/student');
  const mk=async(kind,title)=>{const a=(await call(teach,'POST',`/teach/offerings/${O}/assessments`,{kind,title,section_ids:[]})).data;return a.id};

  // ---- A: Schedule from the Assign menu publishes with an opening time
  const aid=await mk('activity','Scheduled activity');
  const page=await newPage(browser,{state:F});
  await page.goto(`/faculty/offerings/${O}/assessments/${aid}/edit`);await page.waitForLoadState('networkidle');
  await page.getByLabel('Grading category').selectOption({label:'Activities (50%)'});await page.getByLabel('Grading period').selectOption({label:'Midterm'});
  await page.getByLabel('Points',{exact:true}).fill('10');await page.getByLabel('Due').fill('2099-01-10T17:00');await page.waitForTimeout(1800);
  await page.locator('summary[aria-label="More ways to assign"]').click();
  check('the Assign menu offers Schedule and Save draft',await page.getByRole('button',{name:'Schedule…'}).count()===1&&await page.getByRole('button',{name:'Save draft and close'}).count()===1);
  await shot(page,'schedule-menu',false);
  await page.getByRole('button',{name:'Schedule…'}).click();await page.locator('dialog[open]').waitFor();
  check('the Schedule dialog says students see it as not open yet',(await page.locator('dialog').innerText()).includes('not open yet'));
  await page.locator('dialog input[name=when]').fill('2099-01-05T08:00');
  await page.locator('dialog').getByRole('button',{name:'Schedule',exact:true}).click();
  await page.waitForURL(/\/classwork(\?type=\w+)?$/);
  const sched=(await call(page,'GET',`/teach/offerings/${O}/assessments/${aid}`)).data;
  check('the activity is published with the chosen opening time',!!sched.published&&new Date(sched.published.available_from).getFullYear()===2099&&new Date(sched.published.available_from).getMonth()===0);

  // ---- B: the student To-do has Assigned, Missing and Done, with weeks as groups
  await S1.goto('/student/todo');await S1.waitForLoadState('networkidle');
  const tabs=await S1.getByRole('navigation',{name:'To-do sections'}).getByRole('link').allInnerTexts();
  check('To-do has the tabs Assigned, Missing and Done',['Assigned','Missing','Done'].every(t=>tabs.some(x=>x.startsWith(t))),tabs.join(','));
  const text=await S1.locator('main').innerText();
  check('the scheduled activity is listed under Later and says when it opens',text.includes('Later')&&text.includes('Scheduled activity')&&/opens/.test(text));
  await S1.getByRole('link',{name:/^Missing/}).click();await S1.waitForLoadState('networkidle');
  check('Missing explains it is for late work that is still accepted',(await S1.locator('main').innerText()).includes('late'));
  await shot(S1,'todo-missing',false);
  check('axe finds no violations on the To-do page',(await axe(S1)).length===0);

  // ---- C: Create > Lesson opens the lesson page at once, as a draft that can be named and closed
  const lp=await newPage(browser,{state:F});
  await lp.goto(`/faculty/offerings/${O}/classwork`);await lp.waitForLoadState('networkidle');
  await lp.getByText('+ Create').click();await lp.getByRole('button',{name:'Lesson',exact:true}).click();
  await lp.getByText('Lesson content').waitFor();
  check('the lesson page has the settings on the right',await lp.locator('.compose-side').count()===1&&await lp.getByRole('button',{name:'Publish',exact:true}).count()===1);
  await lp.getByLabel('Title',{exact:true}).fill('Compose lesson');await lp.waitForTimeout(1800);
  await shot(lp,'lesson-compose',false);
  check('axe finds no violations on the lesson page',(await axe(lp)).length===0);
  await lp.getByRole('button',{name:'Close and go back to Classwork'}).click();await lp.waitForURL(/\/classwork(\?type=\w+)?$/);
  check('the closed lesson stays as a draft in Classwork',await lp.getByText('Compose lesson').first().waitFor({timeout:8000}).then(()=>true,()=>false));
}catch(e){console.log('SCRIPT ERROR:',e.message);results.push(false)}
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean)?0:1);
