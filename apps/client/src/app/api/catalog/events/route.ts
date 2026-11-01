import { revalidateTag } from 'next/cache';
import { CATALOG_TAG } from '@/lib/catalog';
import { verifyCatalogEvent } from '@/lib/catalog-events';
import { catalogResponse } from '@/lib/catalog-response';

export async function POST(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return catalogResponse({ error: 'Signed event required' }, 400);
  const parts: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 2048) {
      await reader.cancel();
      return catalogResponse({ error: 'Event too large' }, 413);
    }
    parts.push(value);
  }
  const raw = Buffer.concat(parts).toString('utf8');
  if (!verifyCatalogEvent(raw, request.headers, process.env.INTERNAL_CATALOG_REVALIDATE_SECRET))
    return catalogResponse({ error: 'Unauthorized' }, 401);
  // Expiration is idempotent: retry/replay within the signed five-minute window
  // has the same effect and never writes catalog/business state.
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return catalogResponse({ revalidated: true });
}
