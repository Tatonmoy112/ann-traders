import { notFound } from 'next/navigation';
import { masters } from '@ann/database';
import { requireAdmin } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';
import { MasterManager } from '@/components/master-manager';
export default async function MasterPage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  if (!Object.hasOwn(masters, table)) notFound();
  if (!isConfigured()) return null;
  const { profile } = await requireAdmin();
  return <MasterManager table={table} canEdit={profile.role !== 'editor'} />;
}
