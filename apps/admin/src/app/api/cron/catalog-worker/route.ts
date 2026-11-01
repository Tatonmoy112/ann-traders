import { createHash, timingSafeEqual } from 'node:crypto';
import { requireAdmin, HttpError } from '@/lib/auth';
import { requireMutationOrigin, failure, json } from '@/lib/http';
function scheduled(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.CATALOG_WORKER_SECRET;
  return (
    !!secret &&
    secret.length >= 32 &&
    timingSafeEqual(
      createHash('sha256')
        .update(request.headers.get('authorization') || '')
        .digest(),
      createHash('sha256')
        .update('Bearer ' + secret)
        .digest(),
    )
  );
}
async function run() {
  const secret = process.env.CATALOG_WORKER_SECRET;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || secret.length < 32 || !base)
    throw new HttpError(503, 'Configure the deployed catalog Edge worker and worker secret.');
  const url = new URL('/functions/v1/catalog-worker', base);
  if (
    url.protocol !== 'https:' &&
    !(process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new HttpError(503, 'An HTTPS worker endpoint is required.');
  // One authoritative consumer owns cleanup, reference checks and signed delivery.
  // Never acknowledge an event here without executing its side effect.
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + secret },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok)
    throw new HttpError(502, 'Catalog worker failed. Events remain available for retry.');
  const result = await response.json();
  if (!Number.isInteger(result.completed) || !Number.isInteger(result.failed))
    throw new HttpError(502, 'Invalid worker response.');
  return json({ completed: result.completed, failed: result.failed });
}
export async function GET(request: Request) {
  try {
    if (!scheduled(request)) throw new HttpError(401, 'Scheduler authorization required.');
    return await run();
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    if (!scheduled(request)) {
      await requireAdmin(['super_admin', 'admin']);
      requireMutationOrigin(request);
    }
    return await run();
  } catch (error) {
    return failure(error);
  }
}
