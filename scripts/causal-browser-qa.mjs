import { chromium } from 'playwright';

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';

function movement(a,b) {
  if (!a || !b) return 0;
  return Math.hypot(b.x-a.x,b.y-a.y);
}

async function pullPin(page) {
  const pin = page.locator('[data-id="pin"]');
  const box = await pin.boundingBox();
  if (!box) throw new Error('Pull pin has no bounding box');
  await page.mouse.move(box.x + box.width*.72,box.y + box.height*.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width*.10,box.y + box.height*.5,{steps:10});
  await page.mouse.up();
}

async function expectResult(page, expected) {
  await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:7000});
  const title = await page.locator('#resultTitle').textContent() || '';
  if (expected === 'wrong' && !/wrong/i.test(title)) throw new Error(`Expected wrong result, got: ${title}`);
  if (expected === 'success' && /wrong/i.test(title)) throw new Error(`Expected success result, got: ${title}`);
}

async function testLevel1(page) {
  await page.locator('.machine-board').screenshot({path:'.visual-check/board-mobile.jpg',type:'jpeg',quality:78});
  await pullPin(page);
  await page.locator('.piece-logic-trigger.logic-active').waitFor({state:'visible',timeout:3500});
  await page.screenshot({path:'.visual-check/level1-trigger-mobile.jpg',type:'jpeg',quality:70,fullPage:false});
  await page.locator('.machine-board.waiting-gate').waitFor({state:'attached',timeout:3500});
  await page.screenshot({path:'.visual-check/level1-gate-wait-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
  await page.locator('.piece-logic-gate.logic-gate-open').waitFor({state:'attached',timeout:3500});
  await page.locator('.machine-board.goal-powered').waitFor({state:'attached',timeout:5200});
  await page.screenshot({path:'.visual-check/level1-powered-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
  await page.locator('.machine-board.machine-complete').waitFor({state:'attached',timeout:6500});
  await page.screenshot({path:'.visual-check/level1-complete-mobile.jpg',type:'jpeg',quality:74,fullPage:false});
  await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level1-result-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
}

async function testLevel2(page) {
  await page.click('#nextBtn');
  await page.locator('.choice-gate-machine').waitFor({state:'visible',timeout:2500});
  await page.waitForTimeout(220);
  if (await page.locator('.correct-link').count() !== 1 || await page.locator('.decoy-link').count() !== 1) throw new Error('Level 2 linkage topology missing');
  await page.screenshot({path:'.visual-check/level2-initial-mobile.jpg',type:'jpeg',quality:72,fullPage:false});

  await page.click('[data-id="redLever"]');
  await page.locator('.decoy-link.link-wrong').waitFor({state:'attached',timeout:1500});
  await page.locator('.piece-choice-dead-stop.dead-stop-hit').waitFor({state:'attached',timeout:1500});
  await expectResult(page,'wrong');
  await page.screenshot({path:'.visual-check/level2-wrong-mobile.jpg',type:'jpeg',quality:72,fullPage:false});

  await page.click('#nextBtn');
  await page.locator('.choice-gate-machine').waitFor({state:'visible',timeout:2000});
  const before = await page.locator('[data-id="ball"]').boundingBox();
  await page.click('[data-id="blueLever"]');
  await page.locator('.correct-link.link-live').waitFor({state:'attached',timeout:1200});
  await page.locator('[data-id="gate"].choice-gate-open').waitFor({state:'attached',timeout:2200});
  const atOpen = await page.locator('[data-id="ball"]').boundingBox();
  if (movement(before,atOpen) > 12) throw new Error('Level 2 ball moved before gate opened');
  await page.screenshot({path:'.visual-check/level2-gate-open-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
  await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level2-result-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
}

async function testLevel3(page) {
  await page.click('#nextBtn');
  await page.locator('.route-align-machine').waitFor({state:'visible',timeout:2500});
  await page.locator('.route-gap').waitFor({state:'visible',timeout:1500});
  await page.locator('[data-id="spinner"].bridge-misaligned').waitFor({state:'visible',timeout:1500});
  if (await page.locator('.align-shaft').count() !== 1 || await page.locator('.valve-shaft').count() !== 1) throw new Error('Level 3 control topology missing');
  await page.screenshot({path:'.visual-check/level3-initial-mobile.jpg',type:'jpeg',quality:72,fullPage:false});

  await page.click('[data-id="wheel"]');
  await page.locator('.valve-shaft.valve-live').waitFor({state:'attached',timeout:1500});
  await page.locator('.piece-align-valve-stop.valve-spinning').waitFor({state:'attached',timeout:1500});
  await expectResult(page,'wrong');
  await page.screenshot({path:'.visual-check/level3-wrong-mobile.jpg',type:'jpeg',quality:72,fullPage:false});

  await page.click('#nextBtn');
  await page.locator('.route-align-machine').waitFor({state:'visible',timeout:2000});
  const before = await page.locator('[data-id="ball"]').boundingBox();
  await page.click('[data-id="crank"]');
  await page.locator('.align-shaft.shaft-live').waitFor({state:'attached',timeout:1200});
  await page.locator('[data-id="spinner"].bridge-aligned').waitFor({state:'attached',timeout:2200});
  const atAlign = await page.locator('[data-id="ball"]').boundingBox();
  if (movement(before,atAlign) > 12) throw new Error('Level 3 ball moved before bridge aligned');
  await page.screenshot({path:'.visual-check/level3-aligned-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
  await expectResult(page,'success');
  await page.screenshot({path:'.visual-check/level3-result-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
}

async function testLevel4(page) {
  await page.click('#nextBtn');
  await page.locator('.signal-match-machine').waitFor({state:'visible',timeout:2500});
  await page.locator('.signal-receiver').waitFor({state:'visible',timeout:1500});
  if (await page.locator('.correct-signal').count() !== 1 || await page.locator('.decoy-signal').count() !== 1) throw new Error('Level 4 signal topology missing');
  if (await page.locator('.signal-receiver .glyph-circle').count() !== 1) throw new Error('Level 4 receiver requirement is not readable');
  await page.screenshot({path:'.visual-check/level4-initial-mobile.jpg',type:'jpeg',quality:72,fullPage:false});

  await page.click('[data-id="yellowButton"]');
  await page.locator('.decoy-signal.signal-rejected').waitFor({state:'attached',timeout:1200});
  await page.locator('.signal-receiver.receiver-reject').waitFor({state:'attached',timeout:1800});
  await expectResult(page,'wrong');
  await page.screenshot({path:'.visual-check/level4-wrong-mobile.jpg',type:'jpeg',quality:72,fullPage:false});

  await page.click('#nextBtn');
  await page.locator('.signal-match-machine').waitFor({state:'visible',timeout:2000});
  const before = await page.locator('[data-id="ball"]').boundingBox();
  await page.click('[data-id="greenButton"]');
  await page.locator('.correct-signal.signal-accepted').waitFor({state:'attached',timeout:1200});
  await page.locator('.signal-receiver.receiver-match').waitFor({state:'attached',timeout:1800});
  const atMatch = await page.locator('[data-id="ball"]').boundingBox();
  if (movement(before,atMatch) > 12) throw new Error('Level 4 ball moved before receiver matched');
  await page.locator('[data-id="gate"].signal-gate-open').waitFor({state:'attached',timeout:2200});
  const atOpen = await page.locator('[data-id="ball"]').boundingBox();
  if (movement(before,atOpen) > 12) throw new Error('Level 4 ball moved before gate opened');
  await page.screenshot({path:'.visual-check/level4-gate-open-mobile.jpg',type:'jpeg',quality:72,fullPage:false});
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
    await page.screenshot({path:`.visual-check/level1-${item.name}.jpg`,type:'jpeg',quality:70,fullPage:false});

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
