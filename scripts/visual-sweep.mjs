import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const SAVE_KEY = 'one-move-puzzle-save-v2';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await context.newPage();

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [
    SAVE_KEY,
    JSON.stringify({ unlocked:12, stars:{}, sound:false, haptics:false, attempts:{} }),
  ]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#levelsBtn');

  const count = await page.locator('.level-card').count();
  if (count !== 12) throw new Error(`Expected 12 level cards, found ${count}`);
  const report = [];

  for (let index=0; index<count; index+=1) {
    await page.locator('.levels-screen.active').waitFor({state:'visible'});
    await page.locator('.level-card').nth(index).click();
    await page.locator('.game-screen.active').waitFor({state:'visible'});
    await page.waitForTimeout(240);

    const info = await page.evaluate(() => {
      const viewport = {left:0,top:0,right:innerWidth,bottom:innerHeight};
      const stageRect = document.querySelector('#stage')?.getBoundingClientRect();
      const candidates = [
        ...document.querySelectorAll('.machine-piece'),
        ...document.querySelectorAll('.maze-tile.rotatable'),
        ...document.querySelectorAll('.maze-ball,.maze-star-art,.maze-goal-art,.maze-feature-art'),
      ];
      const unique = [...new Set(candidates)];
      const pieces = unique.map((node,index) => {
        const r = node.getBoundingClientRect();
        const visibleW = Math.max(0,Math.min(r.right,viewport.right)-Math.max(r.left,viewport.left));
        const visibleH = Math.max(0,Math.min(r.bottom,viewport.bottom)-Math.max(r.top,viewport.top));
        const area = Math.max(1,r.width*r.height);
        let id = node.dataset.id || '';
        if (!id && node.classList.contains('maze-ball')) id = 'ball';
        if (!id && node.classList.contains('maze-star-art')) id = `star-${index}`;
        if (!id && node.classList.contains('maze-goal-art')) id = 'goal';
        if (!id && node.classList.contains('maze-pad-art')) id = 'pressure-pad';
        if (!id && node.classList.contains('maze-gate-art')) id = node.dataset.gateId || 'gate';
        return {
          id,
          interactive: node.classList.contains('interactive') || node.classList.contains('rotatable'),
          kind: node.classList.contains('rotatable') ? 'maze-rotator' : [...node.classList].find(c => c.startsWith('piece-') || c.startsWith('maze-')),
          visibleRatio:Number(((visibleW*visibleH)/area).toFixed(3)),
          rect:[r.left,r.top,r.right,r.bottom].map(v => Math.round(v)),
        };
      });
      return {
        stage:stageRect ? [stageRect.left,stageRect.top,stageRect.right,stageRect.bottom].map(v => Math.round(v)) : null,
        pieces,
      };
    });

    const important = info.pieces.filter(piece => piece.interactive || piece.id === 'ball' || piece.id === 'goal' || piece.id.startsWith('star-') || ['pressure-pad','gate','mainGate'].includes(piece.id));
    const warnings = important.filter(piece => piece.visibleRatio < .82);

    await page.locator('#stage').screenshot({path:`.visual-check/sweep-${String(index+1).padStart(2,'0')}.jpg`,type:'jpeg',quality:62});
    report.push({level:index+1,stage:info.stage,important,warnings,pass:warnings.length===0});

    await page.click('#gameBackBtn');
    await page.locator('.home-screen.active').waitFor({state:'visible'});
    await page.click('#levelsBtn');
  }

  const { writeFileSync } = await import('node:fs');
  writeFileSync('.visual-check/sweep-report.json',JSON.stringify(report,null,2));
} finally {
  await context.close();
  await browser.close();
}
