import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.GALLERY_URL ?? 'http://localhost:5173/';
const outputDir = path.resolve('test-results');

const viewports = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const failures = [];
const report = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    deviceScaleFactor: viewport.isMobile ? 2 : 1
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForReady(page, viewport.name);
  await page.waitForFunction(
    () =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('/artworks/') || entry.name.includes('/user-photos/')).length >= 1,
    null,
    { timeout: 8000 }
  );
  await page.waitForTimeout(900);

  const before = await page.evaluate(() => window.__galleryDebug.getState());
  if (viewport.isMobile) {
    const forward = page.locator('[data-control="forward"]');
    const box = await forward.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1400);
    await page.mouse.up();
  } else {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1400);
    await page.keyboard.up('KeyW');
  }
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.__galleryDebug.getState());
  const pixelStats = await page.evaluate(readCanvasPixels);
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.includes('/artworks/') || entry.name.includes('/user-photos/'))
      .map((entry) => entry.name.split('/').pop())
  );
  const artworkCount = await page.evaluate(() => window.__galleryDebug.artworks.length);
  const screenshotPath = path.join(outputDir, `gallery-${viewport.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const movement = Math.hypot(after.camera[0] - before.camera[0], after.camera[2] - before.camera[2]);
  const isCanvasHealthy = pixelStats.nonDarkSamples >= 20 && pixelStats.colorfulSamples >= 4;
  const movedEnough = movement >= 0.18;

  report.push({
    viewport: viewport.name,
    screenshot: screenshotPath,
    artworkCount,
    movement: Number(movement.toFixed(3)),
    pixelStats,
    resources
  });

  if (!isCanvasHealthy) {
    failures.push(`${viewport.name}: canvas pixel check looked blank or too flat`);
  }
  if (!movedEnough) {
    failures.push(`${viewport.name}: camera did not move enough (${movement.toFixed(3)}m)`);
  }
  if (artworkCount < 1 || resources.length < 1) {
    failures.push(`${viewport.name}: expected at least one artwork texture, saw ${resources.length}`);
  }
  if (consoleErrors.length) {
    failures.push(`${viewport.name}: console errors: ${consoleErrors.join(' | ')}`);
  }

  await context.close();
}

await browser.close();

console.log(JSON.stringify({ ok: failures.length === 0, report, failures }, null, 2));

if (failures.length) {
  process.exit(1);
}

function readCanvasPixels() {
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const pixel = new Uint8Array(4);
  const cols = 11;
  const rows = 7;
  let nonDarkSamples = 0;
  let colorfulSamples = 0;
  let totalLuma = 0;
  let totalSamples = 0;

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      const x = Math.floor((col / (cols + 1)) * width);
      const y = Math.floor((row / (rows + 1)) * height);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const luma = 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2];
      const chroma = Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2]);
      if (luma > 24) nonDarkSamples += 1;
      if (luma > 34 && chroma > 14) colorfulSamples += 1;
      totalLuma += luma;
      totalSamples += 1;
    }
  }

  return {
    width,
    height,
    totalSamples,
    nonDarkSamples,
    colorfulSamples,
    averageLuma: Number((totalLuma / totalSamples).toFixed(2))
  };
}

async function waitForReady(page, viewportName) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await page.evaluate(() => Boolean(window.__galleryDebug?.getState && document.querySelector('canvas')));
    if (ready) {
      return;
    }
    await page.waitForTimeout(100);
  }

  const snapshot = await page.evaluate(() => ({
    title: document.title,
    body: document.body.innerText.slice(0, 300),
    scripts: [...document.scripts].map((script) => script.src)
  }));
  throw new Error(`${viewportName}: gallery app did not expose debug bridge: ${JSON.stringify(snapshot)}`);
}
