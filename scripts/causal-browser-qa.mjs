import { chromium } from 'playwright';

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';

async function expectResult(page,expected) {
  await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:7500});
  const title = await page.locator('#resultTitle').textContent() || '';
  if (expected === 'wrong' && !/wrong/i.test(title)) throw new Error(`Expected wrong result, got: ${title}`);
  if (expected === 'success' && /wrong/i.test(title)) throw new Error(`Expected success result, got: ${title}`);
}

async function rotate(page,id,key) {
  const tile = page.locator(`[data-id="${id}"]`);
  await tile.waitFor({state:'visible',timeout:2500});
  await tile.focus();
  await page.keyboard.press(key);
}

async function testLevel1(page) {
  const board = page.locator('.maze-puzzle-board[data-maze-level="release"]');
  await board.waitFor({state:'visible',timeout:2500});
  if (await board.locator('.maze-tile.rotatable').count() !== 1) throw new Error('Level 1 must expose exactly one rotatable tile');
  if (await board.locator('.maze-pit-art').count() !== 1) throw new Error('Level 1 needs a visible failure route');
  await board.screenshot({path:'.visual-check/board-mobile.jpg',type:'jpeg',quality:80});

  await rotate(page,'pivot','ArrowRight');
  await expectResult(page,'wrong');
  await page.screenshot({path:'.visual-check/level1-wrong-mobile.jpg',type:'jpeg',quality:72,fullPage:false});

  await page.click('#nextBtn');
  await page.locator('.maze-puzzle-board[data-maze-level="release"]').waitFor({state:'visible',timeout:2200});
  await rotate(page,'pivot','ArrowLeft');
  await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:6500});
  await page.screenshot({path:'.visual-check/level1-complete-mobile.jpg',type:'jpeg',quality:75,fullPage:false});
  await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level1-result-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
}

async function testLevel2(page) {
  await page.click('#nextBtn');
  const board = page.locator('.maze-puzzle-board[data-maze-level="gate"]');
  await board.waitFor({state:'visible',timeout:2500});
  if (await board.locator('.maze-tile.rotatable').count() !== 2) throw new Error('Level 2 must expose two candidate rotatable tiles');
  await page.screenshot({path:'.visual-check/level2-initial-mobile.jpg',type:'jpeg',quality:73,fullPage:false});

  // Changing pivotB wastes the only move; pivotA still sends the ball into the pit.
  await rotate(page,'pivotB','ArrowLeft');
  await expectResult(page,'wrong');
  await page.screenshot({path:'.visual-check/level2-wrong-mobile.jpg',type:'jpeg',quality:73,fullPage:false});

  await page.click('#nextBtn');
  await page.locator('.maze-puzzle-board[data-maze-level="gate"]').waitFor({state:'visible',timeout:2200});
  await rotate(page,'pivotA','ArrowLeft');
  await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:6500});
  await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level2-result-mobile.jpg',type:'jpeg',quality:73,fullPage:false});
}

async function testLevel3(page) {
  await page.click('#nextBtn');
  let board = page.locator('.maze-puzzle-board[data-maze-level="switch"]');
  await board.waitFor({state:'visible',timeout:2500});
  if (await board.locator('.maze-pad-art').count() !== 1 || await board.locator('.maze-gate-art').count() !== 1) throw new Error('Level 3 must visibly contain a pressure pad and gate');
  await page.screenshot({path:'.visual-check/level3-initial-mobile.jpg',type:'jpeg',quality:73,fullPage:false});

  // Clockwise sends the ball straight to the locked gate before touching the pad.
  await rotate(page,'pivot','ArrowRight');
  await page.locator('.maze-gate-blocked').waitFor({state:'attached',timeout:4000});
  if (await board.locator('.maze-pad-pressed').count() !== 0) throw new Error('Level 3 wrong route must not press the pad');
  await page.screenshot({path:'.visual-check/level3-gate-blocked-mobile.jpg',type:'jpeg',quality:74,fullPage:false});
  await expectResult(page,'wrong');

  // Counter-clockwise routes through the pad first, then the same gate must open.
  await page.click('#nextBtn');
  board = page.locator('.maze-puzzle-board[data-maze-level="switch"]');
  await board.waitFor({state:'visible',timeout:2200});
  await rotate(page,'pivot','ArrowLeft');
  await board.locator('.maze-pad-pressed').waitFor({state:'attached',timeout:4500});
  await board.locator('.maze-gate-open').waitFor({state:'attached',timeout:1800});
  await page.screenshot({path:'.visual-check/level3-pad-gate-mobile.jpg',type:'jpeg',quality:75,fullPage:false});
  await page.locator('.maze-board.maze-solved').waitFor({state:'attached',timeout:7000});
  await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level3-result-mobile.jpg',type:'jpeg',quality:73,fullPage:false});
}

async function testLevel4(page) {
  await page.click('#nextBtn');
  await page.locator('.signal-match-machine').waitFor({state:'visible',timeout:2500});
  await page.locator('.signal-receiver').waitFor({state:'visible',timeout:1500});
  if (await page.locator('.correct-signal').count() !== 1 || await page.locator('.decoy-signal').count() !== 1) throw new Error('Level 4 signal topology missing');
  if (await page.locator('.signal-receiver .glyph-circle').count() !== 1) throw new Error('Level 4 receiver requirement is not readable');
  await page.screenshot({path:'.visual-check/level4-initial-mobile.jpg',type:'jpeg',quality:72,fullPage:false});

  await page.click('[data-id="yellowButton"]');
  await page.locator('.signal-receiver.receiver-reject').waitFor({state:'attached',timeout:1800});
  await expectResult(page,'wrong');

  await page.click('#nextBtn');
  await page.locator('.signal-match-machine').waitFor({state:'visible',timeout:2000});
  await page.click('[data-id="greenButton"]');
  await page.locator('.signal-receiver.receiver-match').waitFor({state:'attached',timeout:1800});
  await page.locator('[data-id="gate"].signal-gate-open').waitFor({state:'attached',timeout:2200});
  await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level4-result-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
}

const browser = await chromium.launch({headless:true});
try {
  const cases = [
    {name:'mobile',width:390,height:844},
    {name:'desktop',width:620,height:900},
  ];

  for (const item of cases) {
    const context = await browser.newContext({viewport:{width:item.width,height:item.height},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page = await context.newPage();
    await page.goto(BASE,{waitUntil:'networkidle'});
    await page.screenshot({path:`.visual-check/home-${item.name}.jpg`,type:'jpeg',quality:66,fullPage:false});
    await page.click('#playBtn');
    await page.locator('.machine-board').waitFor({state:'visible'});
    await page.waitForTimeout(280);
    await page.screenshot({path:`.visual-check/level1-${item.name}.jpg`,type:'jpeg',quality:72,fullPage:false});

    if (item.name === 'mobile') {
      await testLevel1(page);
      await testLevel2(page);
      await testLevel3(page);
      await testLevel4(page);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
