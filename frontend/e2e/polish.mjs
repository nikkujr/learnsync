// The search box (Ctrl K) and the welcome tour, for each role. Read-only: safe on development data.
import {launch,newPage,sessionFor,axe} from './lib.mjs';
const results=[];
function check(label,ok,detail=''){results.push(ok);console.log(`${ok?'PASS':'FAIL'} ${label}${detail?' - '+detail:''}`)}
const browser=await launch();
try{
  for(const [email,home,word] of [['faculty1@example.com','/faculty','Grades'],['student1@example.com','/student','Classwork'],['admin@example.com','/admin','accounts']]){
    const who=email.split('1@')[0].split('@')[0];
    const S=await sessionFor(browser,email);const p=await newPage(browser,{state:S});await p.goto(home);await p.waitForLoadState('networkidle');
    await p.keyboard.press('Control+k');await p.locator('dialog.palette input').waitFor();
    check(`${who}: Ctrl K opens the search box with a result list`,await p.locator('dialog.palette [role=option]').count()>0);
    {const v=await axe(p);check(`${who}: axe finds no violations with the search open`,v.length===0,JSON.stringify(v).slice(0,300))}
    await p.locator('dialog.palette input').fill(word);await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowUp');await p.keyboard.press('Enter');
    await p.waitForFunction(h=>location.pathname!==h,home);
    check(`${who}: Enter opens the highlighted result`,p.url().length>0&&await p.locator('dialog.palette').count()===0,p.url().replace(/^.*127.0.0.1:\d+/,''));
    await p.keyboard.press('Control+k');await p.keyboard.press('Escape');
    check(`${who}: Escape closes the search box`,await p.locator('dialog.palette').count()===0);
    await p.goto(home);await p.waitForLoadState('networkidle');
    await p.locator('details.account summary').click();await p.getByRole('button',{name:'Take the tour'}).click();
    const tour=p.locator('dialog.tour');await tour.waitFor();
    {const v=await axe(p);check(`${who}: axe finds no violations in the tour`,v.length===0,JSON.stringify(v).slice(0,300))}
    const steps=Number((await tour.locator('.tour-count').innerText()).match(/of (\d+)/)[1]);
    for(let i=1;i<steps;i++)await tour.getByRole('button',{name:'Next'}).click();
    check(`${who}: the tour has ${steps} steps and ends with Get started`,await tour.getByRole('button',{name:'Get started'}).isVisible());
    await tour.getByRole('button',{name:'Get started'}).click();
    check(`${who}: finishing closes the tour and remembers it`,await p.locator('dialog.tour').count()===0&&await p.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('learnsync:tour:'))));
  }

  // ---- the visuals (they need the showcase data: `python -m tools.seed_showcase`)
  const O=process.env.OFFERING??'dbe0fd57-e56c-486d-be77-275dfb54b967';
  {
    const S=await sessionFor(browser,'student1@example.com');const p=await newPage(browser,{state:S});
    await p.goto('/student');await p.waitForLoadState('networkidle');
    check('student: class cards show progress rings',await p.locator('.class-card .ring[role=progressbar]').count()>0);
    check('student: the day streak tile is there',/day streak/.test(await p.locator('.home-today').innerText()));
    check('student: the achievements panel lists five badges',await p.locator('.badges li').count()===5);
    {const v=await axe(p);check('student: axe clean on Home with rings and badges',v.length===0,JSON.stringify(v).slice(0,300))}
    await p.goto(`/student/offerings/${O}/results`);await p.waitForLoadState('networkidle');
    check('student: results show a score trend line',await p.locator('.trend circle').count()>=2);
    await p.goto(`/student/offerings/${O}/classwork`);await p.waitForLoadState('networkidle');
    await p.locator('main a[href*="/lessons/"]').first().click();await p.locator('.reader').waitFor();
    check('student: the lesson shows reading time and a progress line',/min read/.test(await p.locator('.reader-meta').innerText())&&await p.locator('.reader-progress').count()===1);
    const toc=p.locator('.reader-toc a');
    if(await toc.count()>1){await toc.nth(1).click();await p.waitForTimeout(700);check('student: choosing an outline entry marks it as current',await p.locator('.reader-toc li.on').count()===1)}
    {const v=await axe(p);check('student: axe clean on the lesson reader',v.length===0,JSON.stringify(v).slice(0,300))}
  }
  {
    const T=await sessionFor(browser,'faculty1@example.com');const p=await newPage(browser,{state:T});
    await p.goto(`/faculty/offerings/${O}/gradebook`);await p.locator('table').first().waitFor();
    check('teacher: the gradebook tints cells by score, with a legend',await p.locator('td.heat').count()>0&&await p.locator('.heat-legend').count()===1);
    {const v=await axe(p);check('teacher: axe clean on the tinted gradebook',v.length===0,JSON.stringify(v).slice(0,300))}
    await p.goto(`/faculty/offerings/${O}/class-standing`);await p.waitForLoadState('networkidle');
    await p.getByLabel(/Working preview/).check();await p.waitForLoadState('networkidle');
    check('teacher: class standing has the average-by-assessment bars',await p.locator('.barlist li').count()>0);
    {const v=await axe(p);check('teacher: axe clean on class standing charts',v.length===0,JSON.stringify(v).slice(0,300))}
  }
}catch(e){console.log('SCRIPT ERROR:',e.message);results.push(false)}
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean)?0:1);
