import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { body, databaseError, failure, json } from '@/lib/http';
import { integrationClient } from '@/lib/privileged';
import { r2Store } from '@/lib/r2';
import { verifyImageBytes } from '@/lib/verify-image';
import type { Json } from '@ann/database';
export const maxDuration = 120;
export async function POST(request: Request) {
  let claim: { actor: string; media: string; token: string } | undefined;
  try {
    const { db, profile } = await requireAdmin();
    const input = z
      .object({ product: z.uuid(), revision: z.number().int().positive(), media: z.uuid() })
      .parse(await body(request));
    const { data: media, error: readError } = await db
      .from('product_media')
      .select('*')
      .eq('id', input.media)
      .eq('product_id', input.product)
      .eq('uploaded_by', profile.id)
      .single();
    if (readError || !media || media.provider !== 'r2' || media.retired_at)
      throw new HttpError(404, 'R2 upload not found');
    if (media.upload_status === 'ready') return json({ ok: true });
    const store = r2Store(),
      privileged = integrationClient();
    const { data, error } = await privileged.rpc('r2_claim_upload', {
      actor: profile.id,
      product: input.product,
      expected_revision: input.revision,
      media: input.media,
    });
    if (error) databaseError(error);
    const session = z
      .object({
        ready: z.boolean().optional(),
        token: z.uuid().optional(),
        staging_key: z.string().optional(),
        bytes: z.number().optional(),
        mime: z.string().optional(),
        origin: z.string().optional(),
        staging_bucket: z.string().optional(),
        public_bucket: z.string().optional(),
      })
      .parse(data);
    if (session.ready) return json({ ok: true });
    if (
      !session.token ||
      !session.staging_key ||
      !session.bytes ||
      !session.mime ||
      session.origin !== store.config.publicOrigin ||
      session.staging_bucket !== store.config.stagingBucket ||
      session.public_bucket !== store.config.publicBucket
    )
      throw new HttpError(409, 'Upload configuration changed; start a new upload');
    claim = { actor: profile.id, media: input.media, token: session.token };
    const staged = await store.readStaged(session.staging_key, session.bytes, session.mime);
    let verified;
    try {
      verified = await verifyImageBytes(
        staged.bytes,
        session.mime,
        session.bytes,
        media.provider_asset_id + '/' + session.token,
        store.config.publicOrigin,
      );
    } catch {
      throw new HttpError(
        422,
        'Image could not be decoded. Use a valid still JPEG, PNG or WebP between 100 and 12,000 pixels.',
      );
    }
    const plan = await privileged.rpc('r2_plan_promotion', {
      ...claim,
      manifest: verified.outputs.map((o) => o.entry) as unknown as Json,
      digest: verified.digest,
      image_width: verified.width,
      image_height: verified.height,
    });
    if (plan.error) databaseError(plan.error);
    for (const output of verified.outputs) await store.putVerified(output.entry, output.bytes);
    const attached = await privileged.rpc('r2_finish_upload', {
      ...claim,
      product: input.product,
      expected_revision: input.revision,
    });
    if (attached.error) databaseError(attached.error);
    return json({ revision: attached.data });
  } catch (error) {
    if (claim) {
      try {
        await integrationClient().rpc('r2_fail_upload', claim);
      } catch {
        console.error(JSON.stringify({ event: 'r2_recovery_pending', media: claim.media }));
      }
    }
    return failure(error);
  }
}
