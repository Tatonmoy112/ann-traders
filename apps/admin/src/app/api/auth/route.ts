import { z } from 'zod';
import { serverClient } from '@/lib/supabase';
import { body, failure, json } from '@/lib/http';
import { HttpError } from '@/lib/auth';
export async function POST(request: Request) {
  try {
    const input = z
      .object({
        action: z.enum(['login', 'logout', 'forgot', 'reset']),
        email: z.email().optional(),
        password: z.string().min(12).max(128).optional(),
      })
      .parse(await body(request));
    const db = await serverClient();
    if (input.action === 'logout') {
      await db.auth.signOut();
      return json({ ok: true });
    }
    if (input.action === 'forgot') {
      if (input.email)
        await db.auth.resetPasswordForEmail(input.email, {
          redirectTo: `${process.env.APP_ORIGIN ?? 'http://localhost:3000'}/auth/confirm?next=/reset-password`,
        });
      return json({ ok: true });
    }
    if (input.action === 'reset') {
      if (!input.password) throw new HttpError(422, 'Password is required');
      const { error } = await db.auth.updateUser({ password: input.password });
      if (error)
        throw new HttpError(400, 'Password could not be updated. Request another reset link.');
      return json({ ok: true });
    }
    if (!input.email || !input.password)
      throw new HttpError(422, 'Email and password are required');
    const { error } = await db.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) throw new HttpError(401, 'Sign-in failed. Check your email and password.');
    const { data: user } = await db.auth.getUser();
    const { data: profile } = await db
      .from('admin_profiles')
      .select('is_active')
      .eq('id', user.user!.id)
      .single();
    if (!profile?.is_active) {
      await db.auth.signOut();
      throw new HttpError(403, 'An active administrator invitation is required.');
    }
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
