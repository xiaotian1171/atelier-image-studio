import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:3000');
await expect(page.locator('html')).toHaveAttribute('lang', 'en');
await expect(page.getByLabel('Model', { exact: true })).toHaveValue('tongyi-mai/z-image-turbo');
await expect(page.getByRole('link', { name: /Powered by Pollinations/ }).first()).toBeVisible();
await expect(page.locator('.catalog-status')).toContainText('Text to image only', {
  timeout: 25000,
});
await page.screenshot({ path: '/home/user/atelier-pollinations-desktop.png', fullPage: true });
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await expect(page.getByRole('dialog', { name: 'Connect your Pollen wallet' })).toBeVisible();
await expect(
  page.getByRole('button', { name: 'Sign in with Pollinations', exact: true }),
).toBeDisabled();
await expect(page.locator('.setup-notice')).toContainText('POLLINATIONS_APP_KEY');
await expect(page.getByPlaceholder('sk-…')).toHaveCount(0);
await expect(page.locator('.custom-provider-details')).toHaveCount(0);
await page.screenshot({ path: '/home/user/atelier-pollinations-wallet.png', fullPage: true });
await page.getByRole('button', { name: 'Privacy', exact: true }).click();
await expect(page.getByRole('dialog', { name: 'Privacy', exact: true })).toContainText('HttpOnly');
await expect(page).toHaveURL(/\/privacy$/);
await page.reload();
await expect(page.getByRole('dialog', { name: 'Privacy', exact: true })).toBeVisible();
await page.getByRole('button', { name: 'Close', exact: true }).click();
// Simulated signed-in browser: backend OAuth itself is covered by auth.test.js.
const models = [
  {
    id: 'tongyi-mai/z-image-turbo',
    aliases: [],
    canEdit: false,
    maxReferences: null,
    resolutions: [],
  },
  {
    id: 'black-forest-labs/flux.2-klein-4b',
    aliases: [],
    canEdit: true,
    maxReferences: 2,
    resolutions: [],
  },
];
await page.route('**/api/app', (r) =>
  r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      authReady: true,
      allowCustomProviders: false,
      budget: 1,
      expiryDays: 7,
      sourceUrl: '',
      contactUrl: '',
    }),
  }),
);
let authenticated = true;
await page.route('**/api/session', (r) =>
  r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ authenticated, expiresAt: Date.now() + 3600000 }),
  }),
);
await page.route('**/api/wallet', (r) =>
  r.fulfill({ contentType: 'application/json', body: '{"balance":0.75}' }),
);
await page.route('**/api/catalog', (r) =>
  r.fulfill({ contentType: 'application/json', body: JSON.stringify({ models }) }),
);
await page.reload();
await expect(page.getByRole('button', { name: 'Pollen connected', exact: true })).toBeVisible();
await page.getByRole('button', { name: 'Pollen connected', exact: true }).click();
await expect(page.locator('.wallet-balance')).toContainText('0.75');
await page.getByRole('button', { name: 'Close', exact: true }).click();
await page.getByRole('button', { name: 'Edit image', exact: true }).click();
await expect(page.getByLabel('Model', { exact: true })).toHaveValue(
  'black-forest-labs/flux.2-klein-4b',
);
await page.getByLabel('Your prompt', { exact: true }).fill('A calmer background.');
await page.locator('input[type=file]').first().setInputFiles('tests/sample.png');
let captured;
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=';
await page.route('**/api/edits', (r) => {
  captured = r.request();
  return r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ b64_json: png }] }),
  });
});
await page.getByRole('button', { name: 'Start creating' }).click();
await expect(page.locator('.results-grid .work-card')).toHaveCount(1);
if (captured.headers()['x-auth-mode'] !== 'pollinations' || captured.headers()['x-api-key'])
  throw new Error('Browser must use session mode, never a delegated bearer token');
const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
if (stored.includes('sk_')) throw new Error('Unexpected browser credential storage');
await page.route('**/auth/logout', (r) => {
  authenticated = false;
  return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
});
await page.getByRole('button', { name: 'Pollen connected', exact: true }).click();
await page.getByRole('button', { name: 'Disconnect this session', exact: true }).click();
await expect(page.locator('.connection-button')).toHaveText(/Sign in/);
await page.getByRole('button', { name: 'Close', exact: true }).click();
for (const width of [320, 390]) {
  const mobile = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true });
  await mobile.goto('http://127.0.0.1:3000');
  await expect(mobile.getByRole('combobox', { name: 'Language', exact: true })).toBeVisible();
  if (await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error('Mobile page overflow: ' + width);
  await mobile.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    mobile.getByRole('button', { name: 'Sign in with Pollinations', exact: true }),
  ).toBeDisabled();
  await mobile.getByRole('button', { name: 'Close', exact: true }).click();
  await mobile.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
  await mobile.getByRole('button', { name: '登录', exact: true }).click();
  await expect(mobile.getByRole('dialog', { name: '连接 Pollen 钱包' })).toContainText(
    '发布前还需要完成配置',
  );
  await mobile.close();
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  'Publication UI passed: live catalog, attribution, real configuration gates, public privacy route, simulated wallet/edit/logout, no browser token, and mobile bilingual layouts.',
);
await browser.close();
