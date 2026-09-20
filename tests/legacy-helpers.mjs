// Historical custom-provider regression tests run against an explicitly mocked
// operator-enabled configuration. The published server keeps this feature off.
export async function prepareLegacyMode(page) {
  await page.route('**/api/app', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authReady: false,
        loading: false,
        missing: ['POLLINATIONS_APP_KEY'],
        allowCustomProviders: true,
        budget: 1,
        expiryDays: 7,
      }),
    }),
  );
  await page.route('**/api/session', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"authenticated":false}' }),
  );
  await page.route('**/api/catalog', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"models":[]}' }),
  );
}
export async function selectLegacyOpenAI(page) {
  const zh = (await page.locator('html').getAttribute('lang')) === 'zh-CN';
  await page.locator('.connection-button').click();
  await page.locator('.custom-provider-details summary').click();
  await page
    .getByRole('button', { name: zh ? '配置自定义接口' : 'Configure a custom API', exact: true })
    .click();
  await page.getByRole('button', { name: 'OpenAI', exact: true }).click();
  await page.getByRole('button', { name: zh ? '保存配置' : 'Save settings', exact: true }).click();
}
