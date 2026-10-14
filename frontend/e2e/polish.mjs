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
}catch(e){console.log('SCRIPT ERROR:',e.message);results.push(false)}
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean)?0:1);
