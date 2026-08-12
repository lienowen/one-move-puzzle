import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

async function click(page,selector,index=0){const el=page.locator(selector).nth(index);await el.waitFor({state:'visible',timeout:3500});await el.click();}
async function waitClass(locator,name,timeout=4500){await locator.evaluate((el,{name,timeout})=>new Promise((resolve,reject)=>{const start=performance.now();const tick=()=>{if(el.classList.contains(name))resolve();else if(performance.now()-start>timeout)reject(new Error(`${el.dataset.checkpoint||el.className} never gained ${name}`));else requestAnimationFrame(tick)};tick()}),{name,timeout});}
async function hidden(locator){return locator.evaluate(el=>{const s=getComputedStyle(el);return s.visibility==='hidden'||Number(s.opacity)<.08;});}

try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.screenshot({path:'.visual-check/home-mobile.jpg',type:'jpeg',quality:70,fullPage:false});
  await page.click('#playBtn');

  const board=page.locator('.journey-board[data-journey-level="release"]');
  await board.waitFor({state:'visible',timeout:3000});
  await page.screenshot({path:'.visual-check/level1-mobile.jpg',type:'jpeg',quality:75,fullPage:false});

  const lock1=board.locator('[data-checkpoint="gearLock"]');
  const lock2=board.locator('[data-checkpoint="bridgeLock"]');
  const lock3=board.locator('[data-checkpoint="valveLock"]');
  await waitClass(lock1,'active');
  if(!/1\/3/.test(await page.locator('#moveToken strong').textContent()||''))throw new Error('Journey UI must show Gate 1/3');
  if(!(await hidden(lock2))||!(await hidden(lock3)))throw new Error('Future mechanisms must stay visually dormant until the ball reaches them');

  // Ball must remain physically stopped while the active gate is unresolved.
  const before=await board.locator('.journey-ball').boundingBox();
  await page.waitForTimeout(500);
  const after=await board.locator('.journey-ball').boundingBox();
  if(!before||!after||Math.hypot(before.x-after.x,before.y-after.y)>2)throw new Error('Ball moved through Gate 1 before its mechanism was solved');

  // Gear train: minimum three coupled actions: left -> middle -> right.
  await click(page,'[data-checkpoint="gearLock"] .gear-control',0);
  if(await lock1.evaluate(el=>el.classList.contains('solved')))throw new Error('Gear lock solved after one trivial action');
  await click(page,'[data-checkpoint="gearLock"] .gear-control',1);
  if(await lock1.evaluate(el=>el.classList.contains('solved')))throw new Error('Gear lock solved before the required coupled reasoning sequence');
  await click(page,'[data-checkpoint="gearLock"] .gear-control',2);
  await waitClass(lock1,'solved',2500);
  await page.screenshot({path:'.visual-check/level1-gate1-mobile.jpg',type:'jpeg',quality:76,fullPage:false});

  await waitClass(lock2,'active');
  if(!/2\/3/.test(await page.locator('#moveToken strong').textContent()||''))throw new Error('Journey UI must advance to Gate 2/3');
  if(!(await hidden(lock1))||!(await hidden(lock3)))throw new Error('Only the bridge mechanism may be exposed at Gate 2');
  await click(page,'[data-checkpoint="bridgeLock"] .bridge-cell',0);
  await click(page,'[data-checkpoint="bridgeLock"] .bridge-cell',2);
  await waitClass(lock2,'solved',2500);
  await page.screenshot({path:'.visual-check/level1-gate2-mobile.jpg',type:'jpeg',quality:76,fullPage:false});

  await waitClass(lock3,'active');
  if(!/3\/3/.test(await page.locator('#moveToken strong').textContent()||''))throw new Error('Journey UI must advance to Gate 3/3');
  if(!(await hidden(lock1))||!(await hidden(lock2)))throw new Error('Only the pressure mechanism may be exposed at Gate 3');

  // Pressure balance: no target marker matching. Two turns on left, one on right makes 5 == 5.
  await click(page,'[data-checkpoint="valveLock"] .valve-control',0);
  await click(page,'[data-checkpoint="valveLock"] .valve-control',0);
  if(await lock3.evaluate(el=>el.classList.contains('solved')))throw new Error('Pressure gate solved before both gauges were balanced');
  await click(page,'[data-checkpoint="valveLock"] .valve-control',1);
  await waitClass(lock3,'solved',2500);
  await page.screenshot({path:'.visual-check/level1-gate3-mobile.jpg',type:'jpeg',quality:76,fullPage:false});

  await board.evaluate(el=>new Promise((resolve,reject)=>{const start=performance.now();const tick=()=>{if(el.classList.contains('journey-complete'))resolve();else if(performance.now()-start>6000)reject(new Error('Journey never completed after all three machines'));else requestAnimationFrame(tick)};tick()}));
  await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:5000});
  if(/wrong/i.test(await page.locator('#resultTitle').textContent()||''))throw new Error('Three solved mechanisms must end in success');
  await page.screenshot({path:'.visual-check/level1-result-mobile.jpg',type:'jpeg',quality:76,fullPage:false});

  await context.close();
}finally{await browser.close();}
