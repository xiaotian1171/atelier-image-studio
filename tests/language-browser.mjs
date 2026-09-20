import { prepareLegacyMode, selectLegacyOpenAI } from './legacy-helpers.mjs';
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await prepareLegacyMode(page);
await page.goto('http://127.0.0.1:3000');
await selectLegacyOpenAI(page);
await expect(page.locator('html')).toHaveAttribute('lang', 'en');
await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en');
await expect(page.getByRole('heading', { name: 'Imagination, made visible.' })).toBeVisible();
await page.screenshot({ path: '/home/user/atelier-english.png', fullPage: true });
await page.getByRole('button', { name: 'Start creating' }).click();
await expect(page.getByRole('alert')).toContainText(
  "Enter a prompt within the model's character limit.",
);
const userPrompt = '一只猫 · A cat · 未翻译原文';
await page.getByLabel('Your prompt', { exact: true }).fill(userPrompt);
await page.getByRole('button', { name: 'Connect API', exact: true }).click();
await page.getByPlaceholder('sk-…').fill('sk-language-fixture');
await page.getByRole('button', { name: 'Save settings', exact: true }).click();
await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
await expect(page.getByLabel('画面描述', { exact: true })).toHaveValue(userPrompt);
await expect(page.getByRole('button', { name: '已配置接口', exact: true })).toBeVisible();
await expect(page.getByRole('alert')).toContainText('请填写提示词');
await page.getByRole('combobox', { name: '语言', exact: true }).selectOption('en');
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=';
let payload;
await page.route('**/api/generations', async (route) => {
  payload = route.request().postDataJSON();
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ b64_json: png }] }),
  });
});
await page.getByRole('button', { name: 'Start creating' }).click();
await expect(page.locator('.results-grid .work-card')).toHaveCount(1);
if (payload.prompt !== userPrompt) throw new Error('UI language changed the prompt');
await page.getByRole('button', { name: /My collection/ }).click();
await page.locator('.filter-tabs button').nth(1).click();
await expect(page.locator('.library-grid .work-card')).toHaveCount(0);
await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
await expect(page.locator('.filter-tabs .active')).toContainText('收藏');
await page.locator('.filter-tabs button').first().click();
await expect(page.locator('.library-grid .work-card')).toHaveCount(1);
await expect(page.locator('.work-meta h4')).toHaveText(userPrompt);
await page.reload();
await selectLegacyOpenAI(page);
await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
await expect(page.getByRole('button', { name: '连接 API', exact: true })).toBeVisible();
const storage = await page.evaluate(() => ({ ...localStorage }));
if (
  storage['atelier.language'] !== 'zh-CN' ||
  JSON.stringify(storage).includes('sk-language-fixture')
)
  throw new Error('Preference or key persistence failed');
await page.getByRole('combobox', { name: '语言', exact: true }).selectOption('en');
await page.getByRole('button', { name: 'Connect API', exact: true }).click();
await expect(page.getByRole('dialog', { name: 'Connect your creative tools' })).toBeVisible();
await page.getByRole('button', { name: 'Close', exact: true }).click();
await page.getByRole('button', { name: 'Getting started', exact: true }).first().click();
await expect(page.getByRole('dialog', { name: 'About Atelier' })).toBeVisible();
await page.getByRole('button', { name: 'Close', exact: true }).click();
await page.getByRole('button', { name: 'Inspiration', exact: true }).click();
await expect(page.locator('.journal-grid')).toContainText('A handmade ivory ceramic vase');
await page.reload();
await selectLegacyOpenAI(page);
await expect(page.locator('html')).toHaveAttribute('lang', 'en');
for (const width of [390, 320]) {
  const mobile = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true });
  await mobile.goto('http://127.0.0.1:3000');
  await expect(mobile.getByRole('combobox', { name: 'Language', exact: true })).toBeVisible();
  if (await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error('Mobile layout overflow at ' + width);
  if (width === 390)
    await mobile.screenshot({ path: '/home/user/atelier-english-mobile.png', fullPage: true });
  await mobile.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
  await expect(mobile.getByRole('button', { name: '开始创作' })).toBeVisible();
  await mobile.close();
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  'Language tests passed: English default, translations, switching, persistence, user text & API key preservation, stable filters, and 320/390px layouts.',
);
await browser.close();
