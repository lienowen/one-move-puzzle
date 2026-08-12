import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

async function click(page,selector,index=0){const el=page.locator(selector).nth(index);await el.waitFor({state:'visible',timeout:3500});await el.click();}
async function waitClass(locator,name,timeout=4500){await locator.evaluate((el,{name,timeout})=>new Promise((resolve,reject)=>{const start=performance.now();const tick=()=>{if(el.classList.contains(name))resolve();else if(performance.now()-start>timeout)reject(new Error(`${el.dataset.checkpoint||el.className} never gained ${name}`));else requestAnimationFrame(tick)};tick()}),{name,timeout});}
async function dormant(locator){return locator.evaluate(el=>{const s=getComputedStyle(el);return Number(s.opacity)<=.45&&s.pointerEvents==='none'&&!el.classList.contains('active');});}
async function assertPhysicalMechanism(lock,gate,link,label){
  const info=await lock.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{hasHeader:!!el.querySelector('.journey-lock-head'),background:s.backgroundColor,backgroundImage:s.backgroundImage,border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],boxShadow:s.boxShadow,rect:{x:r.x,y:r.y,w:r.width,h:r.height},pointerEvents:s.pointerEvents};});
  if(info.hasHeader)throw new Error(`${label}: popup-style title/header is forbidden`);
  if(info.backgroundImage!=='none')throw new Error(`${label}: mechanism root must not use a panel background image`);
  const alpha=Number((info.background.match(/rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)/)||[])[1]??(info.background.startsWith('rgb(')?1:0));
  if(alpha>.05)throw new Error(`${label}: mechanism root still has a visible panel background (${info.background})`);
  if(info.border.some(v=>parseFloat(v)>0))throw new Error(`${label}: mechanism root still has a panel border`);
  if(info.boxShadow!=='none')throw new Error(`${label}: mechanism root still has a popup box shadow`);
  if(info.pointerEvents==='none')throw new Error(`${label}: active physical mechanism is not interactive`);

  const gateBox=await gate.boundingBox(),lockBox=await lock.boundingBox();
  if(!gateBox||!lockBox)throw new Error(`${label}: gate/mechanism geometry missing`);
  const distance=Math.hypot((gateBox.x+gateBox.width/2)-(lockBox.x+lockBox.width/2),(gateBox.y+gateBox.height/2)-(lockBox.y+lockBox.height/2));
  if(distance>95)throw new Error(`${label}: mechanism is ${distance.toFixed(1)}px from the gate and reads like a separate UI puzzle`);
  const linkOpacity=Number(await link.evaluate(el=>getComputedStyle(el).opacity));
  if(linkOpacity<.55)throw new Error(`${label}: active gate needs a visible mechanical shaft/pipe connection`);
}

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
  const gate1=board.locator('[data-gate="gearLock"]');
  const gate2=board.locator('[data-gate="bridgeLock"]');
  const gate3=board.locator('[data-gate="valveLock"]');
  const link1=board.locator('.journey-lock-link.gear-lock');
  const link2=board.locator('.journey-lock-link.bridge-lock');
  const link3=board.locator('.journey-lock-link.valve-lock');

  await waitClass(lock1,'active');
  if(!/1\/3/.test(await page.locator('#moveToken strong').textContent()||''))throw new Error('Journey UI must show Gate 1/3');
  if(!(await dormant(lock2))||!(await dormant(lock3)))throw new Error('Future mechanisms must stay visually dormant and non-interactive until reached');
  await assertPhysicalMechanism(lock1,gate1,link1,'Gate 1');
  await page.screenshot({path:'.visual-check/level1-gate1-mobile.jpg',type:'jpeg',quality:80,fullPage:false});

  const before=await board.locator('.journey-ball').boundingBox();
  await page.waitForTimeout(500);
  const after=await board.locator('.journey-ball').boundingBox();
  if(!before||!after||Math.hypot(before.x-after.x,before.y-after.y)>2)throw new Error('Ball moved through Gate 1 before its mechanism was solved');

  await click(page,'[data-checkpoint="gearLock"] .gear-control',0);
  if(await lock1.evaluate(el=>el.classList.contains('solved')))throw new Error('Gear lock solved after one trivial action');
  await click(page,'[data-checkpoint="gearLock"] .gear-control',1);
  if(await lock1.evaluate(el=>el.classList.contains('solved')))throw new Error('Gear lock solved before the required coupled reasoning sequence');
  await click(page,'[data-checkpoint="gearLock"] .gear-control',2);
  await waitClass(lock1,'solved',2500);

  await waitClass(lock2,'active');
  if(!/2\/3/.test(await page.locator('#moveToken strong').textContent()||''))throw new Error('Journey UI must advance to Gate 2/3');
  if(!(await dormant(lock1))||!(await dormant(lock3)))throw new Error('Only the bridge mechanism may be active at Gate 2');
  await assertPhysicalMechanism(lock2,gate2,link2,'Gate 2');
  await page.screenshot({path:'.visual-check/level1-gate2-mobile.jpg',type:'jpeg',quality:80,fullPage:false});
  await click(page,'[data-checkpoint="bridgeLock"] .bridge-cell',0);
  await click(page,'[data-checkpoint="bridgeLock"] .bridge-cell',2);
  await waitClass(lock2,'solved',2500);

  await waitClass(lock3,'active');
  if(!/3\/3/.test(await page.locator('#moveToken strong').textContent()||''))throw new Error('Journey UI must advance to Gate 3/3');
  if(!(await dormant(lock1))||!(await dormant(lock2)))throw new Error('Only the pressure mechanism may be active at Gate 3');
  await assertPhysicalMechanism(lock3,gate3,link3,'Gate 3');
  await page.screenshot({path:'.visual-check/level1-gate3-mobile.jpg',type:'jpeg',quality:80,fullPage:false});

  await click(page,'[data-checkpoint="valveLock"] .valve-control',0);
  await click(page,'[data-checkpoint="valveLock"] .valve-control',0);
  if(await lock3.evaluate(el=>el.classList.contains('solved')))throw new Error('Pressure gate solved before both gauges were balanced');
  await click(page,'[data-checkpoint="valveLock"] .valve-control',1);
  await waitClass(lock3,'solved',2500);

  await board.evaluate(el=>new Promise((resolve,reject)=>{const start=performance.now();const tick=()=>{if(el.classList.contains('journey-complete'))resolve();else if(performance.now()-start>6000)reject(new Error('Journey never completed after all three machines'));else requestAnimationFrame(tick)};tick()}));
  await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:5000});
  if(/wrong/i.test(await page.locator('#resultTitle').textContent()||''))throw new Error('Three solved mechanisms must end in success');
  await page.screenshot({path:'.visual-check/level1-result-mobile.jpg',type:'jpeg',quality:76,fullPage:false});

  await context.close();
}finally{await browser.close();}
