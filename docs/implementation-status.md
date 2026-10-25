# Implementation status — 2026-10-24

## R2 refactor update

Development delivery is now explicit: HTTPS r2.dev, disabled development CDN purge, canonical keys and local Supabase Auth/REST/Edge verification. The localhost CORS policy is verified, 83 tests and 14 pgTAP checks pass, and all 6 browser regressions pass. See [development verification](verification/r2-development-results.md) and [hosted staging requirements](verification/r2-hosted-staging-requirements.md). Migration 014 changes only a public projection and cleanup reference logic; it adds no product-media columns. No hosted migration or deployment was applied.

The full real browser→R2→local Supabase path and actual Edge outbox cleanup passed. All six diagnostic R2 objects were deleted after the unchanged capability safety window; local history was retained.

Live R2 follow-up: provider PUT/verification/promotion/deletion passed with safe test objects; environment/CORS/TLS/hosted-schema gaps remain. Migration 013 fixes the cleanup bucket-field contract locally, with 74 passing tests. See [live validation](verification/r2-live-validation.md). No hosted migration or deployment was performed.

New image uploads now use the AWS SDK v3 R2 adapter, private conditional PUT staging, full byte decoding/re-encoding, immutable generated WebP sizes, lease-guarded attachment, non-destructive replacement/retirement and durable reference-aware cleanup/CDN purge. Migration 012 preserves all 28 entities and existing Images/PDF/audit data; the explicit additive-upgrade verification passes. Assessment: `docs/architecture/r2-impact-assessment.md`; design/rollout: `docs/architecture/r2-image-lifecycle.md` and `infra/r2/README.md`.

The foundation table below is a historical Phase 1 snapshot; its old Images upload and manual R2 reconciliation limitations are superseded by this update. Actual S3 uploads and generated-object deletion are verified, while browser/CDN/hosted attachment remain blocked as documented above. Worker deployment/scheduling and infrastructure remain unmodified. Existing ready Images media is retained, and no remote schema reset or existing asset deletion was attempted. Original test/build evidence is tracked in `docs/verification/r2-results.md`.

This is a working development implementation and a substantial catalog vertical slice. It does **not** satisfy the master prompt's full production Definition of Done yet. No supplied hosted database mutation or deployment was performed. Both reference folders and the original implementation folders were preserved.

## Delivered

| Area | State and evidence |
|---|---|
| Audit | Source inspection, 28-entity map, schema risks, reference UI patterns, industry sources and ADRs in `docs/` |
| Workspace | pnpm/Turborepo, Next 16.4.3, strict TypeScript, Tailwind 4, Radix/shadcn-style shared UI, TanStack Query/Table, RHF/Zod; dependencies pinned with lockfile |
| Responsive UI | Collapsible sidebar/mobile drawer, database dashboard, product table with search/filter/sort/pagination/column visibility, dictionary dialogs, product editor, libraries, audit and administrator screens |
| Authentication | SSR cookies, proxy refresh, protected operations, active profile revalidation, login/reset/logout, invitation route, TOTP enrollment/challenge; AAL2 required for elevated roles in application and DB |
| Core schema | All 28 tables in eleven migrations, FKs, folded uniqueness, timestamps, app-immutable audit, RLS/grants, publication checks and safe public views |
| Transactions | Draft create/save, variant ownership, preserved price history, revision locking, lifecycle/outbox atomic commit, relationship replacement with fixed table/column allowlists |
| Dictionaries | Category/brand/unit/attribute/options/category mapping/industry/application/certification/fiber/equipment create/update; admin-only writes; referenced masters cannot be hard deleted |
| Authoring | Basics/SEO, SKUs/MOQ/units/capacity/availability, fixed/range/on-request quotes, effective windows, tiers, packaging, typed category-mapped specs, extra categories, industries/applications, certification metadata, composition and equipment compatibility |
| Integrity | NUMERIC with text casts before JSON serialization, explicit required amounts, non-overlapping price/time tiers, positive values, GSM quantity rejection, typed attributes/option ownership/cardinality, required composition at publication |
| Provider code | Cloudflare staged direct upload and provider owner/product/status/URL verification, original MIME/bytes/dimensions checks, primary/alt/detach; private PDF upload/signature checks and expiring authorized download |
| Public contract | No customer UI; explicit published-safe `public_catalog.products`, `.variants`, `.documents` views; no raw storage paths, drafts, audit or administrator data |
| Jobs | Durable outbox with leases/retry/dead letters, service-only job RPCs and authenticated Edge consumer source; deliberately outbox-first, not a completed PGMQ/Cron setup |
| Types | Generated from the applied isolated PostgreSQL schema via `scripts/introspect-types.mjs`; official Supabase CLI generation command also supplied |
| Verification | 53 passing tests: 34 PostgreSQL/security, 10 domain, 9 provider contracts; 2 passing provider-double browser scenarios; lint, typecheck and production build checked |
| Migration replay | All eleven migrations replayed into a fresh isolated database, followed by 53 passing tests |
| Performance | 500/5,000/20,000 products with 2 variants/specs/prices plus 1 image each; warm single-client P95 10.2/23.3/72.6 ms; plans/hardware in `docs/verification/performance.json` |
| Dependencies | Production audit: 151 dependencies, zero known advisories at every severity; JSON report saved |
| Operations | README, architecture/security/worker/cache docs, deploy/rollback/backup runbook, Docker files and CI workflows supplied |

