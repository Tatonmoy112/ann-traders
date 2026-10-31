# ANN Traders

Two independent Next.js 16 deployments share one Supabase database: `apps/admin` manages the catalog and `apps/client` serves the read-only public website. The public app includes `/`, `/products`, `/products/[slug]`, `/documents`, `/contact` and `/api/catalog/*`. It renders initial discovery data on the server using anonymous published-safe projections, bounded product cards and a short server data cache. The admin retains Supabase SSR authentication, roles/MFA, transactional editing/publication, price history, R2 media processing and audit history.

**This is a tested development implementation, not a production readiness claim.** Live Supabase Auth/Storage, Cloudflare upload, invitation delivery, worker scheduling and deployment still require staging verification. Detailed remaining work is in [implementation status](docs/implementation-status.md). No remote database migrations or deployment have been performed.

## Run locally

Prerequisites: Node 24, pnpm 10.34.7, Docker Desktop running for Supabase CLI.

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:start
pnpm.cmd db:reset
Copy-Item .env.example apps/admin/.env.local
pnpm.cmd exec supabase status
```

Put the local API URL and publishable key from `supabase status` in `apps/admin/.env.local`; do not paste secrets into source files. Set `APP_ORIGIN=http://localhost:3000`. Then:

```powershell
pnpm.cmd dev
```

Visit http://localhost:3000. Without configuration the app shows explicit setup instructions; it does not fabricate a logged-in account or catalog. Native PowerShell script execution is restricted on this machine, so use `pnpm.cmd` / `npm.cmd` instead of `.ps1` wrappers. In other shells use ordinary `pnpm`.

Create the first Auth user in **local** Supabase Studio, copy its UUID, and insert the first profile as the database operator:

```sql
insert into public.admin_profiles(id, full_name, role)
values ('<auth-user-uuid>', 'Workspace Administrator', 'super_admin');
```

Sign in and enroll an authenticator at `/security`. Admin and super-admin require AAL2; editors use their active authenticated session. To invite additional administrators, configure `SUPABASE_SERVICE_ROLE_KEY` server-side and use Administrators. Do not enable public signup. Local inbox is http://localhost:54324. See [Auth setup](docs/security/secrets-and-auth.md).

## Product workflow

Create a draft with name/code/slug → assign category/brand → add variants and units → add current prices → save → enter specifications/packaging/classification → attach verified image/documents → review publishing errors → publish. Each save carries a revision and rejects concurrent overwrites. Return a published/archived product to draft before editing relationships. Existing variants are deactivated rather than deleted; saved price amounts/windows are immutable, so deactivate an old price and append its replacement.

The editor bounds products to 100 variants and 500 price/relationship rows. Lookups are limited to 500 entries and display a warning beyond that; asynchronous lookup search remains a scaling task. Category rules currently apply to the primary category directly. Tier quantities use half-open ranges and the exact price unit; on-request quotes cannot contain numeric tiers.

## Media configuration

New uploads use **Cloudflare R2**. Set server-only `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_STAGING_BUCKET`, `R2_PUBLIC_BUCKET`, `R2_PUBLIC_BASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Local development uses the public bucket's real HTTPS `r2.dev` URL with `R2_ENVIRONMENT=development`, loopback `APP_ORIGIN`, and `R2_CDN_PURGE_MODE=disabled`. No custom domain or purge token is needed locally. The staging bucket stays private. See [local R2 setup](docs/operations/local-r2-development.md).

Production uses `R2_ENVIRONMENT=production`, `R2_CDN_PURGE_MODE=cloudflare`, an HTTPS custom domain and restricted zone purge credentials. Build-time settings include account ID, delivery origin and environment; credentials stay runtime-only. Restart development after URL changes and rebuild production CSP when changing its public origin.

For a database already at 001–011, review migrations **012–014**. An empty hosted project needs the full 001–014 chain; verify the intended project/history first. Migration 013 supplies cleanup bucket fields; 014 exposes canonical public object keys and protects references across domain changes. No product-media columns or 28-entity architecture changes are needed for development delivery. Never reset an existing database. The browser uses a conditional five-minute presigned PUT; server verification checks actual bytes/signature/type/size/dimensions, fully decodes/re-encodes, and publishes immutable-key 320/768/2000px WebP outputs. Development outputs use `no-store`; production outputs use immutable year-long caching. Failed promotions have durable recovery manifests. Replacement/detach preserve media history, placement and audit. Existing Images rows/URLs still work; new Images uploads are disabled. No automatic legacy asset transfer/deletion is performed.

See [impact assessment](docs/architecture/r2-impact-assessment.md), [R2 lifecycle](docs/architecture/r2-image-lifecycle.md) and [operator configuration](infra/r2/README.md) for exact CORS, lifecycle, restricted-token, custom-domain/CDN/purge and rollout requirements. No R2 infrastructure has been provisioned by this repository. Real R2/Supabase staging acceptance is required before production approval.

Technical files use the private `catalog-documents` bucket. Upload supports PDFs up to 10 MB with signature checks; signed admin download URLs expire after 60 seconds. Public projection never contains storage paths. Malware scanning is not implemented; use trusted administrator uploads until the staging threat review decides whether scanning is required.

## Verify

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd db:test
pnpm.cmd exec playwright install chromium
pnpm.cmd test:e2e
```

