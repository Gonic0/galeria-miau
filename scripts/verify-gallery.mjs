import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.GALLERY_URL ?? 'http://localhost:5173/';
const outputDir = path.resolve('test-results');
const projectUrl = 'https://github.com/Gonic0/galeria-miau';
const viewports = [
  { name: 'desktop', width: 1280, height: 720, isMobile: false, hasTouch: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }
];

await mkdir(outputDir, { recursive: true });

// Exercise WebGL2; allow Chromium's software fallback when no GPU is available.
const browser = await chromium.launch({
  args: ['--disable-webgpu', '--enable-unsafe-swiftshader']
});
const failures = [];
const report = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const consoleErrors = [];
    const failedResponses = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().startsWith(new URL(url).origin + '/')) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    const result = { viewport: viewport.name };
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__galleryDebug?.getState));
      await page.locator('#splash').waitFor({ state: 'hidden' });
      await page.locator('#welcome-start').click();
      await page.locator('#welcome').waitFor({ state: 'hidden' });
      await page.locator('#gallery-canvas').waitFor({ state: 'visible' });
      await page.waitForFunction(() =>
        performance.getEntriesByType('resource').some((entry) => entry.name.includes('/artworks/'))
      );
      await page.evaluate(async () => {
        await Promise.all(window.__galleryDebug.sources.map((src) => new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = resolve;
          image.onerror = () => reject(new Error(`artwork failed to load: ${src}`));
          image.src = src;
        })));
      });

      const before = await page.evaluate(() => window.__galleryDebug.getState());
      if (viewport.isMobile) {
        const forward = page.locator('[data-control="forward"]');
        const box = await forward.boundingBox();
        if (!box) throw new Error('mobile forward control is not visible');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        try {
          await waitForMovement(page, before.camera);
        } finally {
          await page.mouse.up();
        }
      } else {
        await page.keyboard.down('KeyW');
        try {
          await waitForMovement(page, before.camera);
        } finally {
          await page.keyboard.up('KeyW');
        }
      }

      const after = await page.evaluate(() => window.__galleryDebug.getState());
      const movement = Math.hypot(after.camera[0] - before.camera[0], after.camera[2] - before.camera[2]);
      if (movement < 0.18) throw new Error(`camera did not move enough (${movement.toFixed(3)}m)`);

      const artworkSamples = await page.evaluate(() => window.__galleryDebug.artworkSamples());
      const pixelStats = await readCanvasPixels(await page.locator('#gallery-canvas').screenshot(), artworkSamples);
      if (pixelStats.nonDarkSamples < 20 || pixelStats.colorfulSamples < 4) {
        throw new Error(`canvas looked blank or too flat: ${JSON.stringify(pixelStats)}`);
      }
      if (pixelStats.artworks.filter((artwork) => artwork.lumaDeviation >= 12).length < 2) {
        throw new Error(`expected visible artwork detail, got ${JSON.stringify(pixelStats.artworks)}`);
      }
      const artworkCount = await page.evaluate(() => window.__galleryDebug.artworks.length);
      if (artworkCount < 1) throw new Error('no artworks were initialized');

      const screenshot = path.join(outputDir, `gallery-${viewport.name}.png`);
      await page.screenshot({ path: screenshot });
      Object.assign(result, { screenshot, artworkCount, movement: Number(movement.toFixed(3)), pixelStats });

      await page.locator('#donate-open').click();
      await page.locator('#donation-panel').waitFor({ state: 'visible' });
      const contributionCopy = await page.locator('#donation-panel').innerText();
      if (!contributionCopy.includes('no recibe donaciones ni procesa pagos')) {
        throw new Error('contribution panel must clearly explain that the demo does not collect payments');
      }
      if (await page.locator('#donation-tiers button').count()) {
        throw new Error('demo must not offer payment tiers');
      }
      const contributionLink = await page.locator('#donation-checkout').getAttribute('href');
      const footerLink = await page.locator('#sponsor-link').getAttribute('href');
      if (contributionLink !== projectUrl || footerLink !== projectUrl) {
        throw new Error(`expected project links, got ${contributionLink} and ${footerLink}`);
      }
      const placeholderLinks = await page.locator('a[href]').evaluateAll((links) =>
        links.map((link) => link.href).filter((href) => {
          const host = new URL(href).hostname;
          return /(^|\.)example\.(org|com|net)$/.test(host);
        })
      );
      if (placeholderLinks.length) throw new Error(`placeholder links remain: ${placeholderLinks.join(', ')}`);
      await page.screenshot({ path: path.join(outputDir, `contribute-${viewport.name}.png`) });
      await page.locator('#donate-close').click();
      await page.locator('#donation-panel').waitFor({ state: 'hidden' });
      result.contributionLinks = 'ok';
    } catch (error) {
      failures.push(`${viewport.name}: ${error.message}`);
      await page.screenshot({ path: path.join(outputDir, `failure-${viewport.name}.png`) }).catch(() => {});
    } finally {
      if (consoleErrors.length) failures.push(`${viewport.name}: console errors: ${consoleErrors.join(' | ')}`);
      if (failedResponses.length) failures.push(`${viewport.name}: failed responses: ${failedResponses.join(' | ')}`);
      report.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const summary = { ok: failures.length === 0, renderer: 'WebGL2 fallback (Chromium)', report, failures };
await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;

async function waitForMovement(page, camera) {
  await page.waitForFunction((before) => {
    const after = window.__galleryDebug.getState().camera;
    return Math.hypot(after[0] - before[0], after[2] - before[2]) >= 0.2;
  }, camera);
}

async function readCanvasPixels(screenshot, artworkSamples) {
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cols = 11;
  const rows = 7;
  let nonDarkSamples = 0;
  let colorfulSamples = 0;
  let totalLuma = 0;

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      const x = Math.floor((col / (cols + 1)) * info.width);
      const y = Math.floor((row / (rows + 1)) * info.height);
      const offset = (y * info.width + x) * info.channels;
      const [r, g, b] = data.subarray(offset, offset + 3);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (luma > 24) nonDarkSamples += 1;
      if (luma > 34 && chroma > 14) colorfulSamples += 1;
      totalLuma += luma;
    }
  }

  return {
    width: info.width,
    height: info.height,
    totalSamples: rows * cols,
    nonDarkSamples,
    colorfulSamples,
    averageLuma: Number((totalLuma / (rows * cols)).toFixed(2)),
    artworks: artworkSamples.map(({ id, points }) => {
      const lumas = points.map(([x, y]) => {
        const offset = (Math.floor(y * info.height) * info.width + Math.floor(x * info.width)) * info.channels;
        return 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
      });
      const average = lumas.reduce((sum, luma) => sum + luma, 0) / lumas.length;
      const variance = lumas.reduce((sum, luma) => sum + (luma - average) ** 2, 0) / lumas.length;
      return { id, lumaDeviation: Number(Math.sqrt(variance).toFixed(2)) };
    })
  };
}
