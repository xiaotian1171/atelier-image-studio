import { prepareLegacyMode, selectLegacyOpenAI } from './legacy-helpers.mjs';
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('atelier.language', 'zh-CN'));
await prepareLegacyMode(page);
await page.goto('http://127.0.0.1:3000');
await selectLegacyOpenAI(page);
await page.getByRole('button', { name: '开始创作' }).click();
await expect(page.getByRole('alert')).toContainText('请填写提示词');
await page.getByRole('button', { name: '以此为灵感', exact: true }).click();
await expect(page.getByLabel('画面描述')).not.toBeEmpty();
await page.getByRole('button', { name: '开始创作' }).click();
await expect(page.getByRole('dialog')).toBeVisible();
await page.getByPlaceholder('sk-…').fill('sk-browser-test');
await page.getByRole('button', { name: '保存配置' }).click();
await expect(page.getByRole('button', { name: '已配置接口' })).toBeVisible();
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=';
let payload;
await page.route('**/api/generations', async (route) => {
  payload = route.request().postDataJSON();
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      created: 1,
      data: [{ b64_json: png, revised_prompt: 'A vase in warm light' }],
      usage: { total_tokens: 55 },
    }),
  });
});
await page.getByRole('button', { name: '开始创作' }).click();
await expect(page.locator('.results-grid .work-card')).toHaveCount(1);
if (payload.model !== 'gpt-image-2.5-sunburst') throw new Error('wrong model');
await page.locator('.work-image').click();
await expect(page.getByRole('dialog', { name: '作品详情' })).toBeVisible();
await page.getByRole('button', { name: '收藏作品', exact: true }).click();
await expect(
  page.getByRole('dialog').getByRole('button', { name: '取消收藏', exact: true }),
).toBeVisible();
await page.getByRole('button', { name: '关闭', exact: true }).click();
await page.getByRole('button', { name: /我的作品/ }).click();
await expect(page.locator('.library-grid .work-card')).toHaveCount(1);
await page.reload();
await selectLegacyOpenAI(page);
await expect(page.getByRole('button', { name: '连接 API' })).toBeVisible();
await page.getByRole('button', { name: /我的作品/ }).click();
await expect(page.locator('.library-grid .work-card')).toHaveCount(1);
await page.getByRole('button', { name: '创作工作台', exact: true }).click();
await page.getByRole('button', { name: '图像编辑', exact: true }).click();
await page
  .locator('input[type=file]')
  .first()
  .setInputFiles({
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: fs.readFileSync('tests/sample.png'),
  });
await page.getByRole('button', { name: '绘制蒙版', exact: true }).click();
await expect(page.getByRole('dialog', { name: '绘制编辑区域' })).toBeVisible();
const canvas = page.locator('.mask-overlay');
await expect(canvas).toHaveAttribute('width', '64');
const box = await canvas.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.up();
await page.getByRole('button', { name: '使用蒙版' }).click();
await expect(page.locator('.mask-attached')).toContainText('mask.png');
await page.getByLabel('画面描述').fill('edit sample');
await page.getByRole('button', { name: '连接 API' }).click();
await page.getByPlaceholder('sk-…').fill('sk-browser-test');
await page.getByRole('button', { name: '保存配置' }).click();
let multipart = '';
await page.route('**/api/edits', async (route) => {
  multipart = route.request().postDataBuffer().toString();
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ b64_json: png }] }),
  });
});
await page.getByRole('button', { name: '开始创作' }).click();
await expect(page.locator('.results-grid .work-card')).toHaveCount(1);
if (!multipart.includes('name="image[]"') || !multipart.includes('name="mask"'))
  throw new Error('multipart fields missing');
await page.getByRole('button', { name: '文字生图', exact: true }).click();
await page.getByRole('button', { name: /更多创作设置/ }).click();
await page.getByRole('switch', { name: '流式预览' }).click();
await page.unroute('**/api/generations');
await page.route('**/api/generations', async (route) => {
  await route.fulfill({
    contentType: 'text/event-stream',
    body: `event: image_generation.partial_image\ndata: {"b64_json":"${png}","partial_image_index":0}\n\nevent: image_generation.completed\ndata: {"b64_json":"${png}","usage":{"total_tokens":10}}\n\n`,
  });
});
await page.getByRole('button', { name: '开始创作' }).click();
await expect(page.locator('.results-grid .work-card')).toHaveCount(1);
await expect(page.locator('.complete-caption')).toBeVisible();
await page.unroute('**/api/generations');
await page.route('**/api/generations', (route) =>
  route.fulfill({
    status: 429,
    contentType: 'application/json',
    body: JSON.stringify({ error: { message: 'Quota exhausted (test fixture)' } }),
  }),
);
await page.getByRole('button', { name: '开始创作' }).click();
await expect(page.getByRole('alert')).toContainText('429');
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  'Browser workflows passed: validation, BYOK, JSON, multipart + drawn mask, SSE, errors, favorites, IndexedDB persistence, key cleared on reload.',
);
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await mobile.addInitScript(() => localStorage.setItem('atelier.language', 'zh-CN'));
await mobile.goto('http://127.0.0.1:3000');
await mobile.waitForLoadState('networkidle');
await expect(mobile.locator('.sidebar')).not.toHaveClass(/open/);
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth);
if (overflow) throw new Error('Mobile overflow');
if (process.env.SCREENSHOT_PATH)
  await mobile.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
await mobile.getByRole('button', { name: '切换导航' }).click();
await mobile.getByRole('button', { name: /我的作品/ }).click();
await expect(mobile.locator('.empty-library')).toBeVisible();
console.log('Mobile viewport and navigation passed.');
await browser.close();
