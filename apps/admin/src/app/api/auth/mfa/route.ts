import { z } from 'zod';
import { serverClient } from '@/lib/supabase';
import { HttpError } from '@/lib/auth';
import { body, failure, json } from '@/lib/http';
export async function POST(request: Request) {
  try {
    const db = await serverClient();
    const { data: user } = await db.auth.getUser();
    if (!user.user) throw new HttpError(401, 'Sign in first');
    const { data: profile } = await db
      .from('admin_profiles')
      .select('id,is_active')
      .eq('id', user.user.id)
      .single();
    if (!profile?.is_active) throw new HttpError(403, 'Active administrator access required');
    const input = z
      .object({
        action: z.enum(['list', 'enroll', 'verify']),
        factor: z.uuid().optional(),
        code: z
          .string()
          .regex(/^\d{6}$/)
          .optional(),
      })
      .parse(await body(request));
    if (input.action === 'list') {
      const { data, error } = await db.auth.mfa.listFactors();
      if (error) throw new HttpError(400, 'Could not load MFA factors');
      return json({ factors: data.totp.filter((f) => f.status === 'verified') });
    }
    if (input.action === 'enroll') {
      const { data: existing } = await db.auth.mfa.listFactors();
      for (const f of existing?.all ?? [])
        if (f.status === 'unverified') await db.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await db.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `ANN Traders ${new Date().toISOString()}`,
      });
      if (error) throw new HttpError(400, 'Could not enroll an authenticator');
      return json({ factor: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    }
    if (!input.factor || !input.code)
      throw new HttpError(422, 'Enter a six-digit authenticator code');
    const { error } = await db.auth.mfa.challengeAndVerify({
      factorId: input.factor,
      code: input.code,
    });
    if (error)
      throw new HttpError(
        401,
        'The code was not accepted. Try the current code from your authenticator.',
      );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
