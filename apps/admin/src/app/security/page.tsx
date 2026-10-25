import { redirect } from 'next/navigation';
import { serverClient, isConfigured } from '@/lib/supabase';
import { Setup } from '@/components/setup';
import { MfaForm } from '@/components/mfa-form';
export const dynamic = 'force-dynamic';
export default async function Security() {
  if (!isConfigured()) return <Setup />;
  const db = await serverClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims.sub) redirect('/login');
  const { data: profile } = await db
    .from('admin_profiles')
    .select('is_active')
    .eq('id', data.claims.sub)
    .single();
  if (!profile?.is_active) redirect('/unauthorized');
  return <MfaForm />;
}
