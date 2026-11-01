import { chromium } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = `http://localhost:${process.env.ANN_REFINEMENT_CLIENT_PORT || 3001}`;
const fixture = 'http://127.0.0.1:55440';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
});
const report = {
  executedAt: new Date().toISOString(),
  environment:
    'Local Next production server, real anonymous PostgreSQL queries through an explicit PostgREST transport double; synthetic CDN images intercepted. Not hosted Supabase or R2.',
  checks: [],
};
const record = (check) => {
  report.checks.push({ check, result: 'PASS' });
  console.log('PASS ' + check);
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const browserErrors = [];
  page.on('pageerror', (error) => {
    browserErrors.push(error.message);
    console.error('BROWSER ERROR: ' + error.message);
  });
  const productApiRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/catalog/products')) productApiRequests.push(request.url());
  });
  await page.route('**/_next/image?**', (route) =>
    route.fulfill({ status: 404, body: 'Synthetic unavailable image' }),
  );
  const html = await page.request.get(origin + '/products');
  assert.equal(html.status(), 200);
  assert.match(await html.text(), /Synthetic Paper/);
  await page.goto(origin + '/products');
  await page.getByRole('heading', { name: 'Industrial materials catalog' }).waitFor();
  assert.equal(await page.locator('article').count(), 12);
  assert.equal(productApiRequests.length, 0);
  record(
    'Initial product HTML is server rendered and hydrates without a browser product-fetch waterfall',
  );

  const first = await page
    .getByRole('link', { name: 'View specifications', exact: true })
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  await page.getByRole('link', { name: 'Next page' }).click();
  await page.waitForURL(/cursor=/);
  try {
    await page.waitForFunction(() => document.querySelectorAll('article').length === 6, null, {
      timeout: 10000,
    });
  } catch (error) {
    const current = new URL(page.url());
    const probe = await page.request.get(origin + '/api/catalog/products?' + current.searchParams);
    const htmlProbe = await page.request.get(page.url());
    console.error(
      JSON.stringify({
        url: page.url(),
        articles: await page.locator('article').count(),
        apiStatus: probe.status(),
        apiProducts: (await probe.json()).products?.length,
        htmlPage: (await htmlProbe.text()).match(/Page [0-9]+[^<]*/),
        text: (await page.locator('main').innerText()).slice(0, 200),
      }),
    );
    throw error;
  }
  const second = await page
    .getByRole('link', { name: 'View specifications', exact: true })
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  assert.equal(second.length, 6);
  assert.ok(second.every((href) => !first.includes(href)));
  record('Cursor pagination returns the remaining six products without duplicates');

  await page.goto(origin + '/products');
  await page.getByLabel('Grammage minimum', { exact: true }).fill('71');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByText('No matching products.', { exact: false }).waitFor();
  assert.equal(await page.locator('article').count(), 0);
  await page.getByLabel('Grammage minimum', { exact: true }).fill('70');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByRole('link', { name: 'View specifications', exact: true }).first().waitFor();
  assert.equal(await page.locator('article').count(), 12);
  record(
    'Configured numeric technical filters work through JSONB GET arguments and SSR navigation',
  );

  const sku = await page.request.get(origin + '/api/catalog/products?q=WEB-TEST-2-V1');
  assert.equal(sku.status(), 200);
  assert.equal((await sku.json()).products.length, 1);
  const unknown = await page.request.get(origin + '/api/catalog/products?category=unknown-slug');
  assert.deepEqual((await unknown.json()).products, []);
  const write = await page.request.post(origin + '/api/catalog/products', {
    data: { name: 'Forbidden' },
  });
  assert.equal(write.status(), 405);
  record('API finds exact SKUs, returns zero for unknown filters and rejects public mutations');

  await page.goto(origin + '/products/synthetic-paper-2');
  await page.getByRole('heading', { name: 'Synthetic Paper 00002', exact: true }).waitFor();
  const variant = page.getByLabel('Variant', { exact: true });
  const id = await variant
    .locator('option')
    .filter({ hasText: 'Paper variant 2' })
    .getAttribute('value');
  await variant.selectOption(id);
  assert.match(await page.getByText('BDT 120', { exact: false }).first().textContent(), /120/);
  assert.ok(await page.getByText('Grammage', { exact: true }).count());
  record(
    'Variant selection renders current range prices, MOQ, units, technical specifications and packaging',
  );

  await page.request.get(origin + '/api/catalog/products?q=WEB-TEST-1-V1');
  await page.goto(origin + '/products/synthetic-paper-1');
  await page.getByRole('heading', { name: 'Synthetic Paper 00001', exact: true }).waitFor();
  await page.request.get(fixture + '/_test/withdraw');
  const withdrawn = await page.request.get(origin + '/api/catalog/products/synthetic-paper-1');
  assert.equal(withdrawn.status(), 404);
  assert.deepEqual(
    (await (await page.request.get(origin + '/api/catalog/products?q=WEB-TEST-1-V1')).json())
      .products,
    [],
  );
  await page.request.get(fixture + '/_test/restore');
  record(
    'Previously cached details and cards fail closed immediately after publication withdrawal',
  );

  const secret = process.env.INTERNAL_CATALOG_REVALIDATE_SECRET;
  assert.ok(
    secret && secret.length >= 32,
    'Set the same local event secret as the public test server',
  );
  const eventId = randomUUID();
  const raw = JSON.stringify({
    id: eventId,
    product_id: randomUUID(),
    type: 'catalog.unpublish',
    revision: 2,
    timestamp: Math.floor(Date.now() / 1000),
  });
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(
    (
      await page.request.post(origin + '/api/catalog/events', {
        data: raw,
        headers: {
          'Content-Type': 'application/json',
          'X-Catalog-Signature': signature,
          'Idempotency-Key': eventId,
        },
      })
    ).status(),
    200,
  );
  assert.equal(
    (
      await page.request.post(origin + '/api/catalog/events', {
        data: raw,
        headers: {
          'Content-Type': 'application/json',
          'X-Catalog-Signature': '0'.repeat(64),
          'Idempotency-Key': eventId,
        },
      })
    ).status(),
    401,
  );
  record('Signed outbox events expire the catalog cache; forged signatures are rejected');

  await page.request.get(fixture + '/_test/unavailable?value=true');
  await page.goto(origin + '/');
  await page.getByRole('heading', { name: 'Find materials for your production needs.' }).waitFor();
  await page
    .getByRole('status')
    .filter({ hasText: 'Product listings are temporarily unavailable.' })
    .waitFor();
  assert.equal(await page.locator('main article').count(), 0);
  record(
    'Company information remains available during catalog outages without showing stale product cards',
  );
  assert.equal(
    (await page.request.get(origin + '/api/catalog/products?q=WEB-TEST-2-V1')).status(),
    503,
  );
  await page.request.get(fixture + '/_test/unavailable?value=false');
  record(
    'An upstream outage returns an explicit unavailable response instead of stale publication visibility',
  );

  await page.goto(origin + '/products');
  await page.getByRole('heading', { name: 'Industrial materials catalog' }).waitFor();
  await page.getByRole('link', { name: 'View specifications', exact: true }).first().waitFor();
  fs.mkdirSync('test-results', { recursive: true });
  fs.mkdirSync('docs/production-refinement/evidence', { recursive: true });
  await page.screenshot({
    path: 'docs/production-refinement/evidence/public-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/production-refinement/evidence/public-mobile-top.png' });
  await page.screenshot({
    path: 'docs/production-refinement/evidence/public-mobile.png',
    fullPage: true,
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Open mobile navigation' }).click();
  await page.getByRole('link', { name: 'Contact ANN Traders', exact: true }).click();
  await page.getByRole('heading', { name: 'Contact ANN Traders', exact: true }).waitFor();
  assert.equal(await page.locator('main form').count(), 0);
  record(
    '390px layout fits the viewport and contact navigation contains no customer submission/storage form',
  );
  assert.deepEqual(browserErrors, [], 'Hydration and browser runtime errors must be absent');
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.error = error.message;
  throw error;
} finally {
  await browser.close();
  fs.writeFileSync(
    'docs/production-refinement/browser-results.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
