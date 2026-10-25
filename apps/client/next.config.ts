import type { NextConfig } from 'next';

const isStandalone = process.env.BUILD_STANDALONE === 'true';

const config: NextConfig = {
  ...(isStandalone ? { output: 'standalone' } : {}),
  transpilePackages: ['@ann/ui', '@ann/domain', '@ann/database'],
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'imagedelivery.net' },
      { protocol: 'https', hostname: 'pub-fbd4e8d632d144688a922a2fbc830b3f.r2.dev' },
      ...(process.env.R2_PUBLIC_BASE_URL
        ? [
            {
              protocol: new URL(process.env.R2_PUBLIC_BASE_URL).protocol.replace(':', '') as
                | 'https'
                | 'http',
              hostname: new URL(process.env.R2_PUBLIC_BASE_URL).hostname,
              port: new URL(process.env.R2_PUBLIC_BASE_URL).port,
              pathname: '/**',
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
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'" +
                (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://pub-fbd4e8d632d144688a922a2fbc830b3f.r2.dev https://imagedelivery.net" +
                (process.env.R2_PUBLIC_BASE_URL
                  ? ' ' + new URL(process.env.R2_PUBLIC_BASE_URL).origin
                  : ''),
              "connect-src 'self' https://*.supabase.co" +
                (process.env.NEXT_PUBLIC_SUPABASE_URL &&
                ['localhost', '127.0.0.1'].includes(
                  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
                )
                  ? ' ' + new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
                  : ''),
              "font-src 'self' data:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default config;
