import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error('Public catalog Supabase configuration is missing');
  const origin = new URL(url);
  if (
    origin.username ||
    origin.password ||
    (origin.protocol !== 'https:' &&
      !(
        process.env.VERCEL_ENV !== 'production' &&
        origin.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
      ))
  )
    throw new Error('Supabase requires HTTPS or a local development endpoint');
  if (key.startsWith('sb_secret_')) throw new Error('A public publishable key is required');
  if (key.split('.').length === 3) {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.role !== 'anon') throw new Error('Only anonymous Supabase keys are allowed');
  }
  return createClient(url, key, {
    db: { schema: 'public_catalog', retry: false },
    global: {
      fetch: (input, init) => {
        const method = (
          init?.method || (input instanceof Request ? input.method : 'GET')
        ).toUpperCase();
        if (!['GET', 'HEAD'].includes(method))
          throw new Error('Public catalog database transport is read-only');
        const signals = [AbortSignal.timeout(8000)];
        const upstream = init?.signal ?? (input instanceof Request ? input.signal : null);
        if (upstream) signals.push(upstream);
        return fetch(input, {
          ...init,
          cache: 'no-store',
          redirect: 'error',
          credentials: 'omit',
          signal: AbortSignal.any(signals),
        });
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
