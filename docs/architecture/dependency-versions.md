# Verified dependency choices

Resolved from the official npm registry and locked in `pnpm-lock.yaml` on 2026-10-24. Reference Next 16.2.9 was upgraded to the available stable 16.4.3. React stays at compatible 19.2.4. Use frozen-lockfile installs in CI.

| Dependency | Installed |
|---|---|
| Node / pnpm | 24.19.0 / 10.34.7 |
| Next / React | 16.4.3 / 19.2.4 |
| TypeScript | 5.9.3 |
| Supabase SSR / client / CLI | 0.12.7 / 2.118.0 / 2.122.0 |
| TanStack Query / Table | 5.104.5 / 8.21.3 |
| React Hook Form / Zod | 7.91.0 / 4.6.7 |
| Tailwind | 4.3.3 |
| Radix Dialog | 1.3.1 |
| Sharp | 0.35.5 |
| AWS SDK S3 client / presigner | 3.1156.0 / 3.1156.0 |
| Deno (worker verification) | 2.9.6 |
| Vitest / Playwright | 3.2.7 / 1.64.1 |
| Turborepo | 2.11.10 |

Reviewed installed Next guides for proxy and async cookies before implementing refresh plumbing, and official [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp), [Cloudflare direct uploads](https://developers.cloudflare.com/images/storage/upload-images/direct-creator-upload/) and [PostgREST column casting](https://docs.postgrest.org/en/stable/references/api/tables_views.html#casting-columns) documentation for version-sensitive APIs. Decimal SQL casts are used before JSON serialization to avoid browser number precision loss.

The R2 refactor production dependency audit covers 178 dependencies and reports zero known vulnerabilities at all severities; its saved report is `docs/verification/r2-dependency-audit.json`. The original foundation audit remains in `docs/verification/dependency-audit.json`. These are point-in-time dependency advisory results, not application security certifications. The installer did not run the optional `unrs-resolver` build script; lint/build checks determine whether a required native artifact is missing. No unexplained global build-script approval was granted.
