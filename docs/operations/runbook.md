# Operator runbook

Local development uses HTTPS r2.dev delivery with explicit disabled CDN purge; follow [local R2 development](local-r2-development.md). It requires no custom domain. The production rollout section below remains strict about custom-domain delivery, TLS and exact-file purge.

## R2 rollout and recovery

Read `docs/architecture/r2-impact-assessment.md` before rollout. Migrations 012–014 preserve existing product/media/PDF/audit data; 013 supplies cleanup bucket fields and 014 exposes canonical public keys/protects cross-domain references. An empty project requires the complete 001–014 chain after review. Never reset an existing deployment or assume a missing migration ledger means existing data is disposable. Hosted schema changes remain unapplied. Old ready Images media remains usable; pending old upload capabilities must restart under R2. Keep legacy cleanup credentials until old jobs drain.

Production requires `R2_ENVIRONMENT=production`, `R2_CDN_PURGE_MODE=cloudflare`, bucket-restricted credentials, separate staging/public buckets and an HTTPS custom delivery origin. Use `infra/r2` for CORS/lifecycle guidance. Build-time configuration needs account ID, public origin and environment for CSP; credentials remain runtime-only. Pending sessions pin their origin. Existing ready images use canonical keys; explicitly trust former recorded origins during cutover. Rotate credentials within the same account/buckets without rewriting immutable keys.

Deploy the updated catalog-worker with its Deno import map. `verify_jwt=false` disables the gateway user-JWT check only for this worker; the handler requires its separate high-entropy `CATALOG_WORKER_SECRET` bearer token and accepts only POST. Configure `CLOUDFLARE_ZONE_ID` and restricted `CLOUDFLARE_CACHE_PURGE_TOKEN`; failed/missing purge fails the job for retry. Worker claims one job per call within a 120-second lease. Schedule enough invocations/concurrency for backlog volume; do not turn it into an always-running Vercel worker.

Inspect media `upload_status`, `upload_expires_at`, `verification_lease_until`, `object_manifest`, `retired_at` and outbox `last_error`. `r2_prepare_cleanup` is service-only and refuses cleanup before URL expiry plus ten minutes or while a verifier lease is live. Never manually delete a staging object while its PUT is still valid. Each session has a durable recovery task, including aborted uploads; public promotion plans are recorded before writes. A staging lifecycle after one day is the outage backstop. Dead-lettered public cleanup still needs operator investigation/replay; lifecycle rules do not remove public objects.

After an outage, fix credentials/CORS/provider/purge issues, then replay reviewed events using their existing IDs. A failed upload can retry through a new session; it never reuses a failed public key. Archived media rows are history and must not be hard deleted to fix a queue. A replacement becomes active only after verified commit; the original stays active on failure. Missing R2 infrastructure returns a configuration error and never falls back to insecure uploads.

Before production approval, verify real preflight and conditional PUT behavior, anonymous staging denial, strict token scope, actual malformed/oversized images, concurrent completion/replacement, CDN Cache-Control and purge, expired URL replay, cleanup outages and a restore drill. The local protocol double is not a substitute for these checks. Roll back application code to a compatible dual-provider release and retain migration 012/history; do not drop new columns or reset the schema. Old Images upload RPCs remain deliberately revoked, so an older Images-only upload release requires a separately reviewed compatibility migration rather than blindly restoring grants.

## Development checks and troubleshooting

- Missing Supabase environment: application renders setup instructions. Put values in `apps/admin/.env.local`, then restart dev server/rebuild production output.
- Docker unavailable: start Docker Desktop and rerun `pnpm db:start`. Plain PostgreSQL verification is documented in README; it cannot verify GoTrue, PostgREST, Storage or Edge platform behavior.
- Inactive/no-profile login: Auth identity exists but is not an administrator. Bootstrap first profile locally as operator; all subsequent access is invitation controlled.
- MFA required: follow `/security`. Never weaken RLS to bypass enrollment. Verify Supabase TOTP is enabled and device clock is correct.
- Duplicate code/SKU: use a unique trimmed value; case-folded uniqueness is intentional. Slugs remain stable unless explicitly edited.
- Revision conflict: reload authoritative data and reapply edits; never force overwrite.
- Published product edit: return to draft first. This hides it from public SQL views while changes are made.
- Price overlap: deactivate superseded active price, append correction; intervals are `[start,end)` and tiers `[min,max)`.
- Upload configuration error: verify server service-role key, R2 bucket credentials, pinned bucket names and CDN origin. Pending rows are never public. Use provider logs without dumping tokens.

## Jobs and reconciliation

Deploy the Edge consumer only to a test/staging environment first. Configure worker secret, Supabase service role and Cloudflare secrets through protected environment settings. A Cron task can invoke its HTTPS endpoint with `Authorization: Bearer <worker-secret>`; provision schedule/secrets through Vault. No schedule is installed by this repository yet.

As database operator inspect:

```sql
select id,event_type,attempts,available_at,lease_until,last_error,dead_lettered_at
from private.outbox_events where completed_at is null order by created_at limit 100;
select id,product_id,provider_asset_id,created_at from public.product_media
where upload_status='pending' and created_at<now()-interval '1 hour' order by created_at limit 100;
```

Investigate poison events before replay. For a specific reviewed event, reset dead_lettered_at, lease_until, attempts and available_at as operator; retain the stable UUID for idempotency. Confirm provider asset references before deletion. Never bulk-delete Cloudflare assets using only filenames or URL matching. R2 sessions enqueue durable reconciliation automatically; an operator must configure worker scheduling and investigate dead letters. Legacy Images pending uploads require separate reconciliation.

## Deploy checklist

1. Confirm target is staging, backup exists and the migration diff has been reviewed. No implicit permission to mutate the supplied hosted project is granted by local development work.
2. Run clean reset/migration tests with actual Supabase, generated types, lint, unit/SQL/browser checks and build.
3. Verify signup disabled, HTTPS exact origin, Auth redirect allowlist, email delivery, AAL2, role disable/revalidation and private document behavior using real staging sessions.
4. Verify real R2 uploads including malformed file, foreign staged ID, expired capability, detach/cleanup and network failure cases. Check staging is private, public CDN delivery uses generated outputs, and exact-file purge succeeds.
5. Review all remaining entries in implementation-status.md, particularly monitoring, jobs and public withdrawal consistency.
6. Approve database migrations separately, apply to intended target, then deploy admin. Never apply production migrations automatically from untrusted pull requests.
7. Smoke-test role matrix, create/save/publish/unpublish, document revocation and worker backlog. Watch platform logs.

## Backup and recovery policy

Choose Supabase backup/PITR capabilities appropriate to the actual plan; no paid-plan guarantees are assumed. Proposed operational targets: daily logical schema/data backup plus separately protected Auth/Storage recovery procedures, monthly restore drill in an isolated project, and explicitly agreed RPO/RTO before launch. Storage objects and Cloudflare originals need independent retention/export policies: PostgreSQL backups do not contain their bytes.

On incident: disable affected admin profile, preserve audit/outbox evidence, restrict provider token if compromised, capture request/job correlation without tokens, and identify last known-good migration/release. Restore into an isolated project and verify before switching traffic. Key rotation and destructive recovery require operator approval.

## Rollback checklist

Revert the application deployment to the prior compatible release. Use forward corrective migrations for a live database; preserve schema/data added after backups. Do not drop production schema. For disposable local Supabase only, `supabase db reset` is the repeatable reset path. Validate restored grants, roles, publication state, private files, media references and pending events. Record actual recovery time and data loss; no restore drill has been executed in this session.
