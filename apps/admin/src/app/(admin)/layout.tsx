import { redirect } from 'next/navigation';
import { requireAdmin, HttpError } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';
import { Setup } from '@/components/setup';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isConfigured()) return <Setup />;
  const result = await requireAdmin().catch((e) => {
    if (e instanceof HttpError)
      redirect(
        e.status === 401 ? '/login' : e.message === 'MFA required' ? '/security' : '/unauthorized',
      );
    throw e;
  });
  return <Shell profile={result.profile}>{children}</Shell>;
}
