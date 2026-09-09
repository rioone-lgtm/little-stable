// Run against npm run dev. Playwright is a tooling-only dependency, never copied with the hero.
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1648, height: 1100 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  await page.goto(
    (process.env.STABLE_ORIGIN || 'http://localhost:3000') + '/hero-preview',
  );
  await page.locator('[data-frame="wide"] [data-ready="true"]').waitFor();
  await page.getByLabel('時刻', { exact: true }).fill('14');
  await page.waitForFunction(() =>
    document.querySelector('header')?.textContent.includes('14:00'),
  );
  await page.locator('[data-frame="wide"] [data-ready="true"]').waitFor();
  // Capture only the rendered scene. No labels or controls are in the poster.
  const frame = page.locator('[data-frame="wide"]');
  await frame.evaluate((el) => {
    el.style.width = '1600px';
    el.style.height = '900px';
    el.style.maxWidth = 'none';
  });
  await page.waitForTimeout(250); // Let ResizeObserver render the new projection.
  await mkdir('public', { recursive: true });
  await frame.screenshot({ path: 'public/stable-poster.png' });
  console.log('Created public/stable-poster.png (1600 x 900, 14:00 JST).');
} finally {
  await browser.close();
}
