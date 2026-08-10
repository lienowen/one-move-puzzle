import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const SAVE_KEY='one-move-puzzle-save-v2';

async function expectResult(page,expected){
  await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:7500});
  const title=await page.locator('#resultTitle').textContent()||'';
  if(expected==='wrong'&&!/wrong/i.test(title))throw new Error(`Level 6 expected failure, got: ${title}`);
  if(expected==='success'&&/wrong/i.test(title))throw new Error(`Level 6 expected success, got: ${title}`);
}
async function slide(page,key){const control=page.locator('[data-id="slideRow"]');await control.waitFor({state:'visible',timeout:2500});await control.focus();await page.keyboard.press(key);}

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.evaluate(([key,value])=>localStorage.setItem(key,value),[SAVE_KEY,JSON.stringify({unlocked:6,stars:{},sound:false,haptics:false,attempts:{}})]);
  await page.reload({waitUntil:'networkidle'});
  await page.click('#playBtn');
  let board=page.locator('.maze-slide-board[data-maze-level="conveyor"]');
  await board.waitFor({state:'visible',timeout:2500});
  if(await board.locator('.maze-slide-tile').count()!==3)throw new Error('Level 6 must slide exactly three authored rail tiles');
  if(await board.locator('.maze-slide-control').count()!==1)throw new Error('Level 6 needs one row-level move control');
  await page.screenshot({path:'.visual-check/level6-initial-mobile.jpg',type:'jpeg',quality:75,fullPage:false});

  await slide(page,'ArrowLeft');
  await page.locator('.maze-slide-board.slide-left').waitFor({state:'attached',timeout:1200});
  await expectResult(page,'wrong');
  await page.screenshot({path:'.visual-check/level6-wrong-mobile.jpg',type:'jpeg',quality:74,fullPage:false});

  await page.click('#nextBtn');
  board=page.locator('.maze-slide-board[data-maze-level="conveyor"]');
  await board.waitFor({state:'visible',timeout:2200});
  await slide(page,'ArrowRight');
  await page.locator('.maze-slide-board.slide-right.slide-snapped').waitFor({state:'attached',timeout:1200});
  await page.screenshot({path:'.visual-check/level6-shifted-mobile.jpg',type:'jpeg',quality:76,fullPage:false});
  await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:7000});
  await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level6-result-mobile.jpg',type:'jpeg',quality:74,fullPage:false});
  await context.close();
}finally{await browser.close();}
