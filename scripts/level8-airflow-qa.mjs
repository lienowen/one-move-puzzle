import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const SAVE_KEY='one-move-puzzle-save-v3';
async function result(page,expected){await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:8000});const title=await page.locator('#resultTitle').textContent()||'';if(expected==='wrong'&&!/wrong/i.test(title))throw new Error(`Level 8 expected failure, got ${title}`);if(expected==='success'&&/wrong/i.test(title))throw new Error(`Level 8 expected success, got ${title}`);}
async function turn(page,key){const c=page.locator('[data-id="fanDial"]');await c.waitFor({state:'visible',timeout:2500});await c.focus();await page.keyboard.press(key);}

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
  await page.goto(BASE,{waitUntil:'networkidle'});await page.evaluate(([k,v])=>localStorage.setItem(k,v),[SAVE_KEY,JSON.stringify({version:3,unlocked:8,stars:{},sound:false,haptics:false,attempts:{}})]);await page.reload({waitUntil:'networkidle'});await page.click('#playBtn');
  let board=page.locator('.maze-air-board[data-maze-level="fan"]');await board.waitFor({state:'visible',timeout:2500});
  if(await board.locator('.maze-air-control').count()!==1)throw new Error('Level 8 must expose one fan direction control');
  const well=board.locator('.maze-airwell');if(await well.count()!==1)throw new Error('Level 8 must visibly expose one open air well');
  const wellBox=await well.boundingBox();if(!wellBox||wellBox.width<140||wellBox.height<140)throw new Error(`Level 8 air well is not visually large enough ${JSON.stringify(wellBox)}`);
  if(await board.locator('.maze-pit-art').count()!==1)throw new Error('Level 8 must expose a visible bad landing pit');
  await page.screenshot({path:'.visual-check/level8-initial-mobile.jpg',type:'jpeg',quality:75,fullPage:false});

  await turn(page,'ArrowLeft');
  await board.locator('.maze-ball.airborne').waitFor({state:'attached',timeout:4500});
  if(!await board.evaluate(el=>el.classList.contains('air-armed')))throw new Error('Level 8 fan did not enter powered airflow state');
  await page.screenshot({path:'.visual-check/level8-wrong-airborne-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await board.locator('.maze-ball.failed').waitFor({state:'attached',timeout:3500});
  await result(page,'wrong');

  await page.click('#nextBtn');board=page.locator('.maze-air-board[data-maze-level="fan"]');await board.waitFor({state:'visible',timeout:2200});
  await turn(page,'ArrowRight');
  await board.locator('.maze-ball.airborne').waitFor({state:'attached',timeout:4500});
  await page.screenshot({path:'.visual-check/level8-carry-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await page.locator('.maze-air-board.air-correct[data-maze-level="fan"]').waitFor({state:'attached',timeout:3500});
  await page.screenshot({path:'.visual-check/level8-landed-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:7000});
  await result(page,'success');
  await page.screenshot({path:'.visual-check/level8-result-mobile.jpg',type:'jpeg',quality:74,fullPage:false});
  await context.close();
}finally{await browser.close();}
