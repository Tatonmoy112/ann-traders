import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.PUBLIC_CATALOG_TEST_ORIGIN || 'http://localhost:3001';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Local production test server required');
const checks = [];
const measurements = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
};
const get = async (path) => {
  const start = performance.now();
  const response = await fetch(base + path);
  const ttfb = performance.now() - start;
  const text = await response.text();
  measurements.push({
    path,
    status: response.status,
    ttfbMs: +ttfb.toFixed(2),
    totalMs: +(performance.now() - start).toFixed(2),
    responseBytes: Buffer.byteLength(text),
  });
  return { response, text };
};
await fetch('http://127.0.0.1:55440/_test/restore', { method: 'POST' });
for (const [path, expected] of [
  ['/', 'Synthetic Paper'],
  ['/products', 'Synthetic Paper'],
  ['/products/synthetic-paper-1', 'Synthetic Paper 00001'],
]) {
  const { response, text } = await get(path);
  const html = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  check(
    path + ' server-rendered product content',
    response.status === 200 && html.includes(expected),
  );
  check(
    path + ' no privileged/private data',
    !text.includes('storage_path') &&
      !text.includes('staging_key') &&
      !text.includes('service_role'),
  );
}
let result = await get('/api/catalog/products?pageSize=12');
let data = JSON.parse(result.text);
check(
  '12 bounded cards and next-page lookahead',
  data.products.length === 12 && data.hasMore && data.total === null,
);
check(
  'explicit no-store response',
  result.response.headers.get('cache-control').includes('no-store'),
);
check(
  'lean cards without detail media manifests',
  !('description' in data.products[0]) &&
    !('image_variants' in data.products[0]) &&
    !('object_manifest' in data.products[0]),
);
check(
  'unit-correct effective price',
  data.products[0].display_price.currency === 'BDT' && data.products[0].display_price.unit === 'kg',
);
for (const parameter of ['category', 'brand']) {
  data = JSON.parse((await get('/api/catalog/products?' + parameter + '=unknown-slug')).text);
  check('unknown ' + parameter + ' is empty', data.products.length === 0);
}
data = JSON.parse((await get('/api/catalog/products?page=NaN&pageSize=Infinity')).text);
check('malformed pagination bounded', data.page === 1 && data.pageSize === 12);
data = JSON.parse((await get('/api/catalog/categories?tree=true')).text);
check('category tree contract', Array.isArray(data) && Array.isArray(data[0].children));
let response = await fetch(base + '/api/catalog/inquiry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
check('public RFQ persistence removed', [404, 405].includes(response.status));
response = await fetch(base + '/api/catalog/revalidate', { method: 'POST' });
check('manual purge rejects unauthenticated callers', response.status === 401);
response = await fetch(base + '/api/catalog/revalidate', {
  method: 'POST',
  headers: { authorization: 'Bearer local-public-catalog-purge-test-secret-000000' },
});
check('authorized manual purge succeeds', response.status === 200);
// Warm the exact detail cache and then withdraw before reading it again.
await get('/api/catalog/products/synthetic-paper-1');
await fetch('http://127.0.0.1:55440/_test/withdraw', { method: 'POST' });
response = await fetch(base + '/api/catalog/products/synthetic-paper-1');
check('withdrawal hidden even with a warm detail cache', response.status === 404);
response = await fetch(base + '/products/synthetic-paper-1');
const withdrawnHtml = await response.text();
check(
  'withdrawal hidden on the HTML detail route',
  !withdrawnHtml.includes('Synthetic Paper 00001') && withdrawnHtml.includes('noindex'),
);
data = JSON.parse((await get('/api/catalog/products?q=Synthetic%20Paper')).text);
check(
  'withdrawn card excluded',
  data.products.every((product) => product.slug !== 'synthetic-paper-1'),
);
await fetch('http://127.0.0.1:55440/_test/unavailable?value=true');
try {
  response = await fetch(base + '/api/catalog/products');
  check('visibility failures fail closed instead of serving stale cards', response.status === 503);
} finally {
  await fetch('http://127.0.0.1:55440/_test/unavailable?value=false');
}
const report = {
  date: new Date().toISOString(),
  environment:
    'next start production build + local PostgreSQL anonymous views + PostgREST transport double; not hosted acceptance',
  checks,
  measurements,
};
fs.writeFileSync(
  'docs/verification/public-catalog-runtime.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify({ passed: checks.length, environment: report.environment }));
