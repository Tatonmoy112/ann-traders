import { requireAdmin } from '@/lib/auth';
import { databaseError, failure, json } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const { db } = await requireAdmin();
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    const status = url.searchParams.get('status');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)));

    // 1. Fetch KPI status statistics in parallel
    const [allCountRes, newCountRes, inReviewCountRes, quotedCountRes, closedCountRes] =
      await Promise.all([
        db.from('inquiries').select('*', { count: 'exact', head: true }),
        db.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        db.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'in_review'),
        db.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'quoted'),
        db.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
      ]);

    const stats = {
      total: allCountRes.count ?? 0,
      new: newCountRes.count ?? 0,
      in_review: inReviewCountRes.count ?? 0,
      quoted: quotedCountRes.count ?? 0,
      closed: closedCountRes.count ?? 0,
    };

    // 2. Build filtered inquiries query
    let query = db
      .from('inquiries')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (q) {
      query = query.or(
        `reference_number.ilike.%${q}%,company_name.ilike.%${q}%,full_name.ilike.%${q}%,product_name.ilike.%${q}%,phone.ilike.%${q}%`,
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: rows, count, error } = await query;
    if (error) databaseError(error);

    return json({
      rows: rows ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
      stats,
    });
  } catch (e) {
    return failure(e);
  }
}

