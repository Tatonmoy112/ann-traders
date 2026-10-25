import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { databaseError, failure, json } from '@/lib/http';
import { integrationClient } from '@/lib/privileged';
import { validatePdf } from '@/lib/provider';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin();
    const { id } = await params;
    z.uuid().parse(id);
    const origin = request.headers.get('origin');
    const allowed = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    if (
      origin &&
      origin !== allowed &&
      !origin.includes('localhost') &&
      !origin.includes('127.0.0.1') &&
      !origin.endsWith('.vercel.app')
    ) {
      throw new HttpError(403, 'Request origin is not allowed');
    }
    // Bounded stream before multipart parsing to avoid an unbounded upload allocation.
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Missing file');
    let size = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 10500000) {
        await reader.cancel();
        throw new HttpError(413, 'Maximum document size is 10 MB');
      }
      parts.push(value);
    }
    const form = await new Response(Buffer.concat(parts), {
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
    }).formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.type !== 'application/pdf')
      throw new HttpError(422, 'Choose a PDF document');
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      validatePdf(bytes);
    } catch (e) {
      throw new HttpError(422, (e as Error).message);
    }
    const revision = z.coerce.number().int().positive().parse(form.get('revision')),
      title = z.string().trim().min(1).max(255).parse(form.get('title')),
      kind = z
        .enum(['catalogue', 'TDS', 'SDS', 'MSDS', 'certificate', 'manual', 'other'])
        .parse(form.get('kind'));
    const privileged = integrationClient(),
      path = `${id}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await privileged.storage
      .from('catalog-documents')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw new HttpError(502, 'Document storage failed. Retry the upload.');
    const { data, error } = await privileged.rpc('attach_verified_document', {
      actor: profile.id,
      product: id,
      expected_revision: revision,
      path,
      title_text: title,
      kind,
      size_bytes: bytes.length,
      visible: form.get('visible') === 'true',
    });
    if (error) {
      await privileged.storage.from('catalog-documents').remove([path]);
      databaseError(error);
    }
    return json({ revision: data });
  } catch (e) {
    return failure(e);
  }
}
