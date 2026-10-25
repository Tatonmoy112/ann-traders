// Read-only browser CORS probe: no upload signature or credentials enter the browser.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { lookup } from 'node:dns/promises';
import { createRequire } from 'node:module';
import { readR2Config } from '../packages/storage/src/index.ts';
const env = parseEnv(fs.readFileSync('apps/admin/.env.local', 'utf8'));
const config = readR2Config({
  ...env,
  R2_STAGING_BUCKET: env.R2_STAGING_BUCKET || env.R2_UPLOAD_BUCKET,
  NODE_ENV: 'production',
});
const scope = JSON.parse(fs.readFileSync('.local-r2/r2-live-cleanup.json', 'utf8'));
const observations = [];
try {
  const response = await fetch(
    `${config.publicOrigin}/catalog/${scope.product}/probe-missing.webp`,
    { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(15000) },
  );
  observations.push({
    check: 'custom-domain-https',
    status: response.status === 404 ? 'PASS' : 'UNVERIFIED',
    httpStatus: response.status,
  });
} catch (error) {
  const code = error.cause?.code ?? error.code;
  observations.push({
    check: 'custom-domain-https',
    status: 'FAIL',
    error: error.name,
    causeCode: /^[A-Z0-9_]+$/.test(code) ? code : 'unknown',
  });
}
try {
  await lookup(new URL(config.publicOrigin).hostname);
  observations.push({ check: 'custom-domain-dns', status: 'PASS' });
} catch (error) {
  observations.push({
    check: 'custom-domain-dns',
    status: 'FAIL',
    code: /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'unknown',
  });
}
const { chromium } = createRequire(import.meta.url)('@playwright/test');
const existing = 'C:/Users/taton/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH || (fs.existsSync(existing) ? existing : undefined),
});
try {
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route(origin + '/__r2_probe', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Isolated CORS diagnostic</title>',
      }),
    );
    await page.goto(origin + '/__r2_probe');
    const url = `${config.endpoint}/${config.stagingBucket}/staging/${scope.product}/${scope.media}`;
    const observation = await page.evaluate(async (url) => {
      try {
        // No authorization: even if CORS changes, R2 cannot accept this write.
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
          body: new Blob(['unsigned-cors-probe'], { type: 'image/png' }),
          signal: AbortSignal.timeout(15000),
        });
        return { browserFetchBlocked: false, httpStatus: response.status };
      } catch (error) {
        return { browserFetchBlocked: true, error: error.name };
      }
    }, url);
    observations.push({
      check: 'browser-cors:' + origin,
      status: 'UNVERIFIED',
      note: 'Unsigned requests cannot prove signed-upload CORS; use verify-local-r2.mjs for the authenticated browser test.',
      ...observation,
      signedCapabilityUsed: false,
    });
    await context.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(
  'docs/verification/r2-live-browser-results.json',
  JSON.stringify(observations, null, 2) + '\n',
);
console.log(JSON.stringify(observations, null, 2));
