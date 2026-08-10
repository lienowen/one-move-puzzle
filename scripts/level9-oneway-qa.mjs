import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const SAVE_KEY='one-move-puzzle-save-v2';
async function result(page,expected){await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:9000});const title=await page.locator('#resultTitle').textContent()||'';if(expected==='wrong'&&!/wrong/i.test(title))throw new Error(`Level 9 expected failure, got ${title}`);if(expected==='success'&&/wrong/i.test(title))throw new Error(`Level 9 expected success, got ${title}`);}
async function turn(page,key){const c=page.locator('[data-id="oneWayValve"]');await c.waitFor({state:'visible',timeout:2500});await c.focus();await page.keyboard.press(key);}
async function assertStillRunning(page,board){await page.waitForTimeout(1200);if(await page.locator('#resultSheet:not([hidden])').count())throw new Error('Level 9 resolved before the ball completed the loop');if(!await board.locator('.maze-ball.running').count())throw new Error('Level 9 ball stopped before reaching the delayed valve');}

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
  await page.goto(BASE,{waitUntil:'networkidle'});await page.evaluate(([k,v])=>localStorage.setItem(k,v),[SAVE_KEY,JSON.stringify({unlocked:9,stars:{},sound:false,haptics:false,attempts:{}})]);await page.reload({waitUntil:'networkidle'});await page.click('#playBtn');
  let board=page.locator('.maze-oneway-board[data-maze-level="hammer"]');await board.waitFor({state:'visible',timeout:2500});
  if(await board.locator('.maze-oneway-control').count()!==1)throw new Error('Level 9 must expose one one-way valve control');
  if(await board.locator('.maze-tile').count()<20)throw new Error('Level 9 outer loop is visually too short');
  await page.screenshot({path:'.visual-check/level9-initial-mobile.jpg',type:'jpeg',quality:75,fullPage:false});

  // Clockwise points the valve south, but the long loop returns from the south moving north.
  await turn(page,'ArrowRight');
  await assertStillRunning(page,board);
  await page.screenshot({path:'.visual-check/level9-loop-running-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await page.locator('.maze-oneway-board.valve-blocked[data-maze-level="hammer"]').waitFor({state:'attached',timeout:6500});
  await page.screenshot({path:'.visual-check/level9-blocked-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await result(page,'wrong');

  // Counter-clockwise points north. It must still run the same long loop before the valve opens.
  await page.click('#nextBtn');board=page.locator('.maze-oneway-board[data-maze-level="hammer"]');await board.waitFor({state:'visible',timeout:2200});
  await turn(page,'ArrowLeft');
  await assertStillRunning(page,board);
  await page.locator('.maze-oneway-board.valve-open[data-maze-level="hammer"]').waitFor({state:'attached',timeout:6500});
  await page.screenshot({path:'.visual-check/level9-valve-open-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:4000});
  await result(page,'success');
  await page.screenshot({path:'.visual-check/level9-result-mobile.jpg',type:'jpeg',quality:74,fullPage:false});
  await context.close();
}finally{await browser.close();}
