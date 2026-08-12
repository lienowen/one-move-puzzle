import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const SAVE_KEY='one-move-puzzle-save-v3';
async function result(page,expected){await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:7500});const title=await page.locator('#resultTitle').textContent()||'';if(expected==='wrong'&&!/wrong/i.test(title))throw new Error(`Level 7 expected failure, got ${title}`);if(expected==='success'&&/wrong/i.test(title))throw new Error(`Level 7 expected success, got ${title}`);}
async function turn(page,key){const c=page.locator('[data-id="magnetDial"]');await c.waitFor({state:'visible',timeout:2500});await c.focus();await page.keyboard.press(key);}

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
  await page.goto(BASE,{waitUntil:'networkidle'});await page.evaluate(([k,v])=>localStorage.setItem(k,v),[SAVE_KEY,JSON.stringify({version:3,unlocked:7,stars:{},sound:false,haptics:false,attempts:{}})]);await page.reload({waitUntil:'networkidle'});await page.click('#playBtn');
  let board=page.locator('.maze-field-board[data-maze-level="magnet"]');await board.waitFor({state:'visible',timeout:2500});
  if(await board.locator('.maze-field-control').count()!==1)throw new Error('Level 7 must expose one magnetic field control');
  if(await board.locator('.maze-pit-art').count()!==1)throw new Error('Level 7 must expose a visible pit branch');
  await page.screenshot({path:'.visual-check/level7-initial-mobile.jpg',type:'jpeg',quality:75,fullPage:false});

  await turn(page,'ArrowLeft');
  await board.locator('.maze-ball.field-repelled').waitFor({state:'attached',timeout:4500});
  await page.screenshot({path:'.visual-check/level7-wrong-field-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await result(page,'wrong');

  await page.click('#nextBtn');board=page.locator('.maze-field-board[data-maze-level="magnet"]');await board.waitFor({state:'visible',timeout:2200});
  await turn(page,'ArrowRight');
  await board.locator('.maze-ball.field-captured').waitFor({state:'attached',timeout:4500});
  await page.screenshot({path:'.visual-check/level7-captured-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:7000});
  await result(page,'success');
  await page.screenshot({path:'.visual-check/level7-result-mobile.jpg',type:'jpeg',quality:74,fullPage:false});
  await context.close();
}finally{await browser.close();}