## Required remaining work

1. **Actual Supabase verification:** Docker daemon is unavailable. Start the local stack and run reset/pgTAP, official type generation and real Auth/Storage sessions. Current DB tests use PostgreSQL 18.4 with local substitutes for platform Auth/Storage objects. CI targets PostgreSQL 17 and actual Supabase, but remote CI has not run.
2. **Live integrations:** Verify Cloudflare permissions/variants/original-blob download, private Storage, invitation email/reset, MFA enrollment/recovery and disabled-session handling against staging. Browser tests use an explicit local HTTP provider double; provider unit tests are mocks/contracts.
3. **Worker operations:** Deploy/schedule Edge consumer, provision Cron/Vault secrets, finish pending-upload orphan reconciliation, alerts and replay tooling. PGMQ is not installed; see ADR 0002. Until scheduling, cleanup remains durable/pending.
4. **Media completeness:** Category/brand images, image reordering, product/variant asset assignment UI, document replacement/removal/visibility editing and comprehensive abort/retry UI need completion. Uploading and authorized downloading are implemented; every lifecycle path is not yet complete.
5. **Editor/list refinements:** Duplication, bulk selection/actions, all advanced filters (category descendants, pricing state, availability, technical values), category tree/drag ordering, cancel/reset and full public-DTO preview remain unfinished. Parent/sort fields do persist. Current preview is saved title/summary. Lookups cap at 500; editor caps 100 variants and 500 related rows and reports limits.
6. **Domain refinements:** Key-feature arrays, separate manufacturer-part-number field, every optional variant/document relationship, packaging/fiber/equipment fields in public DTOs and richer attribute metadata constraints need completion. Mapping applies to the direct primary category; ancestor inheritance is undefined.
7. **Release gates:** Sentry instrumentation, full request correlation, operational distributed rate limits beyond Auth controls/upload quotas, concurrent/cold/hosted load tests, Docker release execution, backup/PITR selection and restore drill remain pending. PDF signature checking is not malware scanning; use trusted operator uploads until scanning requirements are decided.
8. **Future caching:** Receiver/replay store and actual cross-deployment invalidation do not exist because customer UI is outside Phase 1. Events fail into retry/dead-letter storage until configured; no immediate shared-cache withdrawal guarantee is claimed.

## Exact continuation

Start Docker Desktop → `pnpm db:start` → `pnpm db:reset` → configure local `.env.local` → create first local Auth user/profile → `pnpm db:test` and `pnpm db:types` → real login/MFA/draft/media/publish staging smoke → finish media lifecycle and schedule worker → finish list/editor refinements → observability/restore drill → request remote migration/deployment approval only after a concrete release is reviewable.

The supplied `env.md` contains hosted connection details. It was treated as secret-bearing input, ignored by root Git/Docker configuration, and never printed or copied into committed source. No new credentials are needed to continue local code work.
