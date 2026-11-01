import { requireAdmin } from '@/lib/auth';
import { databaseError, failure, json } from '@/lib/http';
import { mediaDelivery } from '@/lib/r2';
export async function GET(request: Request) {
  try {
    const { db } = await requireAdmin();
    const q = new URL(request.url).searchParams,
      kind = q.get('kind') === 'documents' ? 'product_documents' : 'product_media',
      page = Math.max(1, Math.min(10000, Number(q.get('page') ?? 1) || 1));
    const query =
      kind === 'product_media'
        ? db
            .from(kind)
            .select(
              'id,product_id,provider,delivery_url,alt_text,upload_status,created_at,object_manifest',
              {
                count: 'exact',
              },
            )
            .is('retired_at', null)
        : db
            .from(kind)
            .select('id,product_id,title,document_type,is_public,created_at', { count: 'exact' })
            .is('retired_at', null);
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * 20, page * 20 - 1);
    if (error) databaseError(error);
    return json({
      rows: kind === 'product_media' ? (data ?? []).map(mediaDelivery) : data,
      total: count,
    });
  } catch (e) {
    return failure(e);
  }
}
