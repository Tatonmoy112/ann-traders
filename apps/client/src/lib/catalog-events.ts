import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyCatalogEvent(
  raw: string,
  headers: Headers,
  secret: string | undefined,
  now = Date.now(),
) {
  if (!secret || secret.length < 32 || secret.length > 256 || Buffer.byteLength(raw) > 2048)
    return false;
  const signature = headers.get('x-catalog-signature') || '';
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), expected)) return false;
  try {
    const event = JSON.parse(raw);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return (
      uuid.test(event.id) &&
      uuid.test(event.product_id) &&
      headers.get('idempotency-key') === event.id &&
      [
        'catalog.publish',
        'catalog.unpublish',
        'catalog.archive',
        'catalog.delete',
        'catalog.restore',
      ].includes(event.type) &&
      Number.isSafeInteger(event.revision) &&
      event.revision > 0 &&
      Number.isSafeInteger(event.timestamp) &&
      Math.abs(Math.floor(now / 1000) - event.timestamp) <= 300
    );
  } catch {
    return false;
  }
}
