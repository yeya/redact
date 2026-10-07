import { test, expect, type Page } from '@playwright/test';

type RGBA = [number, number, number, number];

const RED: RGBA = [220, 40, 40, 255];
const BLUE: RGBA = [40, 40, 220, 255];

/** A 400×200 PNG of 4px-wide red/blue vertical stripes, built in the browser. */
async function stripesPng(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(
    ([red, blue]) => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 200;
      const ctx = c.getContext('2d')!;
      for (let x = 0; x < 400; x += 4) {
        const [r, g, b] = (x / 4) % 2 ? blue : red;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, 0, 4, 200);
      }
      return c.toDataURL('image/png').split(',')[1];
    },
    [RED, BLUE],
  );
  return Buffer.from(b64, 'base64');
}

/** Decode an exported PNG in the browser and read the given pixels. */
async function pixels(page: Page, png: Buffer, points: [number, number][]): Promise<RGBA[]> {
  return page.evaluate(
    async ({ b64, points }) => {
      // decode without fetch(): the app's CSP forbids network access, data: included
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      return points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data) as RGBA);
    },
    { b64: png.toString('base64'), points },
  );
}

async function exportPng(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('redacted.png');
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

test('load → draw → blur/solid → export, with no CSP violations', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  page.on('pageerror', (e) => problems.push(e.message));
  // build the fixture on a blank page, outside the app and its CSP
  await page.goto('about:blank');
  const png = await stripesPng(page);

  await page.goto('/');
  await page.evaluate(() =>
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
    ),
  );

  // open the image through the drop zone's file picker
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.drop-zone').click()]);
  await chooser.setFiles({ name: 'stripes.png', mimeType: 'image/png', buffer: png });
  const canvas = page.locator('canvas.main-canvas');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  expect(Math.round(box.width)).toBe(400); // fits → shown at 1:1

  // draw a region from (100,50) to (200,150) in image pixels
  await page.mouse.move(box.x + 100, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 110, { steps: 5 });
  await page.mouse.move(box.x + 200, box.y + 150, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.rect-item')).toHaveCount(1);

  // default effect is blur: the inside is mixed, the outside is untouched.
  // (Probe 3px out: the mouse lands on fractional coordinates, and a pixel the
  // region only partly covers is redacted on purpose.)
  const [inside, justLeft, justAbove] = await pixels(page, await exportPng(page), [
    [150, 100],
    [97, 100],
    [150, 47],
  ]);
  expect(inside).not.toEqual(RED);
  expect(inside).not.toEqual(BLUE);
  expect(justLeft).toEqual(RED); // x=97 is in stripe 96–99 (even → red)
  expect(justAbove).toEqual(BLUE); // x=150 is in stripe 148–151 (odd → blue)

  // switch the selected region to solid black
  await page.locator('select').selectOption('black');
  const [solidInside, solidLeft] = await pixels(page, await exportPng(page), [
    [101, 51],
    [97, 100],
  ]);
  expect(solidInside).toEqual([0, 0, 0, 255]);
  expect(solidLeft).toEqual(RED);

  // undo / redo from the keyboard
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.rect-item')).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await expect(page.locator('.rect-item')).toHaveCount(1);

  expect(problems).toEqual([]);
});

test('the canvas stays painted after the window is resized', async ({ page }) => {
  await page.goto('about:blank');
  const png = await stripesPng(page);
  await page.goto('/');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.drop-zone').click()]);
  await chooser.setFiles({ name: 'stripes.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('canvas.main-canvas')).toBeVisible();

  const painted = () =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas.main-canvas')!;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let opaque = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] === 255) opaque++;
      return opaque / (c.width * c.height);
    });

  await expect.poll(painted).toBeGreaterThan(0.99);
  await page.setViewportSize({ width: 1100, height: 650 }); // zoom stays 1:1
  await page.waitForTimeout(200);
  expect(await painted()).toBeGreaterThan(0.99);
  await page.setViewportSize({ width: 500, height: 400 }); // zoom changes
  await page.waitForTimeout(200);
  expect(await painted()).toBeGreaterThan(0.99);
});

test('Enter on a focused Cancel button keeps the current regions', async ({ page }) => {
  await page.goto('about:blank');
  const png = await stripesPng(page);
  await page.goto('/');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.drop-zone').click()]);
  await chooser.setFiles({ name: 'stripes.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('canvas.main-canvas')).toBeVisible();
  const box = (await page.locator('canvas.main-canvas').boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 80, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator('.rect-item')).toHaveCount(1);

  await page.locator('header button.primary').click(); // open image → discard prompt
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.locator('.actions button.cancel').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(page.locator('.rect-item')).toHaveCount(1);
});
