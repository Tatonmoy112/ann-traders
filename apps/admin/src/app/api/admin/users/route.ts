import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { integrationClient } from '@/lib/privileged';
import { body, databaseError, failure, json } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const { db } = await requireAdmin(['super_admin']);
    const page = Math.max(
      1,
      Math.min(10000, Number(new URL(request.url).searchParams.get('page') ?? 1) || 1),
    );
    const { data, error, count } = await db
      .from('admin_profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * 20, page * 20 - 1);
    if (error) databaseError(error);
    return json({ rows: data, total: count });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db, profile } = await requireAdmin(['super_admin']);
    const { error: fresh } = await db.auth.getUser();
    if (fresh) throw new HttpError(401, 'Reauthenticate before managing administrators');
    const input = z
      .object({
        id: z.uuid().optional(),
        email: z.email().optional(),
        full_name: z.string().trim().min(2).max(150),
        role: z.enum(['super_admin', 'admin', 'editor']),
        is_active: z.boolean(),
      })
      .parse(await body(request));
    if (input.id === profile.id)
      throw new HttpError(403, 'You cannot change your own role or activation state.');
    const privileged = integrationClient();
    let target = input.id,
      invited = false;
    if (!target) {
      if (!input.email) throw new HttpError(422, 'Email is required for an invitation');
      const { data, error } = await privileged.auth.admin.inviteUserByEmail(input.email, {
        redirectTo: `${process.env.APP_ORIGIN ?? 'http://localhost:3000'}/auth/confirm?next=/reset-password`,
      });
      if (error)
        throw new HttpError(400, 'Invitation failed. The address may already be registered.');
      target = data.user.id;
      invited = true;
    }
    const { error } = await privileged.rpc('manage_admin', {
      actor: profile.id,
      target,
      display_name: input.full_name,
      new_role: input.role,
      active: input.is_active,
    });
    if (error) {
      if (invited) await privileged.auth.admin.deleteUser(target);
      databaseError(error);
    }
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
