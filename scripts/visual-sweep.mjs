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
    JSON.stringify({
      unlocked: 12,
      stars: {},
      sound: false,
      haptics: false,
      attempts: {},
    }),
  ]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#levelsBtn');

  const count = await page.locator('.level-card').count();
  if (count !== 12) throw new Error(`Expected 12 level cards, found ${count}`);

  const report = [];

  for (let index = 0; index < count; index += 1) {
    const card = page.locator('.level-card').nth(index);
    await card.click();
    await page.waitForTimeout(220);

    const info = await page.evaluate(() => {
      const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      const stage = document.querySelector('#stage')?.getBoundingClientRect();
      const pieces = [...document.querySelectorAll('.machine-piece')].map(node => {
        const r = node.getBoundingClientRect();
        const visibleW = Math.max(0, Math.min(r.right, viewport.right) - Math.max(r.left, viewport.left));
        const visibleH = Math.max(0, Math.min(r.bottom, viewport.bottom) - Math.max(r.top, viewport.top));
        const area = Math.max(1, r.width * r.height);
        return {
          id: node.dataset.id,
          interactive: node.classList.contains('interactive'),
          kind: [...node.classList].find(c => c.startsWith('piece-')),
          visibleRatio: Number(((visibleW * visibleH) / area).toFixed(3)),
          rect: [r.left, r.top, r.right, r.bottom].map(v => Math.round(v)),
        };
      });
      return {
        stage: stage ? [stage.left, stage.top, stage.right, stage.bottom].map(v => Math.round(v)) : null,
        pieces,
      };
    });

    const important = info.pieces.filter(piece =>
      piece.interactive || ['ball', 'star', 'goal'].includes(piece.id)
    );
    const bad = important.filter(piece => piece.visibleRatio < 0.72);
    if (bad.length) {
      throw new Error(`Level ${index + 1}: important pieces outside camera safe zone: ${JSON.stringify(bad)}`);
    }

    await page.locator('#stage').screenshot({
      path: `.visual-check/sweep-${String(index + 1).padStart(2, '0')}.jpg`,
      type: 'jpeg',
      quality: 60,
    });

    report.push({ level: index + 1, important });
    await page.click('#gameBackBtn');
    await page.waitForTimeout(100);
  }

  await import('node:fs').then(({ writeFileSync }) => {
    writeFileSync('.visual-check/sweep-report.json', JSON.stringify(report, null, 2));
  });
} finally {
  await context.close();
  await browser.close();
}
