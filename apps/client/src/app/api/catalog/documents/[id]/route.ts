import { catalogResponse } from '@/lib/catalog-response';
import { serverSupabase } from '@/lib/supabase';
// Anonymous GET to an explicitly published delivery service. This deployment
// never receives a service key, Storage path, or signed private download URL.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (process.env.CATALOG_PUBLIC_DOCUMENT_DOWNLOADS !== 'true' || !/^[0-9a-f-]{36}$/i.test(id))
    return catalogResponse({ error: 'Please contact ANN Traders to request this document.' }, 404);
  try {
    const { data, error } = await serverSupabase()
      .from('documents')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('Visibility unavailable');
    if (!data) return catalogResponse({ error: 'Document unavailable' }, 404);
    const url = new URL('/functions/v1/catalog-document', process.env.NEXT_PUBLIC_SUPABASE_URL);
    url.searchParams.set('id', id);
    const response = await fetch(url, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return catalogResponse(
        { error: 'Document unavailable' },
        response.status === 404 ? 404 : 503,
      );
    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition': `attachment; filename="technical-document-${id}.pdf"`,
      },
    });
  } catch {
    return catalogResponse({ error: 'Document temporarily unavailable' }, 503);
  }
}
