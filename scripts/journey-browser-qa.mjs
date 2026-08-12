import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

async function click(page,selector,index=0){const el=page.locator(selector).nth(index);await el.waitFor({state:'visible',timeout:3500});await el.click();}

try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.screenshot({path:'.visual-check/home-mobile.jpg',type:'jpeg',quality:70,fullPage:false});
  await page.click('#playBtn');

  const board=page.locator('.journey-board[data-journey-level="release"]');
  await board.waitFor({state:'visible',timeout:3000});
  await page.screenshot({path:'.visual-check/level1-mobile.jpg',type:'jpeg',quality:75,fullPage:false});

  // The ball must reach Gate 1 and remain there until the first mechanism is solved.
  const lock1=board.locator('[data-checkpoint="gearLock"]');
  await lock1.waitFor({state:'visible',timeout:3500});
  await lock1.evaluate(el=>new Promise((resolve,reject)=>{const started=performance.now();const tick=()=>{if(el.classList.contains('active'))resolve();else if(performance.now()-started>3500)reject(new Error('Gate 1 never became active'));else requestAnimationFrame(tick)};tick()}));
  if(!/1\/3/.test(await page.locator('#moveToken strong').textContent()||''))throw new Error('Journey UI must show Gate 1/3');
  await page.waitForTimeout(450);
  if(!(await lock1.evaluate(el=>el.classList.contains('active'))))throw new Error('Ball did not remain blocked at Gate 1');

  // Linked gear solution must require multiple coupled actions.
  await click(page,'[data-checkpoint="gearLock"] .gear-control',0);
  if(await lock1.evaluate(el=>el.classList.contains('solved')))throw new Error('Gate 1 solved after only one trivial click');
  await click(page,'[data-checkpoint="gearLock"] .gear-control',2);
  await lock1.evaluate(el=>new Promise((resolve,reject)=>{const started=performance.now();const tick=()=>{if(el.classList.contains('solved'))resolve();else if(performance.now()-started>2500)reject(new Error('Gate 1 did not solve'));else requestAnimationFrame(tick)};tick()}));
  await page.screenshot({path:'.visual-check/level1-gate1-mobile.jpg',type:'jpeg',quality:76,fullPage:false});

  const lock2=board.locator('[data-checkpoint="bridgeLock"]');
  await lock2.evaluate(el=>new Promise((resolve,reject)=>{const started=performance.now();const tick=()=>{if(el.classList.contains('active'))resolve();else if(performance.now()-started>4500)reject(new Error('Ball did not continue to Gate 2'));else requestAnimationFrame(tick)};tick()}));
  if(!/2\/3/.test(await page.locator('#moveToken strong').textContent()||''))throw new Error('Journey UI must advance to Gate 2/3');
  await click(page,'[data-checkpoint="bridgeLock"] .bridge-cell',0);
  await click(page,'[data-checkpoint="bridgeLock"] .bridge-cell',2);
  await lock2.evaluate(el=>new Promise((resolve,reject)=>{const started=performance.now();const tick=()=>{if(el.classList.contains('solved'))resolve();else if(performance.now()-started>2500)reject(new Error('Gate 2 did not solve'));else requestAnimationFrame(tick)};tick()}));
  await page.screenshot({path:'.visual-check/level1-gate2-mobile.jpg',type:'jpeg',quality:76,fullPage:false});

  const lock3=board.locator('[data-checkpoint="valveLock"]');
  await lock3.evaluate(el=>new Promise((resolve,reject)=>{const started=performance.now();const tick=()=>{if(el.classList.contains('active'))resolve();else if(performance.now()-started>4500)reject(new Error('Ball did not continue to Gate 3'));else requestAnimationFrame(tick)};tick()}));
  if(!/3\/3/.test(await page.locator('#moveToken strong').textContent()||''))throw new Error('Journey UI must advance to Gate 3/3');
  await click(page,'[data-checkpoint="valveLock"] .valve-control',0);
  await click(page,'[data-checkpoint="valveLock"] .valve-control',1);
  await lock3.evaluate(el=>new Promise((resolve,reject)=>{const started=performance.now();const tick=()=>{if(el.classList.contains('solved'))resolve();else if(performance.now()-started>2500)reject(new Error('Gate 3 did not solve'));else requestAnimationFrame(tick)};tick()}));
  await page.screenshot({path:'.visual-check/level1-gate3-mobile.jpg',type:'jpeg',quality:76,fullPage:false});

  await board.evaluate(el=>new Promise((resolve,reject)=>{const started=performance.now();const tick=()=>{if(el.classList.contains('journey-complete'))resolve();else if(performance.now()-started>5000)reject(new Error('Journey never completed after all three locks'));else requestAnimationFrame(tick)};tick()}));
  await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:5000});
  if(/wrong/i.test(await page.locator('#resultTitle').textContent()||''))throw new Error('Three solved locks must end in success');
  await page.screenshot({path:'.visual-check/level1-result-mobile.jpg',type:'jpeg',quality:76,fullPage:false});

  await context.close();
}finally{await browser.close();}
