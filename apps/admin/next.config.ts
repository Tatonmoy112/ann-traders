import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.ANN_E2E === '1' ? '.next-e2e' : '.next',
  output: 'standalone',
  transpilePackages: ['@ann/ui', '@ann/validation', '@ann/domain', '@ann/database', '@ann/storage'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'imagedelivery.net' },
      ...(process.env.R2_PUBLIC_BASE_URL
        ? [
            {
              protocol: new URL(process.env.R2_PUBLIC_BASE_URL).protocol.replace(':', '') as
                'https' | 'http',
              hostname: new URL(process.env.R2_PUBLIC_BASE_URL).hostname,
              port: new URL(process.env.R2_PUBLIC_BASE_URL).port,
              pathname: '/catalog/**',
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
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'" +
              (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://imagedelivery.net " +
              (process.env.R2_PUBLIC_BASE_URL
                ? new URL(process.env.R2_PUBLIC_BASE_URL).origin
                : '') +
              "; connect-src 'self' https://*.supabase.co " +
              (process.env.NEXT_PUBLIC_SUPABASE_URL &&
              ['localhost', '127.0.0.1'].includes(
                new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
              ) &&
              (process.env.NODE_ENV !== 'production' ||
                process.env.R2_ENVIRONMENT === 'development')
                ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin + ' '
                : '') +
              (process.env.R2_ACCOUNT_ID
                ? 'https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com'
                : '') +
              (process.env.NODE_ENV !== 'production' && process.env.R2_ENDPOINT
                ? ' ' + new URL(process.env.R2_ENDPOINT).origin
                : '') +
              "; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};
export default config;
