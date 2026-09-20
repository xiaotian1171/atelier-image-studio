import { prepareLegacyMode, selectLegacyOpenAI } from './legacy-helpers.mjs';
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('atelier.language', 'zh-CN'));
await prepareLegacyMode(page);
await page.goto('http://127.0.0.1:3000');
await selectLegacyOpenAI(page);
await page.getByRole('button', { name: '连接 API' }).click();
await page.getByRole('button', { name: 'Pollinations', exact: true }).click();
await expect(page.getByPlaceholder('https://api.openai.com/v1')).toHaveValue(
  'https://gen.pollinations.ai/v1',
);
await page.getByPlaceholder('sk-…').fill('sk-test');
await page.getByRole('button', { name: '保存配置' }).click();
await expect(page.getByLabel('生成模型', { exact: true })).toHaveValue('openai/gpt-image-2');
await expect(page.getByRole('button', { name: '增加数量' })).toBeDisabled();
await expect(page.getByRole('button', { name: '图像变体', exact: true })).toBeDisabled();
await page.getByRole('button', { name: /更多创作设置/ }).click();
await expect(page.getByRole('switch', { name: '流式预览' })).toHaveCount(0);
await page.getByLabel('画面描述', { exact: true }).fill('a test vase');
let payload;
await page.route('**/api/generations', async (route) => {
  payload = route.request().postDataJSON();
  await route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({
      error: {
        message: 'JSON body validation failed',
        details: { fieldErrors: { model: ['Test: model unavailable'] } },
        requestId: 'poll-test-id',
      },
    }),
  });
});
await page.getByRole('button', { name: '开始创作' }).click();
await expect(page.getByRole('alert')).toContainText('model: Test: model unavailable');
await expect(page.getByRole('alert')).toContainText('poll-test-id');
if (
  payload.quality !== 'medium' ||
  payload.n !== 1 ||
  'stream' in payload ||
  'background' in payload
)
  throw new Error('invalid Pollinations payload');
await page.getByRole('button', { name: '图像编辑', exact: true }).click();
await page.locator('input[type=file]').first().setInputFiles('tests/sample.png');
await expect(page.getByRole('button', { name: '绘制蒙版' })).toHaveCount(0);
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  'Pollinations preset, supported parameters, disabled unsupported controls, and field-level errors passed.',
);
await browser.close();
