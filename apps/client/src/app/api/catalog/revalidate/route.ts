import { revalidateTag } from 'next/cache';
import { CATALOG_TAG } from '@/lib/catalog';
import { catalogResponse } from '@/lib/catalog-response';
import { purgeAuthorized } from '@/lib/security';
// MVP manual purge only. This endpoint is not the outbox event receiver.
export async function POST(request: Request) {
  const secret = process.env.INTERNAL_CATALOG_REVALIDATE_SECRET;
  if (!secret || secret.length < 32 || secret.length > 256)
    return catalogResponse({ error: 'Purge is not configured' }, 503);
  if (!purgeAuthorized(request.headers, secret))
    return catalogResponse({ error: 'Unauthorized' }, 401);
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return catalogResponse({ revalidated: true });
}
