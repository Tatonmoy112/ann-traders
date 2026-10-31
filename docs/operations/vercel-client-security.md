# Vercel client security setup

These settings apply to the **apps/client** project. Repository changes do not activate a Vercel account firewall rule.

## Deployment environment

Use the public publishable key and HTTPS Supabase URL. Configure NEXT_PUBLIC_SITE_URL to the canonical HTTPS catalog origin. Set R2_ENVIRONMENT=production and R2_PUBLIC_BASE_URL to the custom HTTPS image domain. Vercel production rejects r2.dev even if a development flag was left enabled.

CLIENT_TRUSTED_PROXY=auto is the default. When Vercel provides VERCEL=1, the client uses the validated x-vercel-forwarded-for header and ignores arbitrary X-Forwarded-For. Ensure Vercel system environment variables are available. CLIENT_PROXY_ORIGIN_SECRET is not needed for Vercel. Do not set VERCEL=1 on a direct VPS origin.

Configure a random 32-256-character INTERNAL_CATALOG_REVALIDATE_SECRET for operator-only POST /api/catalog/revalidate. The request must have no body; an Origin header, when supplied, must match NEXT_PUBLIC_SITE_URL. Never put this secret, a service-role key, database password or R2 credentials in NEXT_PUBLIC variables.

## Shared rate-limit rule

In the client project's **Firewall > Configure > New Rule**, create:

| Field            | Value                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Name             | Public catalog dynamic requests                                                           |
| Conditions (AND) | Request path does not start with /_next/static/; request path does not equal /favicon.ico |
| Action           | Rate Limit                                                                                |
| Strategy         | Fixed Window                                                                              |
| Window           | 60 seconds                                                                                |
| Request limit    | 240                                                                                       |
| Counting key     | IP                                                                                        |
| Limit action     | Default 429                                                                               |

Review and publish the rule. This covers pages, APIs, RSC/prefetch traffic, image optimization, and the purge endpoint. Observe legitimate buyer traffic and tune the limit for shared factory/NAT connections. One combined rule fits Hobby's rate-limit-rule allowance; check account usage/pricing before activation.

Vercel counters are regional, shared across relevant function invocations within that region; they are **not one global cross-region quota**. The application's additional per-process limits are 120 reads/minute/IP, 240 image requests/minute/IP and 10 authenticated purges/minute/IP, plus per-process aggregate ceilings of 1200/2400/30 respectively. They return 429 with Retry-After. These local counters can reset on restart and differ across instances, so they do not replace the firewall.

Confirm the rule is active on the intended production and preview hostnames. The repository has no Vercel project/token/session connected, so firewall activation and a hosted 429 test remain operator tasks.

## Additional deployment checks

- Keep request-rendered HTML/API responses private and no-store. A shared HTML cache would break CSP nonces and publication checks.
- Verify HTTPS/HSTS, script nonce propagation, image allowlists and no service credentials in the deployed client.
- Keep the public API same-origin; no wildcard CORS or cookie-authenticated mutation endpoints are provided.
- Enable Supabase-side abuse/query controls appropriate to the project. A site firewall cannot limit direct requests to a public Supabase API key; grants, RLS and bounded query contracts remain the privacy boundary.
- Rotate the hosted database password previously embedded in the retired scripts/apply-public-catalog-migration.mjs helper. Update any legitimate server consumers after rotation. Removing source text does not revoke the password or erase Git history.

Primary references: [Vercel rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [Vercel trusted request headers](https://vercel.com/docs/headers/request-headers), [Next.js nonce CSP](https://nextjs.org/docs/app/guides/content-security-policy).
