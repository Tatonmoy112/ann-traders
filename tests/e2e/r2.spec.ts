const r2Origin = 'http://127.0.0.1:' + (process.env.ANN_E2E_R2_PORT || '54330');
import { test, expect, type Page } from '@playwright/test';
import sharp from '../../apps/admin/node_modules/sharp';
const origin = 'http://127.0.0.1:3100';
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-password-12345');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function draft(page: Page) {
  const suffix = crypto.randomUUID();
  const response = await page.request.post('/api/admin/products', {
    headers: { Origin: origin },
    data: { name: 'R2 test product', product_code: 'R2-' + suffix, slug: 'r2-' + suffix },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}
test('expired signed PUT and unauthenticated verification are rejected', async ({
  page,
  request,
}) => {
  await login(page);
  const id = await draft(page);
  const response = await page.request.post('/api/admin/images/create-upload', {
    headers: { Origin: origin },
    data: { product: id, revision: 1, mime: 'image/png', bytes: 6 },
  });
  expect(response.status()).toBe(200);
  const stage = await response.json();
  await page.request.get(r2Origin + '/__test/expire-uploads?enabled=true');
  try {
    expect(
      (
        await page.request.put(stage.uploadURL, {
          headers: stage.headers,
          data: Buffer.from('unused'),
        })
      ).status(),
    ).toBe(403);
  } finally {
    await page.request.get(r2Origin + '/__test/expire-uploads?enabled=false');
  }
  const unauthenticated = await request.post('/api/admin/images/complete-upload', {
    headers: { Origin: origin },
    data: { product: id, revision: 1, media: stage.media },
  });
  expect(unauthenticated.status()).toBe(401);
});
test('direct R2 PUT, verified sizes and replacement preserve active media placement', async ({
  page,
}) => {
  await login(page);
  const id = await draft(page);
  await page.goto(`/products/${id}`);
  await page.getByRole('button', { name: 'Images & documents', exact: true }).click();
  const bytes = await sharp({
    create: { width: 1200, height: 600, channels: 3, background: '#486ab8' },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel('Upload product image', { exact: true })
    .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.getByText(/Revision 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Images & documents', exact: true }).click();
  await expect(page.getByText('Primary', { exact: true })).toBeVisible();
  const assets = await (await page.request.get(`/api/admin/products/${id}/assets`)).json();
  expect(assets.images).toHaveLength(1);
  expect(assets.images[0].object_manifest).toHaveLength(3);
  expect(assets.images[0].provider).toBe('r2');
  const thumb = await page.request.get(
    assets.images[0].object_manifest.find((o: { kind: string }) => o.kind === 'thumbnail').url,
  );
  expect(thumb.headers()['content-type']).toBe('image/webp');
  await page
    .getByLabel('Replace image', { exact: true })
    .setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.getByText(/Revision 3/)).toBeVisible();
  const replaced = await (await page.request.get(`/api/admin/products/${id}/assets`)).json();
  expect(replaced.images).toHaveLength(1);
  expect(replaced.images[0].replaces_media_id).toBe(assets.images[0].id);
  expect(replaced.images[0].is_primary).toBe(true);
});
test('repeated PUT cannot change the object and corrupt bytes never attach', async ({ page }) => {
  await login(page);
  const id = await draft(page);
  const stageResponse = await page.request.post('/api/admin/images/create-upload', {
    headers: { Origin: origin },
    data: { product: id, revision: 1, mime: 'image/png', bytes: 6 },
  });
  expect(stageResponse.status()).toBe(200);
  const stage = await stageResponse.json();
  const first = await page.request.put(stage.uploadURL, {
    headers: stage.headers,
    data: Buffer.from('<svg/>'),
  });
  expect(first.status()).toBe(200);
  expect(
    (
      await page.request.put(stage.uploadURL, {
        headers: stage.headers,
        data: Buffer.from('attack'),
      })
    ).status(),
  ).toBe(412);
  const complete = await page.request.post('/api/admin/images/complete-upload', {
    headers: { Origin: origin },
    data: { product: id, revision: 1, media: stage.media },
  });
  expect(complete.status()).toBe(422);
  const assets = await (await page.request.get(`/api/admin/products/${id}/assets`)).json();
  expect(assets.images[0].upload_status).toBe('failed');
  expect(assets.images[0].delivery_url ?? null).toBeNull();
});
test('provider outage retains a retry path without a public attachment', async ({ page }) => {
  await login(page);
  const id = await draft(page);
  await page.goto(`/products/${id}`);
  await page.getByRole('button', { name: 'Images & documents', exact: true }).click();
  const bytes = await sharp({
    create: { width: 100, height: 100, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await page.request.get(r2Origin + '/__test/fault?enabled=true');
  try {
    await page
      .getByLabel('Upload product image', { exact: true })
      .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: bytes });
    await expect(
      page.getByRole('button', { name: 'Retry image upload', exact: true }),
    ).toBeVisible();
  } finally {
    await page.request.get(r2Origin + '/__test/fault?enabled=false');
  }
  await page.getByRole('button', { name: 'Retry image upload', exact: true }).click();
  await expect(page.getByText(/Revision 2/)).toBeVisible();
});
