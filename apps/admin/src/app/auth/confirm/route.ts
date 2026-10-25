import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { serverClient } from '@/lib/supabase';
export async function GET(request: Request) {
  const url = new URL(request.url),
    db = await serverClient();
  const code = url.searchParams.get('code'),
    token = url.searchParams.get('token_hash'),
    type = url.searchParams.get('type');
  const result = code
    ? await db.auth.exchangeCodeForSession(code)
    : token && ['invite', 'recovery', 'email'].includes(type ?? '')
      ? await db.auth.verifyOtp({ token_hash: token, type: type as EmailOtpType })
      : null;
  const path =
    result && !result.error
      ? url.searchParams.get('next') === '/reset-password'
        ? '/reset-password'
        : '/dashboard'
      : '/login?error=expired';
  const response = NextResponse.redirect(
    new URL(path, process.env.APP_ORIGIN ?? 'http://localhost:3000'),
  );
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
