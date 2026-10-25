# R2 refactor verification

This records the original refactor checks. See [live R2 validation](r2-live-validation.md) for actual provider results, configuration gaps and migration 013's cleanup regression check (74 tests).

Executed locally on 2026-10-24. No hosted database, production infrastructure, bucket, domain, CORS policy or deployment was changed.

| Check | Result |
| --- | --- |
| Unit, provider and database tests | 73 passed: 46 real PostgreSQL, 11 R2 adapter/protocol, 3 image decoding, 10 domain, 3 retained PDF/signature tests |
| Browser workflows | All 6 scenarios passed against local Supabase and S3 protocol doubles |
| Production build | `pnpm build` passed, including Next compilation, TypeScript and route generation |
| Static checks | `pnpm lint` and `pnpm typecheck` passed |
| Edge worker | `pnpm worker:check` passed Deno type checking |
| Additive migration | Fresh migrations 001–012 and upgrade from 001–011 passed on isolated PostgreSQL 18 |
| Dependency advisory audit | 178 production dependencies; zero known advisories at all severities in `r2-dependency-audit.json` |
| Browser bundle inspection | No R2 secret variable, fixture secret, service-role fixture key or AWS SDK client marker found in production static JavaScript |

`scripts/verify-r2-upgrade.mjs` creates a separate local database, applies migrations 001–011, inserts existing product/media/private-document/audit fixtures, applies only migration 012, and asserts that all original fields are unchanged. Generated database types were read from the resulting PostgreSQL catalog. The original 28 core tables remain intact; migrations 001–011 are unchanged.

The browser scenarios cover the existing catalog workflow and authorization checks, expired PUT capabilities, direct browser PUT and verified replacement, repeated PUT rejection and corrupt bytes, and a provider outage followed by a new-session retry. Adapter tests verify actual AWS SigV4 presigning against a local protocol double, concurrent conditional writes, tampered headers, private-object denial, bounded reads, cleanup reference constraints, failed purge recovery and provider failures. SQL tests cover service-only permissions, ownership, revision/lease conflicts, unverified attachment rejection, replacement history and cleanup fencing.

These are local results. Plain PostgreSQL uses Auth/Storage platform substitutes, and browser provider doubles do not prove hosted Supabase, real R2 IAM/CORS/conditional-write behavior, custom-domain caching, CDN purge or deployed worker scheduling. Docker was unavailable, so actual Supabase runtime/pgTAP checks remain a staging gate. Follow the [operator runbook](../operations/runbook.md) and [R2 infrastructure instructions](../../infra/r2/README.md) before rollout. Existing Images assets stay on their current provider; no bulk migration was attempted.
