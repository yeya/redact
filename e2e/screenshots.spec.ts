import { test, expect, type Page } from '@playwright/test';

/**
 * Generates the README screenshots (docs/screenshot-{en,he}.png).
 * Not part of the normal E2E run — use `npm run screenshots`.
 */

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

/** A fictional account page with things worth redacting, drawn in the browser. */
async function samplePng(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const W = 1100;
    const H = 700;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    const font = (size: number, weight = 400) => `${weight} ${size}px Lato, 'DejaVu Sans', sans-serif`;

    ctx.fillStyle = '#eef0f5';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(50, 50, W - 100, H - 100, 18);
    ctx.fill();

    ctx.fillStyle = '#1d2133';
    ctx.font = font(34, 700);
    ctx.fillText('Account details', 90, 115);

    // avatar
    const grad = ctx.createLinearGradient(90, 150, 230, 290);
    grad.addColorStop(0, '#f5b98a');
    grad.addColorStop(1, '#d9875a');
    ctx.fillStyle = '#c8d3f5';
    ctx.fillRect(90, 150, 140, 140);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(160, 210, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(160, 300, 62, 46, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3b2a20';
    ctx.beginPath();
    ctx.arc(146, 205, 5, 0, Math.PI * 2);
    ctx.arc(174, 205, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3b2a20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(160, 218, 14, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = '#1d2133';
    ctx.font = font(30, 700);
    ctx.fillText('Dana Levi', 260, 205);
    ctx.fillStyle = '#7b82a8';
    ctx.font = font(20);
    ctx.fillText('Member since 2019 · Premium plan', 260, 242);

    const rows: [string, string][] = [
      ['Email', 'dana.levi@example.com'],
      ['Phone', '+1 (555) 012-3456'],
      ['Card', '4242 4242 4242 4242'],
      ['Address', '42 Example Street, Springfield'],
    ];
    rows.forEach(([label, value], i) => {
      const y = 360 + i * 70;
      ctx.fillStyle = '#e4e7f0';
      ctx.fillRect(90, y - 42, W - 180, 1);
      ctx.fillStyle = '#7b82a8';
      ctx.font = font(20);
      ctx.fillText(label, 90, y);
      ctx.fillStyle = '#1d2133';
      ctx.font = font(24, 600);
      ctx.fillText(value, 260, y);
    });
    return c.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(b64, 'base64');
}

async function drawRegion(page: Page, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  const box = (await page.locator('canvas.main-canvas').boundingBox())!;
  await page.mouse.move(box.x + x0, box.y + y0);
  await page.mouse.down();
  await page.mouse.move(box.x + x1, box.y + y1, { steps: 4 });
  await page.mouse.up();
}

for (const locale of ['en', 'he'] as const) {
  test(`README screenshot (${locale}) @screenshots`, async ({ page }) => {
    await page.goto('about:blank');
    const png = await samplePng(page);

    await page.addInitScript((l) => localStorage.setItem('redact-locale', l), locale);
    await page.goto('/');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.drop-zone').click()]);
    await chooser.setFiles({ name: 'account.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('canvas.main-canvas')).toBeVisible();
    const select = page.locator('header select');
    const strength = page.locator('header input[type="range"]');

    await drawRegion(page, 84, 144, 236, 296); // avatar
    await select.selectOption('pixelate');
    await strength.fill('14');
    await drawRegion(page, 252, 330, 560, 370); // email
    await select.selectOption('blur');
    await drawRegion(page, 252, 400, 520, 440); // phone
    await select.selectOption('frosted');
    await strength.fill('10');
    await drawRegion(page, 252, 470, 540, 510); // card number
    await select.selectOption('black');

    // leave the email region selected, so its handles and the toolbar show
    const box = (await page.locator('canvas.main-canvas').boundingBox())!;
    await page.mouse.click(box.x + 400, box.y + 350);
    await page.mouse.move(box.x + 700, box.y + 640);
    await expect(page.locator('.rect-item')).toHaveCount(4);
    await page.waitForTimeout(400); // let the sidebar's selection transition finish

    await page.screenshot({ path: `docs/screenshot-${locale}.png` });
  });
}
