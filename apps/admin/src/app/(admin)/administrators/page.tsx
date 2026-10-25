import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';
import { AdminUsers } from '@/components/admin-users';
export default async function Administrators() {
  if (!isConfigured()) return null;
  const { profile } = await requireAdmin();
  if (profile.role !== 'super_admin') redirect('/unauthorized');
  return <AdminUsers />;
}
