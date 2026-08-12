import { chromium } from 'playwright';

const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
const SAVE_KEY='one-move-puzzle-save-v3';
const LEGACY_KEY='one-move-puzzle-save-v2';
const QA_REAL_PROGRESS_KEY='one-move-puzzle-qa-real-progress';
const browser=await chromium.launch({headless:true});

async function waitActive(page,id,timeout=4500){
  const lock=page.locator(`[data-checkpoint="${id}"]`);
  await lock.evaluate((el,limit)=>new Promise((resolve,reject)=>{const start=performance.now();const tick=()=>{if(el.classList.contains('active'))resolve();else if(performance.now()-start>limit)reject(new Error(`${el.dataset.checkpoint} never became active`));else requestAnimationFrame(tick)};tick()}),timeout);
  return lock;
}

async function solveJourney(page){
  await page.locator('.journey-board[data-journey-level="release"]').waitFor({state:'visible',timeout:3000});
  await waitActive(page,'gearLock');
  await page.locator('[data-checkpoint="gearLock"] .gear-control').nth(0).click();
  await page.locator('[data-checkpoint="gearLock"] .gear-control').nth(1).click();
  await page.locator('[data-checkpoint="gearLock"] .gear-control').nth(2).click();
  await waitActive(page,'bridgeLock');
  await page.locator('[data-checkpoint="bridgeLock"] .bridge-cell').nth(0).click();
  await page.locator('[data-checkpoint="bridgeLock"] .bridge-cell').nth(2).click();
  await waitActive(page,'valveLock');
  await page.locator('[data-checkpoint="valveLock"] .valve-control').nth(0).click();
  await page.locator('[data-checkpoint="valveLock"] .valve-control').nth(0).click();
  await page.locator('[data-checkpoint="valveLock"] .valve-control').nth(1).click();
  await page.locator('#resultSheet:not([hidden])').waitFor({state:'visible',timeout:7500});
}

try{
  {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(BASE,{waitUntil:'networkidle'});
    await page.evaluate(([v3,v2,qa])=>{localStorage.setItem(qa,'1');localStorage.removeItem(v3);localStorage.removeItem(v2);},[SAVE_KEY,LEGACY_KEY,QA_REAL_PROGRESS_KEY]);
    await page.reload({waitUntil:'networkidle'});

    const rail=page.locator('#campaignRail i');
    await rail.first().waitFor({state:'visible',timeout:2500});
    if(await rail.count()!==12)throw new Error(`Home must expose all 12 campaign steps, found ${await rail.count()}`);
    if(!/LEVEL 01 OF 12/i.test(await page.locator('#continueLabel').textContent()||''))throw new Error('Fresh save must clearly say LEVEL 01 OF 12');

    await page.click('#levelsBtn');
    const cards=page.locator('#levelGrid .level-card');
    await cards.first().waitFor({state:'visible',timeout:2500});
    if(await cards.count()!==12)throw new Error(`Level select must always show 12 cards, found ${await cards.count()}`);
    if(!await cards.nth(1).isDisabled())throw new Error('Level 02 must remain locked until Level 01 is cleared');

    await page.click('#levelsBackBtn');await page.click('#playBtn');await solveJourney(page);await page.waitForTimeout(100);
    const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),SAVE_KEY);
    if(Number(stored.version)!==3||Number(stored.unlocked)!==2||Number(stored.stars?.release||0)<=0)throw new Error(`Level 01 must create contiguous v3 progress, got ${JSON.stringify(stored)}`);
    if(!/NEXT · LEVEL 02/i.test(await page.locator('#nextBtn span').textContent()||''))throw new Error('Successful journey must advertise Level 02');
    if(!/LEVEL 02 OF 12/i.test(await page.locator('#continueLabel').textContent()||''))throw new Error('Campaign UI must advance to Level 02');

    await page.click('#nextBtn');
    await page.locator('.maze-puzzle-board[data-maze-level="gate"]').waitFor({state:'visible',timeout:3000});
    if(!/LEVEL 02/i.test(await page.locator('#levelNumber').textContent()||''))throw new Error('NEXT must actually enter Level 02');
    await context.close();
  }

  {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(BASE,{waitUntil:'networkidle'});
    await page.evaluate(([v3,v2,qa])=>{
      localStorage.setItem(qa,'1');
      localStorage.removeItem(v3);
      localStorage.setItem(v2,JSON.stringify({unlocked:12,stars:{release:3,finale:3,hammer:3},sound:false,haptics:false,attempts:{finale:9}}));
    },[SAVE_KEY,LEGACY_KEY,QA_REAL_PROGRESS_KEY]);
    await page.reload({waitUntil:'networkidle'});

    const migrated=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),SAVE_KEY);
    if(Number(migrated.unlocked)!==2)throw new Error(`Legacy pollution must migrate to unlocked=2, got ${migrated.unlocked}`);
    if(migrated.stars?.finale||migrated.stars?.hammer)throw new Error(`Non-contiguous legacy stars must be discarded: ${JSON.stringify(migrated.stars)}`);
    if(!/LEVEL 02 OF 12/i.test(await page.locator('#continueLabel').textContent()||''))throw new Error('Migrated save must continue at Level 02');
    await page.click('#playBtn');
    await page.locator('.maze-puzzle-board[data-maze-level="gate"]').waitFor({state:'visible',timeout:3000});
    await context.close();
  }
}finally{await browser.close();}
