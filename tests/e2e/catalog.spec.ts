import { test, expect } from '@playwright/test';
test('authentication, catalog editing, publication checks and lifecycle with local provider double', async ({
  page,
}) => {
  const suffix = Date.now().toString(36),
    productName = `Test White Marker Paper ${suffix}`,
    productCode = `E2E-MP-${suffix}`,
    brandName = `Test Textile Brand ${suffix}`;
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.getByLabel('Email address').fill('admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-password-12345');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  const crossOrigin = await page.request.post('/api/admin/products', {
    data: { name: 'Cross-site attempt', product_code: 'CSRF', slug: 'csrf' },
    headers: { Origin: 'http://evil.test' },
  });
  expect(crossOrigin.status()).toBe(403);
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name', { exact: true }).fill(productName);
  await page.getByLabel('Product code', { exact: true }).fill(productCode);
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(productName) })).toBeVisible();
  await page
    .getByLabel('Primary category', { exact: true })
    .selectOption({ label: 'Garments & CAD/CAM Accessories' });
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(/Revision 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Variants', exact: true }).click();
  await page.getByRole('button', { name: 'Add variant', exact: true }).click();
  await page.getByLabel('SKU', { exact: true }).fill('E2E-MP-70-72');
  await page.getByLabel('Variant name', { exact: true }).fill('70 GSM / 72 inch');
  for (const label of ['Sale unit', 'MOQ unit', 'Capacity unit'])
    await page.getByLabel(label, { exact: true }).selectOption({ label: 'Kilogram' });
  await page.getByLabel('MOQ quantity', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(/Revision 3/)).toBeVisible();
  await page.getByRole('button', { name: 'Pricing', exact: true }).click();
  await page.getByRole('button', { name: 'Add price', exact: true }).click();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(/Revision 4/)).toBeVisible();
  await page.getByRole('button', { name: 'Review & publish', exact: true }).click();
  await expect(
    page.getByText('Images: attach a verified primary image', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish product', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Revision 5', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Return to draft', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText(/Revision 6/)).toBeVisible();
  await page.screenshot({ path: 'test-results/editor-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'All products', exact: true }).click();
  await page.getByLabel('Search products').fill('Test White');
  await expect(
    page.getByRole('link', { name: new RegExp(`${productName} ${productCode}`) }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Brands', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Brands', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add brand', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(brandName);
  await page.getByLabel('Slug', { exact: true }).fill(`test-textile-brand-${suffix}`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(brandName, { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/brands-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
test('rejects unauthenticated mutation and cross-origin requests', async ({ request }) => {
  const result = await request.post('/api/admin/products', {
    data: { name: 'Attack', product_code: 'ATTACK', slug: 'attack' },
    headers: { Origin: 'http://evil.test' },
  });
  expect([401, 403]).toContain(result.status());
});
