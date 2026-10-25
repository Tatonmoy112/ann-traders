import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { body, databaseError, failure, json } from '@/lib/http';
import { integrationClient } from '@/lib/privileged';
import { r2Store } from '@/lib/r2';
export async function POST(request: Request) {
  try {
    const { profile } = await requireAdmin();
    const input = z
      .object({
        product: z.uuid(),
        revision: z.number().int().positive(),
        mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        bytes: z.number().int().positive().max(10485760),
        replacement: z.uuid().optional(),
      })
      .parse(await body(request));
    const store = r2Store(),
      media = crypto.randomUUID();
    const { data, error } = await integrationClient().rpc('r2_create_upload', {
      actor: profile.id,
      product: input.product,
      expected_revision: input.revision,
      media,
      mime: input.mime,
      size_bytes: input.bytes,
      origin: store.config.publicOrigin,
      staging_bucket_name: store.config.stagingBucket,
      public_bucket_name: store.config.publicBucket,
      replacement: input.replacement,
    });
    if (error) databaseError(error);
    const upload = await store.createUpload(
      'staging/' + input.product + '/' + media,
      input.mime,
      input.bytes,
    );
    return json({ media, ...upload, expires_at: (data as { expires_at: string }).expires_at });
  } catch (error) {
    return failure(error);
  }
}
