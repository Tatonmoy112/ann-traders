import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isConfigured } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { dhakaDate } from '@ann/domain';
import { Badge } from '@ann/ui';
import { AuditDetail, type AuditRow } from '@/components/library';
export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!isConfigured()) return null;
  const { db, profile } = await requireAdmin();
  if (profile.role === 'editor') redirect('/unauthorized');
  const q = await searchParams,
    page = Math.max(1, Math.min(10000, Number(q.page ?? 1) || 1));
  let query = db.from('audit_logs').select('*', { count: 'exact' });
  if (q.entity && /^[a-z_]{1,100}$/.test(q.entity)) query = query.eq('entity_name', q.entity);
  if (q.action && ['insert', 'update', 'delete'].includes(q.action))
    query = query.eq('action', q.action);
  if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from))
    query = query.gte('created_at', `${q.from}T00:00:00+06:00`);
  if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to))
    query = query.lte('created_at', `${q.to}T23:59:59.999+06:00`);
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error('Audit query failed');
  const link = (n: number) => {
    const next = new URLSearchParams(
      Object.entries(q).filter((x): x is [string, string] => Boolean(x[1])),
    );
    next.set('page', String(n));
    return `/activity?${next}`;
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE HISTORY</span>
          <h1>Activity log</h1>
          <p>An immutable record of catalog and administrator changes.</p>
        </div>
      </div>
      <section className="panel">
        <form className="table-toolbar">
          <input
            name="entity"
            placeholder="Entity name, e.g. products"
            aria-label="Entity filter"
            defaultValue={q.entity}
          />
          <select aria-label="Action filter" name="action" defaultValue={q.action ?? ''}>
            <option value="">All actions</option>
            {['insert', 'update', 'delete'].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <input type="date" name="from" aria-label="From date in Dhaka" defaultValue={q.from} />
          <input type="date" name="to" aria-label="To date in Dhaka" defaultValue={q.to} />
          <button className="btn btn-outline">Apply</button>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time · Dhaka</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Actor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => (
                <tr key={row.id}>
                  <td>{dhakaDate(row.created_at)}</td>
                  <td>
                    <strong>{row.entity_name}</strong>
                    <small style={{ display: 'block' }} className="muted">
                      {row.entity_id.slice(0, 8)}
                    </small>
                  </td>
                  <td>
                    <Badge>{row.action}</Badge>
                  </td>
                  <td className="muted">{row.admin_id.slice(0, 8)}</td>
                  <td>
                    <AuditDetail row={row as AuditRow} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data?.length && (
          <div className="empty-state">
            <h3>No activity matches these filters</h3>
            <p>Changes will appear here as your catalog takes shape.</p>
          </div>
        )}
        <div className="pagination">
          <span>
            {count ?? 0} events · Page {page}
          </span>
          <div>
            {page > 1 && (
              <Link className="btn btn-outline" href={link(page - 1)}>
                Previous
              </Link>
            )}
            {page * 20 < (count ?? 0) && (
              <Link className="btn btn-outline" href={link(page + 1)}>
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
