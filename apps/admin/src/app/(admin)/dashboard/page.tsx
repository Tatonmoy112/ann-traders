import Link from 'next/link';
import {
  Package,
  FilePenLine,
  Globe,
  Archive,
  ArrowUpRight,
  Plus,
  CheckCircle2,
  ImageOff,
  ArrowRight,
  Layers,
  FolderTree,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';
import { Badge } from '@ann/ui';
import { dhakaDate } from '@ann/domain';
import { WorkerTrigger } from '@/components/worker-trigger';
export default async function Dashboard() {
  if (!isConfigured()) return null;
  const { db, profile } = await requireAdmin();
  const results = await Promise.all([
    db.from('products').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    ...['published', 'draft', 'archived'].map((status) =>
      db
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
        .is('deleted_at', null),
    ),
    db.from('product_variants').select('id', { count: 'exact', head: true }).eq('is_active', true),
    db
      .from('products')
      .select('id,name,product_code,status,updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(6),
    db
      .from('categories')
      .select('id,name', { count: 'exact' })
      .eq('is_active', true)
      .order('sort_order')
      .limit(8),
    db
      .from('product_media')
      .select('id', { count: 'exact', head: true })
      .eq('upload_status', 'ready'),
  ]);
  if (results.some((r) => r.error)) throw new Error('Dashboard query failed');
  const counts = results.slice(0, 5).map((r) => r.count ?? 0),
    recent =
      (results[5].data as {
        id: string;
        name: string;
        product_code: string;
        status: string;
        updated_at: string;
      }[]) ?? [],
    categories = (results[6].data as { id: string; name: string }[]) ?? [];
  const stats = [
    {
      label: 'Total products',
      value: counts[0],
      hint: 'Across your catalog',
      icon: Package,
      color: 'blue',
    },
    {
      label: 'Published products',
      value: counts[1],
      hint: 'Visible in the public catalog',
      icon: Globe,
      color: 'green',
    },
    {
      label: 'Draft products',
      value: counts[2],
      hint: 'In your editorial workspace',
      icon: FilePenLine,
      color: 'amber',
    },
    {
      label: 'Archived products',
      value: counts[3],
      hint: 'Retained for your records',
      icon: Archive,
      color: 'purple',
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE OVERVIEW</span>
          <h1>
            Good to see you, {profile.full_name.split(' ')[0]}
            <span className="heading-dot">.</span>
          </h1>
          <p>Here’s where your catalog stands today.</p>
        </div>
        <Link className="btn btn-primary" href="/products/new">
          <Plus size={16} />
          Add product
        </Link>
      </div>
      <div className="overview-strip">
        <span>
          <span className="live-dot" /> Connected to your catalog
        </span>
        <span>
          {new Intl.DateTimeFormat('en-BD', { dateStyle: 'full', timeZone: 'Asia/Dhaka' }).format(
            new Date(),
          )}
        </span>
      </div>
      <div className="stats-grid">
        {stats.map((s) => (
          <Link
            href={`/products${s.label === 'Total products' ? '' : `?status=${s.label.split(' ')[0].toLowerCase()}`}`}
            className="stat-card"
            key={s.label}
          >
            <div className="stat-top">
              <span>{s.label}</span>
              <span className={`stat-icon ${s.color}`}>
                <s.icon size={19} />
              </span>
            </div>
            <strong>{s.value.toLocaleString('en-BD')}</strong>
            <div className="stat-bottom">
              <span>{s.hint}</span>
              <ArrowUpRight size={15} />
            </div>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recently updated products</h2>
              <p>Your latest catalog work, all in one place.</p>
            </div>
            <Link href="/products" className="text-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {recent.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>STATUS</th>
                    <th>LAST UPDATED</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link className="product-name" href={`/products/${p.id}`}>
                          <span className="product-placeholder">
                            <Package size={18} />
                          </span>
                          <span>
                            <strong>{p.name}</strong>
                            <small>{p.product_code}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Badge status={p.status}>{p.status}</Badge>
                      </td>
                      <td className="muted">{dhakaDate(p.updated_at)}</td>
                      <td>
                        <Link href={`/products/${p.id}`} aria-label={`Edit ${p.name}`}>
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <Package size={28} />
              </span>
              <h3>Your catalog starts here</h3>
              <p>Create your first product and build it one detail at a time.</p>
              <Link href="/products/new" className="btn btn-outline">
                <Plus size={15} />
                Create a product
              </Link>
            </div>
          )}
        </section>
        <section className="panel catalog-health">
          <div className="panel-heading">
            <div>
              <h2>Catalog at a glance</h2>
              <p>A clear view of your workspace.</p>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <div className="health-row">
            <span className="health-icon blue">
              <Layers size={18} />
            </span>
            <div>
              <strong>Active variants</strong>
              <small>Individual catalog configurations</small>
            </div>
            <b>{counts[4]}</b>
          </div>
          <div className="health-row">
            <span className="health-icon green">
              <FolderTree size={18} />
            </span>
            <div>
              <strong>Active categories</strong>
              <small>Organized product groups</small>
            </div>
            <b>{results[6].count ?? 0}</b>
          </div>
          <div className="health-row">
            <span className="health-icon amber">
              <ImageOff size={18} />
            </span>
            <div>
              <strong>Verified images</strong>
              <small>Ready for product presentation</small>
            </div>
            <b>{results[7].count ?? 0}</b>
          </div>
          <div className="health-note">
            <ShieldIcon /> Publishing checks technical requirements, pricing, and verified imagery
            before a product goes live.
          </div>
          <WorkerTrigger />
        </section>
      </div>
      <div className="section-label">
        <h2>Catalog structure</h2>
        <Link href="/masters/categories" className="text-link">
          Manage categories <ArrowRight size={14} />
        </Link>
      </div>
      <div className="category-grid">
        {categories.map((c, i) => (
          <Link href={`/products?category=${c.id}`} key={c.id} className="category-card">
            <span className="category-number">0{i + 1}</span>
            <h3>{c.name}</h3>
            <span className="text-link">
              Explore products <ArrowUpRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
function ShieldIcon() {
  return <CheckCircle2 size={17} />;
}
