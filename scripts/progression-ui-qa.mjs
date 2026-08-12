import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const SAVE_KEY='one-move-puzzle-save-v2';
const QA_REAL_PROGRESS_KEY='one-move-puzzle-qa-real-progress';
const browser=await chromium.launch({headless:true});

try{
  // Normal fresh-player progression: show all content, keep Level 02 locked,
  // then unlock and enter it immediately after clearing Level 01.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(BASE,{waitUntil:'networkidle'});

    const rail=page.locator('#campaignRail i');
    await rail.first().waitFor({state:'visible',timeout:2500});
    if(await rail.count()!==12)throw new Error(`Home must expose all 12 campaign steps, found ${await rail.count()}`);
    if(!/LEVEL 01 OF 12/i.test(await page.locator('#continueLabel').textContent()||''))throw new Error('Fresh save must clearly say LEVEL 01 OF 12');

    await page.click('#levelsBtn');
    const cards=page.locator('#levelGrid .level-card');
    await cards.first().waitFor({state:'visible',timeout:2500});
    if(await cards.count()!==12)throw new Error(`Level select must always show 12 cards, found ${await cards.count()}`);
    const second=cards.nth(1);
    if(!await second.isVisible())throw new Error('Level 02 card must be visible before it is unlocked');
    if(!await second.isDisabled())throw new Error('Level 02 must remain locked until Level 01 is cleared');
    if(!/LEVEL 02/i.test(await second.textContent()||''))throw new Error('Second visible card must identify itself as LEVEL 02');
    if(!/12 LEVELS · 1 UNLOCKED/i.test(await page.locator('#levelCountMeta').textContent()||''))throw new Error('Level select must communicate total content and unlock count');

    await page.click('#levelsBackBtn');
    await page.click('#playBtn');
    const pivot=page.locator('[data-id="pivot"]');
    await pivot.waitFor({state:'visible',timeout:2500});
    await pivot.focus();
    await page.keyboard.press('ArrowLeft');
    await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:7500});
    await page.waitForTimeout(80);

    const nextCopy=await page.locator('#nextBtn span').textContent()||'';
    if(!/NEXT · LEVEL 02/i.test(nextCopy))throw new Error(`Successful Level 01 must advertise Level 02, got: ${nextCopy}`);
    if(!/LEVEL 02 OF 12/i.test(await page.locator('#continueLabel').textContent()||''))throw new Error('Home progression state must advance to Level 02 after clear');

    await page.click('#nextBtn');
    await page.locator('.maze-puzzle-board[data-maze-level="gate"]').waitFor({state:'visible',timeout:3000});
    if(!/LEVEL 02/i.test(await page.locator('#levelNumber').textContent()||''))throw new Error('NEXT must actually enter Level 02');
    await context.close();
  }

  // Regression for the user-visible bug: an old dev/test save could say
  // unlocked=12 even though only Level 01 had actually been cleared. Real-player
  // loading must repair that to Level 02 instead of jumping to the finale.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(BASE,{waitUntil:'networkidle'});
    await page.evaluate(([saveKey,qaKey])=>{
      localStorage.setItem(qaKey,'1');
      localStorage.setItem(saveKey,JSON.stringify({unlocked:12,stars:{release:3},sound:false,haptics:false,attempts:{}}));
    },[SAVE_KEY,QA_REAL_PROGRESS_KEY]);
    await page.reload({waitUntil:'networkidle'});

    const repaired=await page.evaluate(saveKey=>JSON.parse(localStorage.getItem(saveKey)||'{}'),SAVE_KEY);
    if(Number(repaired.unlocked)!==2)throw new Error(`Stale unlocked=12 save must repair to unlocked=2, got ${repaired.unlocked}`);
    if(!/LEVEL 02 OF 12/i.test(await page.locator('#continueLabel').textContent()||''))throw new Error('Repaired stale save must continue at Level 02');

    await page.click('#playBtn');
    await page.locator('.maze-puzzle-board[data-maze-level="gate"]').waitFor({state:'visible',timeout:3000});
    if(!/LEVEL 02/i.test(await page.locator('#levelNumber').textContent()||''))throw new Error('Repaired stale save PLAY must enter Level 02, not Level 12');
    await context.close();
  }
}finally{
  await browser.close();
}
