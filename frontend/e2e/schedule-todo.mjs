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
  check('the Schedule dialog says students will not see it until then',(await page.locator('dialog').innerText()).includes('will not see this at all'));
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
  const studentList=(await call(S1,'GET',`/learn/offerings/${O}/assessments`)).data.map(i=>i.title);
  check('scheduled work is not in the student To-do or list until it opens',!text.includes('Scheduled activity')&&!studentList.includes('Scheduled activity'),studentList.join(','));
  check('the teacher still sees the scheduled activity in Classwork',(await call(page,'GET',`/teach/offerings/${O}/assessments`)).data.some(a=>a.published?.title==='Scheduled activity'));
  await S1.getByRole('link',{name:/^Missing/}).click();await S1.waitForLoadState('networkidle');
  check('Missing explains itself (past due and not turned in) or says the student is up to date',/past due|up to date/.test(await S1.locator('main').innerText()));
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

  // ---- D: the calendar shows due work by month, for both roles
  const cal=await newPage(browser,{state:S});await cal.goto('/student/calendar');await cal.getByRole('heading',{name:'Calendar',exact:true}).waitFor();await cal.waitForLoadState('networkidle');
  const month=new Date().toLocaleDateString(undefined,{month:'long',year:'numeric'});
  check('the student calendar opens on this month',(await cal.getByRole('heading',{level:2}).first().innerText())===month);
  await cal.getByRole('button',{name:'Next month'}).click();
  check('Next month moves on by one month',(await cal.getByRole('heading',{level:2}).first().innerText())!==month);
  check('axe finds no violations on the student calendar',(await axe(cal)).length===0);
  const fcal=await newPage(browser,{state:F});await fcal.goto('/faculty/calendar');await fcal.getByRole('heading',{name:'Calendar',exact:true}).waitFor();await fcal.waitForLoadState('networkidle');
  check('the teacher calendar opens and has no axe violations',(await axe(fcal)).length===0);
  await shot(fcal,'calendar-faculty',false);

  // ---- E: an activity with nothing to upload is turned in by marking it done
  const rid=await mk('activity','Reflection note');
  const rp=await newPage(browser,{state:F});
  await rp.goto(`/faculty/offerings/${O}/assessments/${rid}/edit`);await rp.waitForLoadState('networkidle');
  await rp.getByLabel('Students turn in').selectOption('none');
  await rp.getByLabel('Grading category').selectOption({label:'Activities (50%)'});await rp.getByLabel('Grading period').selectOption({label:'Midterm'});
  await rp.getByLabel('Points',{exact:true}).fill('10');await rp.getByLabel('Due').fill('2099-02-10T17:00');await rp.waitForTimeout(1800);
  await rp.locator('details.attach-add summary',{hasText:'Add a link'}).click();
  await rp.getByLabel('Link title').fill('Syllabus reading');await rp.getByLabel('Web address').fill('https://example.com/reading');await rp.getByRole('button',{name:'Add link'}).click();
  await rp.getByText('Syllabus reading').first().waitFor();
  check('the teacher can attach a link to the assignment on the create page',await rp.locator('li',{hasText:'Syllabus reading'}).count()===1);
  await rp.getByRole('button',{name:'Assign',exact:true}).click();await rp.waitForURL(/\/classwork(\?type=\w+)?$/);
  check('the activity is published as one that needs no file',(await call(rp,'GET',`/teach/offerings/${O}/assessments/${rid}`)).data.published?.requires_file===false);
  await S1.goto(`/student/offerings/${O}/classwork?type=activity`);await S1.waitForLoadState('networkidle');
  await S1.getByRole('link',{name:'Reflection note',exact:true}).click();await S1.waitForLoadState('networkidle');
  await S1.getByRole('button',{name:'Mark as done'}).waitFor();
  check('the student sees the attached link under Materials, opening in a new tab',(await S1.locator('ul[aria-label="Materials"] a[target=_blank]').getAttribute('href'))==='https://example.com/reading');
  check('the work page offers Mark as done and no file upload',await S1.getByRole('button',{name:'Mark as done'}).count()===1&&await S1.locator('input[type=file]').count()===0);
  await S1.goto('/student');await S1.waitForLoadState('networkidle');await S1.getByRole('heading',{name:'Due soon'}).waitFor({timeout:8000}).catch(()=>{});      // while the work is still open
  check('the student Home has a Due soon strip above the class cards',await S1.getByRole('heading',{name:'Due soon'}).count()===1);
  {const v=await axe(S1);check('axe finds no violations on the student Home',v.length===0,JSON.stringify(v).slice(0,700))}
  await S1.goBack();await S1.getByRole('button',{name:'Mark as done'}).waitFor();
  await S1.getByLabel('Note for your teacher').fill('Finished in class');
  await S1.getByRole('button',{name:'Mark as done'}).click();await S1.getByText('Marked as done. Your teacher can see it now.').first().waitFor();
  await S1.getByRole('button',{name:'Unsubmit'}).waitFor();            // the page refreshes after the save
  check('after marking it done the student sees it turned in and cannot do it twice',await S1.getByRole('button',{name:'Mark as done'}).count()===0&&(await S1.locator('aside[aria-label="Your work"]').innerText()).includes('Turned in'));
  check('the student can Unsubmit it before it is graded',await S1.getByRole('button',{name:'Unsubmit'}).count()===1);
  await S1.getByRole('button',{name:'Unsubmit'}).click();await S1.getByRole('button',{name:'Mark as done'}).waitFor();
  await S1.getByLabel('Note for your teacher').fill('Finished in class');
  await S1.getByRole('button',{name:'Mark as done'}).click();await S1.getByRole('button',{name:'Unsubmit'}).waitFor();
  check('and turn it in again',await S1.getByRole('button',{name:'Unsubmit'}).count()===1);
  await S1.getByLabel('Add a private comment').fill('Is this enough?');await S1.getByRole('button',{name:'Post',exact:true}).click();await S1.getByText('Is this enough?').first().waitFor();
  check('the student can post a private comment on the work',(await S1.locator('.comment-list').innerText()).includes('Is this enough?'));
  await S1.goto('/student');await S1.waitForLoadState('networkidle');
  check('the student bell counts the unread notice about the new assignment',(await S1.locator('summary[aria-label^="Notifications"]').getAttribute('aria-label')).includes('unread'));
  await S1.locator('summary[aria-label^="Notifications"]').click();
  check('and the notice names the assignment',(await S1.locator('.bell-list').innerText()).includes('Reflection note'));
  await S1.keyboard.press('Escape');
  {const v=await axe(S1);check('axe finds no violations on the mark-as-done page',v.length===0,JSON.stringify(v).slice(0,700))}
  await rp.goto(`/faculty/offerings/${O}/assessments/${rid}/scores`);await rp.waitForLoadState('networkidle');await rp.waitForTimeout(500);
  check('the teacher sees the work as marked done, with the comment, and nothing to preview',(await rp.locator('.grade-sub').innerText()).includes('Marked as done')&&(await rp.locator('.grade-sub').innerText()).includes('Finished in class')&&await rp.locator('iframe.file-frame').count()===0);
  await shot(rp,'grading-marked-done',false);

  // ---- F: the Classroom alignment round (student tabs, Your work, People, Due soon, counts, assignment page, Return selected, Collapse all)
  await rp.goto(`/faculty/offerings/${O}/classwork`);await rp.waitForLoadState('networkidle');await rp.locator('.cw-main').first().waitFor();
  const width=(await rp.locator('.cw-main').boundingBox()).width;
  check('with a single topic group the work uses the full width (no empty right side)',width>600,String(Math.round(width)));
  const row=rp.locator('ul.seq li',{hasText:'Reflection note'}).first();      // not the bell, whose notices can mention it too
  check('a teacher row shows Turned in, Assigned and Graded counts',(await row.locator('.row-counts').innerText()).replace(/\s+/g,' ').includes('1 Turned in'));
  check('with one topic group there is no Collapse all row (it would only leave a blank gap)',await rp.getByRole('button',{name:'Collapse all'}).count()===0);
  await row.locator('summary[aria-label^="More actions"]').click();await row.getByRole('button',{name:'Archive'}).click();
  await rp.getByRole('button',{name:'Undo'}).waitFor();
  check('a row menu archives the item and offers Undo',await rp.locator('ul.seq li',{hasText:'Reflection note'}).count()===0);
  await rp.getByRole('button',{name:'Undo'}).click();await rp.locator('ul.seq li',{hasText:'Reflection note'}).first().waitFor();
  await row.getByRole('link',{name:'Reflection note',exact:true}).click();await rp.getByRole('heading',{name:'Reflection note',level:1}).waitFor();
  check('a published row opens the assignment page with the status counts',(await rp.locator('.hub-stats').innerText()).replace(/\s+/g,' ').includes('1 Turned in'));
  await rp.locator('.hub-stat',{hasText:'Turned in'}).click();await rp.waitForLoadState('networkidle');await rp.locator('.grade-student').first().waitFor();
  check('the Turned in count opens the student work page on that group',(await rp.getByRole('button',{name:/^Turned in/}).getAttribute('aria-pressed'))==='true');
  await rp.locator('.grade-student',{hasText:'Demo student 1'}).click();
  check('the teacher sees the student’s private comment next to the grade',await rp.getByText('Is this enough?').first().waitFor({timeout:8000}).then(()=>true,()=>false));
  await rp.getByLabel('Add a private comment').fill('Yes, that is enough.');await rp.getByRole('button',{name:'Post',exact:true}).click();await rp.getByText('Yes, that is enough.').first().waitFor();
  await rp.getByLabel(/^Points/).fill('9');await rp.getByRole('button',{name:/^Save/}).first().click();await rp.waitForTimeout(1500);
  await rp.getByLabel('Select Demo student 1').check();
  await rp.getByRole('button',{name:'Return 1 selected'}).click();await rp.getByText('Returned 1 result').first().waitFor();
  check('Return selected returned only the ticked student',(await call(S1,'GET',`/learn/offerings/${O}/results`)).data.results.some(r=>r.title==='Reflection note'&&r.score===9));
  await S1.goto(`/student/offerings/${O}/work/${rid}`);await S1.waitForLoadState('networkidle');
  check('the student reads the teacher’s reply in the same thread',(await S1.locator('.comment-list').innerText()).includes('Yes, that is enough.'));
  await S1.goto(`/student/offerings/${O}/stream`);await S1.waitForLoadState('networkidle');
  check('a student has the tabs Stream, Classwork and People, and no Grades tab',(await S1.getByRole('navigation',{name:'Subject sections'}).getByRole('link').allInnerTexts()).join(',')==='Stream,Classwork,People');
  await S1.goto(`/student/offerings/${O}/people`);await S1.waitForLoadState('networkidle');
  check('the student People tab shows the teacher and no classmates',(await S1.locator('main').innerText()).includes('Demo faculty 1')&&!(await S1.locator('main').innerText()).includes('Demo student 2'));
  await S1.goto(`/student/offerings/${O}/classwork`);await S1.waitForLoadState('networkidle');await S1.getByRole('link',{name:'View your work'}).click();await S1.waitForURL(/\/your-work$/);
  await S1.getByRole('button',{name:/^Returned with grade/}).click();
  check('Your work lists the returned work with its grade',(await S1.locator('main').innerText()).includes('Reflection note')&&(await S1.locator('main').innerText()).includes('9.00 / 10.00'));
  {const v=await axe(S1);check('axe finds no violations on Your work',v.length===0,JSON.stringify(v).slice(0,600))}
  await rp.goto(`/faculty/offerings/${O}/assessments/${rid}`);await rp.waitForLoadState('networkidle');
  check('axe finds no violations on the assignment page',(await axe(rp)).length===0);
  // ---- G: excusing (last, because an excused item no longer counts as returned)
  await rp.goto(`/faculty/offerings/${O}/assessments/${rid}/scores`);await rp.waitForLoadState('networkidle');await rp.locator('.grade-student',{hasText:'Demo student 1'}).click();
  await rp.getByRole('button',{name:'Excuse',exact:true}).click();await rp.getByText('is excused from this').first().waitFor();
  check('the teacher can excuse a student from the work (kept out of their grade)',(await call(rp,'GET',`/teach/offerings/${O}/assessments/${rid}/scores`)).data.find(r=>r.student==='Demo student 1').excused===true);
  await S1.goto(`/student/offerings/${O}/work/${rid}`);await S1.waitForLoadState('networkidle');
  check('the excused student is told so and has nothing to do',(await S1.locator('aside[aria-label="Your work"]').innerText()).includes('Excused')&&await S1.getByRole('button',{name:'Mark as done'}).count()===0);

  // ---- the teacher customizes the class look; the student sees it
  const lk=await newPage(browser,{state:F});await lk.goto(`/faculty/offerings/${O}/stream`);await lk.waitForLoadState('networkidle');
  await lk.getByRole('button',{name:'Customize'}).click();
  await lk.locator('label.swatch',{hasText:'Red'}).click();await lk.locator('label.swatch.art',{hasText:'Hills'}).click();
  await lk.getByRole('dialog').getByRole('button',{name:'Save'}).click();
  await lk.getByRole('dialog').waitFor({state:'hidden'});await lk.waitForLoadState('networkidle');
  check('the teacher’s colour and drawing show on the banner',await lk.locator('header.banner.art-2').count()===1&&await lk.locator('header.banner').evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(197, 34, 31)');
  await S1.goto('/student');await S1.waitForLoadState('networkidle');
  check('the student’s class card has the same look',await S1.locator('.class-card .class-head.art-2').count()>=1);
  await lk.getByRole('button',{name:'Customize'}).click();await lk.getByRole('button',{name:'Use the default'}).click();
  await lk.getByRole('dialog').waitFor({state:'hidden'});await lk.waitForLoadState('networkidle');
  check('Use the default clears the stored look',Object.keys((await call(lk,'GET','/me/class-themes')).data).length===0);
}catch(e){console.log('SCRIPT ERROR:',e.message);results.push(false)}
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean)?0:1);
