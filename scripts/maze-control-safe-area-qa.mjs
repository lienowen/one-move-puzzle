import { chromium } from 'playwright';
const BASE=process.env.QA_BASE_URL||'http://127.0.0.1:4173',SAVE_KEY='one-move-puzzle-save-v2';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
  async function open(level,selector){await page.goto(BASE,{waitUntil:'networkidle'});await page.evaluate(([k,v])=>localStorage.setItem(k,v),[SAVE_KEY,JSON.stringify({unlocked:level,stars:{},sound:false,haptics:false,attempts:{}})]);await page.reload({waitUntil:'networkidle'});await page.click('#playBtn');const el=page.locator(selector);await el.waitFor({state:'visible',timeout:2500});return el;}
  async function inside(name,el){const b=await el.boundingBox();if(!b)throw new Error(`${name}: no bounding box`);const margin=3;if(b.x<margin||b.y<margin||b.x+b.width>390-margin||b.y+b.height>844-margin)throw new Error(`${name}: control leaves mobile safe area ${JSON.stringify(b)}`);if(b.width<44||b.height<44)throw new Error(`${name}: touch target is below 44px ${JSON.stringify(b)}`);}
  await inside('Level 6 slide row',await open(6,'[data-id="slideRow"]'));
  await inside('Level 7 magnet dial',await open(7,'[data-id="magnetDial"]'));
  await inside('Level 8 fan dial',await open(8,'[data-id="fanDial"]'));
  await context.close();
}finally{await browser.close();}
