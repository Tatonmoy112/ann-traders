import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
  R2Store,
  readR2Config,
  cleanupR2Media,
  purgeImageUrls,
  type CleanupPlan,
} from '../../../packages/storage/src/index.ts';
type Job = {
  id: string;
  entity_id: string;
  event_type: string;
  revision: number;
  attempts: number;
  payload: { asset_id?: string; media_id?: string; provider?: string };
};
const encoder = new TextEncoder();
function equal(a: string, b: string) {
  const x = encoder.encode(a),
    y = encoder.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
Deno.serve(async (request) => {
  const secret = Deno.env.get('CATALOG_WORKER_SECRET');
  if (
    request.method !== 'POST' ||
    !secret ||
    secret.length < 32 ||
    secret.length > 256 ||
    !equal(request.headers.get('authorization') ?? '', `Bearer ${secret}`)
  )
    return new Response('Unauthorized', { status: 401 });
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await db.rpc('claim_catalog_jobs', { batch_size: 1 });
  if (error) return new Response('Queue unavailable', { status: 503 });
  let completed = 0,
    failed = 0;
  for (const job of data as Job[]) {
    try {
      if (
        job.event_type === 'r2.cleanup' ||
        (job.event_type === 'image.retired' && job.payload.provider === 'r2')
      ) {
        const media = job.payload.media_id;
        if (!media) throw new Error('Missing media ID');
        const { data: plan, error: prepare } = await db.rpc('r2_prepare_cleanup', { media });
        if (prepare) throw new Error('Cleanup is not authorized yet');
        const env = Deno.env.toObject();
        const store = new R2Store(readR2Config(env));
        try {
          await cleanupR2Media(store, plan as CleanupPlan, (urls) => purgeImageUrls(urls, env));
        } finally {
          store.client.destroy();
        }
      } else if (job.event_type === 'image.detach' || job.event_type === 'image.retired') {
        if (job.payload.provider && job.payload.provider !== 'cloudflare_images')
          throw new Error('Unknown legacy provider');
        const asset = job.payload.asset_id;
        if (!asset) throw new Error('Missing asset ID');
        const { data: referenced, error: check } = await db.rpc('image_asset_referenced', {
          asset,
        });
        if (check || referenced)
          throw new Error('Asset is still referenced or reference check failed');
        const account = Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),
          token = Deno.env.get('CLOUDFLARE_IMAGES_API_TOKEN');
        if (!account || !token) throw new Error('Image cleanup configuration missing');
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/images/v1/${encodeURIComponent(asset)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok && response.status !== 404)
          throw new Error(`Image cleanup HTTP ${response.status}`);
      } else if (job.event_type.startsWith('catalog.')) {
        const target = Deno.env.get('CATALOG_INVALIDATE_URL'),
          signing = Deno.env.get('INTERNAL_CATALOG_REVALIDATE_SECRET');
        if (!target || !signing)
          throw new Error('Future catalog receiver is not configured; retain event for retry');
        const url = new URL(target);
        if (url.protocol !== 'https:') throw new Error('HTTPS receiver required');
        const body = JSON.stringify({
          id: job.id,
          product_id: job.entity_id,
          type: job.event_type,
          revision: job.revision,
          timestamp: Math.floor(Date.now() / 1000),
        });
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(signing),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );
        const signature = Array.from(
          new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body))),
          (v) => v.toString(16).padStart(2, '0'),
        ).join('');
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Catalog-Signature': signature,
            'Idempotency-Key': job.id,
          },
          body,
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`Invalidation HTTP ${response.status}`);
      } else throw new Error('Unknown event type');
      const { error: ack } = await db.rpc('complete_catalog_job', {
        job: job.id,
        attempt: job.attempts,
        success: true,
      });
      if (ack) throw new Error('Job acknowledgement failed');
      completed++;
    } catch (e) {
      failed++;
      await db.rpc('complete_catalog_job', {
        job: job.id,
        attempt: job.attempts,
        success: false,
        error_text: e instanceof Error ? e.message : 'Job failed',
      });
      console.error(
        JSON.stringify({ event: 'catalog_job_failed', id: job.id, attempt: job.attempts }),
      );
    }
  }
  return Response.json({ completed, failed }, { headers: { 'Cache-Control': 'no-store' } });
});
