import 'server-only';
import { serverClient } from './supabase';
import type { Role } from '@ann/domain';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireAdmin(roles: Role[] = ['super_admin', 'admin', 'editor']) {
  const db = await serverClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims.sub)
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  const { data: profile } = await db
    .from('admin_profiles')
    .select('*')
    .eq('id', data.claims.sub)
    .eq('is_active', true)
    .single();
  if (!profile || !roles.includes(profile.role as Role))
    throw new HttpError(403, 'Your account does not have access to this action.');
  if (profile.role !== 'editor' && data.claims.aal !== 'aal2')
    throw new HttpError(403, 'MFA required');
  return { db, profile };
}
