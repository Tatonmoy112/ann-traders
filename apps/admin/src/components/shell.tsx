'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tags,
  SlidersHorizontal,
  Ruler,
  Factory,
  Layers,
  ShieldCheck,
  Leaf,
  Settings2,
  History,
  Users,
  Menu,
  PanelLeftClose,
  Search,
  ChevronRight,
  LogOut,
  Box,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
} from 'lucide-react';
import type { Profile } from '@ann/database';
import { api } from '@/lib/client';
const groups = [
  {
    label: 'WORKSPACE',
    items: [
      ['Dashboard', '/dashboard', LayoutDashboard],
      ['Products', '/products', Package],
      ['Inquiries (RFQ)', '/inquiries', FileSpreadsheet],
    ],
  },
  {
    label: 'CATALOG STRUCTURE',
    items: [
      ['Categories', '/masters/categories', FolderTree],
      ['Brands', '/masters/brands', Tags],
      ['Attributes', '/masters/attribute_definitions', SlidersHorizontal],
      ['Attribute options', '/masters/attribute_options', Layers],
      ['Category specifications', '/masters/category_attributes', Settings2],
      ['Units', '/masters/units', Ruler],
    ],
  },
  {
    label: 'INDUSTRIAL TAXONOMY',
    items: [
      ['Industries', '/masters/industries', Factory],
      ['Applications', '/masters/applications', Box],
      ['Certifications', '/masters/certifications', ShieldCheck],
      ['Fibers', '/masters/fibers', Leaf],
      ['Equipment models', '/masters/equipment_models', Settings2],
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      ['Media library', '/media', ImageIcon],
      ['Technical documents', '/documents', FileText],
      ['Activity log', '/activity', History],
      ['Administrators', '/administrators', Users],
    ],
  },
];
export function Shell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const path = usePathname(),
    router = useRouter();
  const [mobile, setMobile] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [q, setQ] = useState(''),
    [error, setError] = useState('');
  const current =
    groups.flatMap((g) => g.items).find((i) => path.startsWith(String(i[1])))?.[0] ?? 'Workspace';
  return (
    <div className={`workspace ${collapsed ? 'is-collapsed' : ''}`}>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <Link href="/dashboard" className="brand">
          <span className="monogram">
            A<span>n</span>
          </span>
          <div>
            ANN TRADERS<small>CATALOG WORKSPACE</small>
          </div>
        </Link>
        <div className="workspace-label">
          <span className="workspace-dot" /> Admin workspace{' '}
          <span className="workspace-version">V1</span>
        </div>
        <nav>
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <p>{g.label}</p>
              {g.items
                .filter(
                  (i) =>
                    profile.role !== 'editor' ||
                    !['Activity log', 'Administrators'].includes(String(i[0])),
                )
                .filter((i) => profile.role === 'super_admin' || i[0] !== 'Administrators')
                .map(([label, href, Icon]) => {
                  const Component = Icon as typeof Package;
                  return (
                    <Link
                      key={String(href)}
                      href={String(href)}
                      title={String(label)}
                      onClick={() => setMobile(false)}
                      className={path.startsWith(String(href)) ? 'nav-item active' : 'nav-item'}
                    >
                      <Component size={18} />
                      <span>{String(label)}</span>
                      {label === 'Products' && <ChevronRight size={14} />}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={17} />
          <span>Private & secure workspace</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button desktop-toggle"
              aria-label="Toggle sidebar"
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeftClose size={19} />
            </button>
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={13} />
              <strong>{String(current)}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/products?q=${encodeURIComponent(q)}`);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search catalog"
                placeholder="Search catalog…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <span className="topbar-divider" />
            <div className="account">
              <span className="avatar">
                {profile.full_name
                  .split(' ')
                  .map((v) => v[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <div>
                <strong>{profile.full_name}</strong>
                <small>{profile.role.replace('_', ' ')}</small>
              </div>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await api('/api/auth', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'logout' }),
                  });
                  window.location.assign(new URL('/login', window.location.origin).toString());
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} ANN Traders</span>
          <span>Catalog management · Asia/Dhaka</span>
        </footer>
      </div>
    </div>
  );
}
