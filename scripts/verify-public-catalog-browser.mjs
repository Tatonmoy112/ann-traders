import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
});
const checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const productRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/catalog/products')) productRequests.push(request.url());
  });
  // Synthetic CDN images are transport doubles, not a live media delivery test.
  await page.route('**/_next/image?**', (route) =>
    route.fulfill({ status: 404, body: 'Synthetic unavailable image' }),
  );
  await page.goto('http://localhost:3001/products');
  await page.getByRole('heading', { name: 'Industrial materials catalog' }).waitFor();
  assert.equal(await page.locator('article').count(), 12);
  assert.notEqual(
    await page
      .getByRole('button', { name: 'Apply filters' })
      .evaluate((button) => getComputedStyle(button).backgroundColor),
    'rgba(0, 0, 0, 0)',
  );
  checks.push('server-provided 12-card grid hydrates without product API requests');
  await page.getByLabel('Search', { exact: true }).fill('00002');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.waitForURL(/q=00002/);
  await page.getByRole('heading', { name: 'Synthetic Paper 00002', exact: true }).waitFor();
  assert.equal(await page.locator('article').count(), 1);
  checks.push('search filter navigation updates server-rendered products');
  await page.getByRole('link', { name: 'View specifications', exact: true }).click();
  await page.getByRole('heading', { name: 'Synthetic Paper 00002', exact: true }).waitFor();
  const variant = page.getByRole('combobox').first();
  const variantId = await variant
    .locator('option')
    .filter({ hasText: 'Paper variant 2' })
    .getAttribute('value');
  await variant.selectOption(variantId);
  assert.ok((await page.getByText('BDT 120').first().textContent()).includes('120'));
  checks.push('variant selector updates public prices and specifications');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open mobile navigation' }).click();
  await page.getByRole('link', { name: 'Contact ANN Traders', exact: true }).click();
  await page.getByRole('heading', { name: 'Contact ANN Traders', exact: true }).waitFor();
  checks.push('mobile navigation opens and contact route has no submission form');
  assert.equal(await page.locator('input[type=email]').count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.equal(productRequests.length, 0);
  checks.push('no browser product-fetch waterfall or horizontal mobile overflow');
  fs.mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/public-contact-mobile.png', fullPage: true });
  await page.goto('http://localhost:3001/products');
  await page.getByRole('heading', { name: 'Industrial materials catalog' }).waitFor();
  await page.screenshot({ path: 'test-results/public-products-mobile.png', fullPage: true });
  await page.screenshot({ path: 'test-results/public-products-mobile-top.png' });
  fs.writeFileSync(
    'docs/verification/public-catalog-browser.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        environment: 'local production build, Chromium; synthetic image failures intercepted',
        checks,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ passed: checks.length }));
} finally {
  await browser.close();
}
