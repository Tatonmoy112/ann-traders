export type DocumentSource = { bucket: string; path: string };
export interface DocumentDelivery {
  visible: (id: string) => Promise<boolean>;
  source: (id: string) => Promise<DocumentSource | null>;
  download: (source: DocumentSource) => Promise<Blob>;
}
// Read-only delivery capability: never return Storage paths or signed URLs.
// Recheck current publication after reading bytes so withdrawal fails closed.
export async function serveCatalogDocument(request: Request, delivery: DocumentDelivery) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return new Response(null, { status: 404, headers });
  try {
    if (!(await delivery.visible(id))) return new Response(null, { status: 404, headers });
    const source = await delivery.source(id);
    if (!source || source.bucket !== 'catalog-documents')
      return new Response(null, { status: 404, headers });
    const blob = await delivery.download(source);
    if (blob.size > 10485760 || blob.size < 5 || (await blob.slice(0, 5).text()) !== '%PDF-')
      throw new Error('Invalid document bytes');
    if (!(await delivery.visible(id))) return new Response(null, { status: 404, headers });
    return new Response(request.method === 'HEAD' ? null : blob, {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="technical-document-${id}.pdf"`,
        'Content-Length': String(blob.size),
      },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
