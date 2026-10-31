// Local production acceptance only. Never aim burst tests at hosted services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
const base = process.env.CLIENT_SECURITY_TEST_ORIGIN || 'http://localhost:3101';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Local production server required');
const checks = [];
const record = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
};
const request = (path, init = {}) =>
  fetch(base + path, {
    ...init,
    headers: { 'x-vercel-forwarded-for': '198.51.100.20', ...init.headers },
  });
const first = await request('/');
const firstHtml = await first.text();
const firstCsp = first.headers.get('content-security-policy') || '';
const nonce = firstCsp.match(/'nonce-([^']+)'/)?.[1];
record('production HTML renders successfully', first.status === 200);
record(
  'nonce script CSP removes unsafe-inline and unsafe-eval',
  !!nonce &&
    firstCsp.includes("'strict-dynamic'") &&
    !firstCsp
      .split(';')
      .find((x) => x.includes('script-src'))
      .includes('unsafe-'),
);
record('Next framework scripts receive the CSP nonce', firstHtml.includes('nonce="' + nonce + '"'));
const second = await request('/');
await second.text();
record(
  'nonces change on every response',
  second.headers.get('content-security-policy') !== firstCsp,
);
for (const [name, value] of Object.entries({
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
}))
  record('header ' + name, first.headers.get(name) === value);
record('framework signature disabled', !first.headers.has('x-powered-by'));
record('HTML is not shared-cacheable', first.headers.get('cache-control').includes('no-store'));
for (const path of [
  '/api/catalog/products?q=a&q=b',
  '/api/catalog/products?select=*',
  '/api/catalog/products?brand=x%2Cname.eq.secret',
  '/api/catalog/products?q=' + 'x'.repeat(81),
])
  record('invalid API query rejected: ' + path.slice(0, 80), (await request(path)).status === 400);
record(
  'oversized URLs rejected',
  (await request('/products?q=' + 'x'.repeat(4200))).status === 414,
);
record(
  'public mutation methods rejected',
  (await request('/api/catalog/products', { method: 'POST', body: '{}' })).status === 405,
);
record(
  'private document signing unavailable',
  (await request('/api/catalog/documents/00000000-0000-4000-8000-000000000000')).status === 404,
);
record(
  'unauthenticated cache purge denied',
  (await request('/api/catalog/revalidate', { method: 'POST' })).status === 401,
);
const auth = { authorization: 'Bearer local-public-catalog-purge-test-secret-000000' };
record(
  'cross-origin cache purge denied',
  (
    await request('/api/catalog/revalidate', {
      method: 'POST',
      headers: { ...auth, origin: 'https://evil.example' },
    })
  ).status === 403,
);
record(
  'cache purge body rejected',
  (await request('/api/catalog/revalidate', { method: 'POST', headers: auth, body: '{}' }))
    .status === 413,
);
record(
  'authenticated empty-body purge works',
  (await request('/api/catalog/revalidate', { method: 'POST', headers: auth })).status === 200,
);
record(
  'private image optimizer targets denied',
  (await request('/_next/image?url=http%3A%2F%2F127.0.0.1%3A55440%2F&w=768&q=75')).status === 400,
);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Content Security Policy|Refused to execute/.test(message.text())
    )
      errors.push(message.text());
  });
  await page.route('**/_next/image?**', (route) =>
    route.fulfill({ status: 404, body: 'Synthetic missing image' }),
  );
  await page.goto(base + '/products');
  await page.getByRole('heading', { name: 'Industrial materials catalog' }).waitFor();
  await page.getByLabel('Search', { exact: true }).fill('00002');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.waitForURL(/q=00002/);
  await page.getByRole('heading', { name: 'Synthetic Paper 00002', exact: true }).waitFor();
  record('strict production CSP preserves hydration/filter navigation', true);
  await page.goto(base + '/contact?product=' + encodeURIComponent('<img src=x onerror=alert(1)>'));
  record(
    'untrusted contact text stays escaped',
    await page.getByText('Regarding: <img src=x onerror=alert(1)>', { exact: true }).isVisible(),
  );
  record('no injected image element', (await page.locator('img[onerror]').count()) === 0);
  record('production browser has no script CSP errors', errors.length === 0);
  record(
    'mobile layout remains within viewport',
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
} finally {
  await browser.close();
}
// Consume a separate local test identity; changing untrusted XFF must not bypass.
let limited;
for (let i = 0; i < 125; i++) {
  const response = await request('/api/catalog/brands', {
    headers: {
      'x-vercel-forwarded-for': '198.51.100.99',
      'x-forwarded-for': '203.0.113.' + (i % 250),
    },
  });
  await response.text();
  if (response.status === 429) {
    limited = response;
    break;
  }
}
record('burst limit returns 429 despite spoofed X-Forwarded-For rotation', limited?.status === 429);
record('rate-limit response provides Retry-After', Number(limited.headers.get('retry-after')) > 0);
record(
  'another verified identity remains available',
  (
    await request('/api/catalog/brands', {
      headers: { 'x-vercel-forwarded-for': '198.51.100.100' },
    })
  ).status === 200,
);
const report = {
  date: new Date().toISOString(),
  environment:
    'isolated next start production build; local PostgreSQL/PostgREST transport double; trusted Vercel header behavior simulated locally; WAF activation not tested',
  checks,
};
fs.writeFileSync(
  'docs/verification/client-security-runtime.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify({ passed: checks.length }));
