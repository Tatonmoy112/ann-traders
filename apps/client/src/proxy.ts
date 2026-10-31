import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  BurstLimiter,
  invalidApiQuery,
  proxyOriginAllowed,
  purgeAuthorized,
  READ_METHODS,
  requestBudget,
  trustedClientIdentity,
} from './lib/security';
import { contentSecurityPolicy } from './lib/security-policy';

const limiter = new BurstLimiter();
function rejected(message: string, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        ...extra,
      },
    },
  );
}
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!proxyOriginAllowed(request.headers)) return rejected('Origin proxy is not authorized', 403);
  if (Buffer.byteLength(request.url, 'utf8') > 4096)
    return rejected('Request URL is too long', 414);
  const purge = path === '/api/catalog/revalidate';
  const methods = purge ? ['POST', 'OPTIONS'] : READ_METHODS;
  if (!methods.includes(request.method))
    return rejected('Method not allowed', 405, { Allow: methods.join(', ') });
  if (request.method === 'POST') {
    const length = request.headers.get('content-length');
    if (
      (length && (!/^\d+$/.test(length) || Number(length) > 0)) ||
      request.headers.has('transfer-encoding')
    )
      return rejected('This endpoint does not accept a request body', 413);
    const origin = request.headers.get('origin');
    const expected = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
      : request.nextUrl.origin;
    if (origin && origin !== expected) return rejected('Origin is not allowed', 403);
  }
  if (invalidApiQuery(path, request.nextUrl.searchParams))
    return rejected('Invalid query parameters', 400);
  const policy = requestBudget(
    path,
    purgeAuthorized(request.headers, process.env.INTERNAL_CATALOG_REVALIDATE_SECRET),
  );
  const overall = limiter.consume('global:' + policy.key, policy.global, 60_000);
  const identity = trustedClientIdentity(request.headers);
  const individual = identity
    ? limiter.consume(policy.key + ':' + identity, policy.individual, 60_000)
    : overall;
  if (!overall.allowed || !individual.allowed)
    return rejected('Too many requests. Please try again shortly.', 429, {
      'Retry-After': String(Math.max(overall.retryAfter, individual.retryAfter)),
      'X-RateLimit-Limit': String(identity ? policy.individual : policy.global),
      'X-RateLimit-Remaining': '0',
    });
  if (request.method === 'OPTIONS')
    return new NextResponse(null, {
      status: 204,
      headers: {
        Allow: methods.join(', '),
        'Cache-Control': 'private, no-store',
      },
    });
  if (path.startsWith('/api/') || path === '/_next/image') return NextResponse.next();
  const nonce = randomBytes(18).toString('base64');
  const csp = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
    process.env.R2_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://'),
  );
  const headers = new Headers(request.headers);
  // Replace caller-controlled values before Next parses the nonce.
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/webpack-hmr|favicon.ico).*)'] };
