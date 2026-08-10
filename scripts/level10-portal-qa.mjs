import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const SAVE_KEY='one-move-puzzle-save-v2';
async function result(page,expected){await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:9000});const title=await page.locator('#resultTitle').textContent()||'';if(expected==='wrong'&&!/wrong/i.test(title))throw new Error(`Level 10 expected failure, got ${title}`);if(expected==='success'&&/wrong/i.test(title))throw new Error(`Level 10 expected success, got ${title}`);}
async function turn(page,key){const c=page.locator('[data-id="exitPortal"]');await c.waitFor({state:'visible',timeout:2500});await c.focus();await page.keyboard.press(key);}

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
  await page.goto(BASE,{waitUntil:'networkidle'});await page.evaluate(([k,v])=>localStorage.setItem(k,v),[SAVE_KEY,JSON.stringify({unlocked:10,stars:{},sound:false,haptics:false,attempts:{}})]);await page.reload({waitUntil:'networkidle'});await page.click('#playBtn');
  let board=page.locator('.maze-portal-board[data-maze-level="pulley"]');await board.waitFor({state:'visible',timeout:2500});
  if(await board.locator('.maze-portal-entry-art').count()!==1||await board.locator('.maze-portal-exit-control').count()!==1)throw new Error('Level 10 must visibly contain one portal pair');
  if(await board.locator('.maze-relay-pad').count()!==1||await board.locator('.maze-relay-gate').count()!==1)throw new Error('Level 10 must visibly contain one pad and one gate');
  await page.screenshot({path:'.visual-check/level10-initial-mobile.jpg',type:'jpeg',quality:75,fullPage:false});

  // Clockwise selects the direct shortcut. It teleports correctly but reaches the locked gate before the pad.
  await turn(page,'ArrowRight');
  await page.locator('.maze-portal-board.portal-live[data-maze-level="pulley"]').waitFor({state:'attached',timeout:3500});
  await page.screenshot({path:'.visual-check/level10-teleport-wrong-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await page.locator('.maze-portal-board.relay-gate-blocked[data-maze-level="pulley"]').waitFor({state:'attached',timeout:3500});
  if(await board.evaluate(el=>el.classList.contains('relay-pad-pressed')))throw new Error('Level 10 wrong shortcut illegally pressed the pad');
  await page.screenshot({path:'.visual-check/level10-gate-blocked-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await result(page,'wrong');

  // Counter-clockwise sends the exit downward, touches the pad, loops around, and returns to the same now-open gate.
  await page.click('#nextBtn');board=page.locator('.maze-portal-board[data-maze-level="pulley"]');await board.waitFor({state:'visible',timeout:2200});
  await turn(page,'ArrowLeft');
  await page.locator('.maze-portal-board.portal-live[data-maze-level="pulley"]').waitFor({state:'attached',timeout:3500});
  await page.locator('.maze-portal-board.relay-pad-pressed[data-maze-level="pulley"]').waitFor({state:'attached',timeout:3500});
  await page.locator('.maze-portal-board.relay-gate-open[data-maze-level="pulley"]').waitFor({state:'attached',timeout:1800});
  await page.screenshot({path:'.visual-check/level10-pad-gate-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:5500});
  await result(page,'success');
  await page.screenshot({path:'.visual-check/level10-result-mobile.jpg',type:'jpeg',quality:74,fullPage:false});
  await context.close();
}finally{await browser.close();}
