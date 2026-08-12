import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const SAVE_KEY='one-move-puzzle-save-v3';

async function expectResult(page,expected){
  await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:8000});
  const title=await page.locator('#resultTitle').textContent()||'';
  if(expected==='wrong'&&!/wrong/i.test(title))throw new Error(`Expected wrong result, got: ${title}`);
  if(expected==='success'&&/wrong/i.test(title))throw new Error(`Expected success result, got: ${title}`);
}
async function rotate(page,id,key){const tile=page.locator(`[data-id="${id}"]`);await tile.waitFor({state:'visible',timeout:2500});await tile.focus();await page.keyboard.press(key);}

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.evaluate(([key,value])=>localStorage.setItem(key,value),[SAVE_KEY,JSON.stringify({version:3,stars:{release:3},sound:false,haptics:false,attempts:{}})]);
  await page.reload({waitUntil:'networkidle'});
  await page.click('#playBtn');

  // Level 2
  let board=page.locator('.maze-puzzle-board[data-maze-level="gate"]');
  await board.waitFor({state:'visible',timeout:3000});
  if(await board.locator('.maze-tile.rotatable').count()!==2)throw new Error('Level 2 must expose two candidate rotatable tiles');
  await page.screenshot({path:'.visual-check/level2-initial-mobile.jpg',type:'jpeg',quality:73,fullPage:false});
  await rotate(page,'pivotB','ArrowLeft');await expectResult(page,'wrong');
  await page.screenshot({path:'.visual-check/level2-wrong-mobile.jpg',type:'jpeg',quality:73,fullPage:false});
  await page.click('#nextBtn');board=page.locator('.maze-puzzle-board[data-maze-level="gate"]');await board.waitFor({state:'visible',timeout:2200});
  await rotate(page,'pivotA','ArrowLeft');await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:6500});await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level2-result-mobile.jpg',type:'jpeg',quality:73,fullPage:false});

  // Level 3
  await page.click('#nextBtn');board=page.locator('.maze-puzzle-board[data-maze-level="switch"]');await board.waitFor({state:'visible',timeout:2500});
  await page.screenshot({path:'.visual-check/level3-initial-mobile.jpg',type:'jpeg',quality:73,fullPage:false});
  await rotate(page,'pivot','ArrowRight');await page.locator('.maze-gate-blocked').waitFor({state:'attached',timeout:4500});
  if(await board.locator('.maze-pad-pressed').count()!==0)throw new Error('Level 3 wrong route must not press the pad');
  await page.screenshot({path:'.visual-check/level3-gate-blocked-mobile.jpg',type:'jpeg',quality:74,fullPage:false});await expectResult(page,'wrong');
  await page.click('#nextBtn');board=page.locator('.maze-puzzle-board[data-maze-level="switch"]');await board.waitFor({state:'visible',timeout:2200});
  await rotate(page,'pivot','ArrowLeft');await board.locator('.maze-pad-pressed').waitFor({state:'attached',timeout:4500});await board.locator('.maze-gate-open').waitFor({state:'attached',timeout:1800});
  await page.screenshot({path:'.visual-check/level3-pad-gate-mobile.jpg',type:'jpeg',quality:75,fullPage:false});await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:7000});await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level3-result-mobile.jpg',type:'jpeg',quality:73,fullPage:false});

  // Level 4
  await page.click('#nextBtn');board=page.locator('.maze-puzzle-board[data-maze-level="button"]');await board.waitFor({state:'visible',timeout:2500});
  await page.screenshot({path:'.visual-check/level4-initial-mobile.jpg',type:'jpeg',quality:74,fullPage:false});
  await rotate(page,'pivot','ArrowLeft');await expectResult(page,'wrong');await page.screenshot({path:'.visual-check/level4-wrong-mobile.jpg',type:'jpeg',quality:73,fullPage:false});
  await page.click('#nextBtn');board=page.locator('.maze-puzzle-board[data-maze-level="button"]');await board.waitFor({state:'visible',timeout:2200});
  await rotate(page,'pivot','ArrowRight');await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:7000});await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level4-result-mobile.jpg',type:'jpeg',quality:73,fullPage:false});

  // Level 5
  await page.click('#nextBtn');board=page.locator('.maze-vector-board[data-maze-level="spring"]');await board.waitFor({state:'visible',timeout:2500});
  await page.screenshot({path:'.visual-check/level5-initial-mobile.jpg',type:'jpeg',quality:75,fullPage:false});
  await rotate(page,'springPivot','ArrowLeft');await expectResult(page,'wrong');await page.screenshot({path:'.visual-check/level5-wrong-mobile.jpg',type:'jpeg',quality:74,fullPage:false});
  await page.click('#nextBtn');board=page.locator('.maze-vector-board[data-maze-level="spring"]');await board.waitFor({state:'visible',timeout:2200});
  await rotate(page,'springPivot','ArrowRight');await page.locator('.maze-vector-board.spring-fired[data-maze-level="spring"]').waitFor({state:'attached',timeout:4500});
  await page.locator('.maze-vector-board[data-maze-level="spring"] .maze-ball.maze-airborne').waitFor({state:'attached',timeout:1800});
  await page.screenshot({path:'.visual-check/level5-airborne-mobile.jpg',type:'jpeg',quality:76,fullPage:false});await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:7000});await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level5-result-mobile.jpg',type:'jpeg',quality:74,fullPage:false});

  await context.close();
}finally{await browser.close();}
