import type { NextConfig } from 'next';

const developmentMedia =
  process.env.VERCEL_ENV !== 'production' &&
  (process.env.R2_ENVIRONMENT === 'development' || process.env.NODE_ENV === 'development');
const delivery = process.env.R2_PUBLIC_BASE_URL ? new URL(process.env.R2_PUBLIC_BASE_URL) : null;
if (
  delivery &&
  (delivery.username ||
    delivery.password ||
    delivery.search ||
    delivery.hash ||
    (delivery.protocol !== 'https:' &&
      !(
        developmentMedia &&
        delivery.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(delivery.hostname)
      )) ||
    (!developmentMedia && delivery.hostname.endsWith('.r2.dev')))
) {
  throw new Error(
    'Catalog media requires a trusted HTTPS delivery domain; local/r2.dev delivery requires development mode',
  );
}
const httpsSite = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://');
const config: NextConfig = {
  distDir: process.env.CLIENT_SECURITY_BUILD === 'true' ? '.next-security' : '.next',
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  poweredByHeader: false,
  transpilePackages: ['@ann/ui', '@ann/domain', '@ann/database'],
  experimental: { proxyClientMaxBodySize: '1kb' },
  images: {
    dangerouslyAllowLocalIP: false,
    dangerouslyAllowSVG: false,
    maximumRedirects: 0,
    qualities: [75],
    remotePatterns: [
      { protocol: 'https', hostname: 'imagedelivery.net', pathname: '/**', search: '' },
      ...(delivery
        ? [
            {
              protocol: delivery.protocol.slice(0, -1) as 'https' | 'http',
              hostname: delivery.hostname,
              port: delivery.port,
              pathname:
                delivery.pathname === '/' ? '/**' : delivery.pathname.replace(/\/$/, '') + '/**',
              search: '',
            },
          ]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          ...(process.env.NODE_ENV === 'production' && httpsSite
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
            : []),
        ],
      },
    ];
  },
};
export default config;
