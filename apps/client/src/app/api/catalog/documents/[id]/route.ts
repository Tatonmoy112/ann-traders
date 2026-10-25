import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serverSupabase } from '@/lib/supabase';
import { safeErrorMessage } from '@/lib/security';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const parseResult = z.string().uuid().safeParse(id);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const db = serverSupabase();

    // 1. Fetch document and ensure parent product is published
    const { data: doc, error: docError } = await db
      .from('product_documents')
      .select(
        `
        id,
        title,
        storage_path,
        bucket_id,
        is_public,
        products:product_id (status, deleted_at)
      `,
      )
      .eq('id', id)
      .maybeSingle();

    if (docError) {
      console.error('Error fetching document:', docError);
      return NextResponse.json(
        { error: safeErrorMessage(docError, 'Document retrieval error') },
        { status: 500 },
      );
    }

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!doc.is_public) {
      return NextResponse.json(
        { error: 'This technical document is restricted and requires authentication' },
        { status: 403 },
      );
    }

    const prod = doc.products as unknown as { status: string; deleted_at: string | null } | null;
    if (prod?.status !== 'published' || prod?.deleted_at !== null) {
      return NextResponse.json({ error: 'Document is not available' }, { status: 404 });
    }

    // 2. Generate signed download URL from Supabase Storage (Strict bucket allowlist)
    const ALLOWED_DOCUMENT_BUCKETS = ['catalog-documents'];
    const bucket = ALLOWED_DOCUMENT_BUCKETS.includes(doc.bucket_id || '')
      ? doc.bucket_id!
      : 'catalog-documents';

    const { data: signedData, error: signError } = await db.storage
      .from(bucket)
      .createSignedUrl(doc.storage_path, 300, { download: true });

    if (signError || !signedData?.signedUrl) {
      console.error('Error creating signed download URL:', signError);
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 502 });
    }

    // 3. Return JSON or redirect based on Accept header
    const acceptHeader = request.headers.get('accept') || '';
    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({ url: signedData.signedUrl });
    }

    return NextResponse.redirect(signedData.signedUrl, 307);
  } catch (err) {
    const message = safeErrorMessage(err, 'Failed to generate download link');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