`pnpm test` skips database integration tests unless `TEST_DATABASE_URL` is set. CI sets it and runs the full suite. Browser tests start a local Supabase HTTP double and a separate Next dev server on ports 54329/3100; they never contact the supplied hosted project. A cached Chromium installation can be selected with `PLAYWRIGHT_CHROMIUM_PATH`.

R2 protocol tests use a local S3 double (browser port 54330), actual AWS SDK signing, conditional writes and actual Sharp decoding. Browser tests isolate build output in `.next-e2e` so they can coexist with a normal development build. Run `node scripts/verify-r2-upgrade.mjs` with an isolated local `TEST_DATABASE_URL` to create a separate upgrade-test database and prove legacy image/product/PDF/audit data is unchanged; it never resets existing databases. `pnpm worker:check` type-checks the Edge worker with pinned Deno dependencies without executing it.

For plain PostgreSQL verification without Docker, initialize an isolated empty cluster/database, then:

```powershell
# The bootstrap creates TEST substitutes for platform Auth/Storage objects.
# Never run it against Supabase or an existing business database.
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f scripts/local-postgres-bootstrap.sql
Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | ForEach-Object {
  psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName
  if ($LASTEXITCODE -ne 0) { throw 'Migration failed' }
}
pnpm.cmd test
node scripts/benchmark.mjs
node scripts/introspect-types.mjs
```

`TEST_DATABASE_URL` must point at the isolated local test database. Tests/benchmarks roll their fixtures back. The committed types were generated from the applied PostgreSQL schema, not invented; `pnpm db:types` uses official Supabase CLI generation after the local Supabase stack starts. `scripts/build-schema.mjs` is source-import tooling for initial authoring; never regenerate migration history after deploying it.

See [verification evidence](docs/verification/results.md), [architecture](docs/architecture/system-overview.md), [RLS matrix](docs/security/rls-policy-matrix.md), [runbook](docs/operations/runbook.md) and [cache contract](docs/architecture/cache-and-invalidation.md).

## Deploy and maintain

Create separate deployment projects rooted at `apps/admin` and `apps/client`, using the root workspace lockfile. Build with `pnpm --filter @ann/admin build` and `pnpm --filter @ann/client build`, respectively. Configure the public app from [its own environment example](apps/client/.env.example), with only the publishable/anonymous database key; never copy admin secrets into it. Set exact admin `APP_ORIGIN` and Supabase allowed redirect URLs. Rebuild after public configuration changes. See [public catalog setup](apps/client/README.md) and [remediation evidence and rollout](docs/verification/public-catalog-remediation.md) before applying migrations or deploying.

Docker files are supplied; Docker release execution is unverified while the daemon is unavailable. Run `docker compose --env-file apps/admin/.env.local build` followed by `docker compose --env-file apps/admin/.env.local up -d` once Docker is running. A local Supabase host exposed as `127.0.0.1` must be changed to a container-reachable URL for a containerized admin server; use a hosted dev project or documented host networking.

GitHub Actions includes application checks with PostgreSQL 17, provider-double browser tests, dependency audit and a separate local Supabase migration/pgTAP job. CI has not been run remotely. Production migrations and deployment remain an explicit operator-controlled step with backup and approval. Never execute the plain-Postgres test bootstrap in staging/production.
