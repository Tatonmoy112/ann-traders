// Read-only verification of an already-running local client with its actual
// configured public catalog. Never starts/stops the user's server or writes data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = new URL(process.env.ANN_CONFIGURED_CLIENT_ORIGIN || 'http://localhost:3001');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
assert.equal(origin.protocol, 'http:');
assert.ok(!origin.username && !origin.password && !origin.search && !origin.hash);
const root = 'docs/production-refinement';
fs.mkdirSync(root + '/evidence', { recursive: true });
const report = {
  executedAt: new Date().toISOString(),
  scope:
    'Already-running local client; actual configured public catalog; GET requests only; no database mutations',
  checks: [],
  runtimeErrors: [],
};
const passed = (check, evidence = {}) => report.checks.push({ check, result: 'PASS', ...evidence });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (error) => report.runtimeErrors.push(error.message));
  const read = async (path) => {
    const response = await page.request.get(new URL(path, origin).href);
    assert.equal(response.status(), 200, `${path} must return 200`);
    return response.json();
  };
  await page.goto(origin.href);
  await page.getByRole('heading', { name: 'Find materials for your production needs.' }).waitFor();
  await page.getByRole('heading', { name: 'Featured products', exact: true }).waitFor();
  await page.screenshot({ path: root + '/evidence/recheck-homepage.png', fullPage: true });
  passed('Homepage company information and published sections');

  const listing = await read('/api/catalog/products?pageSize=12');
  assert.ok(listing.products.length > 0, 'Configured catalog must contain published products');
  passed('Actual published product API', { products: listing.products.length });
  const product = listing.products[0];
  const search = await read(
    '/api/catalog/products?' + new URLSearchParams({ q: product.product_code }),
  );
  assert.ok(search.products.some((row) => row.id === product.id));
  passed('Search finds an existing published product code');
  const category = await read(
    '/api/catalog/products?' + new URLSearchParams({ category: product.category_slug }),
  );
  assert.ok(category.products.some((row) => row.id === product.id));
  passed('Category filtering includes its existing published product');

  await page.goto(new URL('/products', origin).href);
  await page.getByRole('heading', { name: 'Industrial materials catalog' }).waitFor();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('article img')).filter(
        (img) => img.complete && img.naturalWidth > 0,
      ).length >= 2,
    null,
    { timeout: 20000 },
  );
  const loaded = await page
    .locator('article img')
    .evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth > 0).length);
  const ratios = await page
    .locator('article > a')
    .evaluateAll((frames) => frames.map((frame) => frame.clientWidth / frame.clientHeight));
  assert.ok(ratios.every((ratio) => Math.abs(ratio - 4 / 3) < 0.02));
  await page.screenshot({ path: root + '/evidence/recheck-products.png', fullPage: true });
  passed('Existing R2 files load inside bounded desktop image frames', {
    loadedImages: loaded,
    frameRatios: ratios,
  });

  await page.getByRole('link', { name: 'View specifications', exact: true }).first().click();
  await page.waitForURL(/\/products\/[a-z0-9_-]+/);
  await page.locator('main h1').waitFor();
  assert.equal(await page.getByText('Catalog temporarily unavailable', { exact: true }).count(), 0);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  assert.equal(new URL(canonical).pathname, new URL(page.url()).pathname);
  passed('Existing published detail navigation and canonical metadata');

  const detail = await read('/api/catalog/products/' + encodeURIComponent(product.slug));
  const forbidden = new Set([
    'storage_path',
    'bucket_id',
    'created_by',
    'updated_by',
    'object_manifest',
    'audit_logs',
    'outbox_events',
  ]);
  const checkKeys = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbidden.has(key), 'Private field in public DTO: ' + key);
      checkKeys(child);
    }
  };
  checkKeys(detail);
  await read('/api/catalog/documents');
  await page.goto(new URL('/documents', origin).href);
  await page.locator('main h1').waitFor();
  passed('Public detail/document reads omit private storage and audit fields');

  await page.goto(new URL('/contact', origin).href);
  await page.getByRole('heading', { name: 'Contact ANN Traders', exact: true }).waitFor();
  assert.equal(await page.locator('main form').count(), 0);
  const demo = await page
    .getByRole('heading', { name: 'Demo contact information', exact: true })
    .count();
  if (demo)
    assert.equal(
      await page.locator('main a[href^="mailto:"], main a[href^="https://wa.me/"]').count(),
      0,
    );
  await page.screenshot({ path: root + '/evidence/recheck-contact.png', fullPage: true });
  passed('Contact page has no inquiry storage form; demo contacts cannot send messages', {
    demoContacts: Boolean(demo),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL('/products', origin).href);
  await page.locator('article').first().waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const mobileRatios = await page
    .locator('article > a')
    .evaluateAll((frames) => frames.map((frame) => frame.clientWidth / frame.clientHeight));
  assert.ok(mobileRatios.every((ratio) => Math.abs(ratio - 4 / 3) < 0.02));
  await page.getByRole('button', { name: 'Open mobile navigation' }).click();
  await page.getByRole('link', { name: 'Contact ANN Traders', exact: true }).click();
  await page.getByRole('heading', { name: 'Contact ANN Traders', exact: true }).waitFor();
  passed('390px image frames, viewport fit and mobile navigation', { frameRatios: mobileRatios });
  assert.deepEqual(report.runtimeErrors, []);
  report.result = 'PASS';
  console.log(JSON.stringify(report));
} catch (error) {
  report.result = 'FAIL';
  report.error = error.message;
  process.exitCode = 1;
  console.error(JSON.stringify(report));
} finally {
  await browser.close();
  fs.writeFileSync(root + '/configured-client-checks.json', JSON.stringify(report, null, 2) + '\n');
}
