# Live R2 validation — 2026-10-24

Historical configuration assessment. The current r2.dev/local Supabase implementation and updated CORS checks are documented in [development verification](r2-development-results.md). Custom-domain/purge requirements below describe the earlier configuration and future production gates, not a local development requirement.

Both configured buckets authenticated successfully using the actual AWS SDK adapter. No secret values, signed URLs, database connection strings or raw provider errors were printed. `apps/admin/.env.local` was left unchanged. The only remote writes were uniquely generated diagnostic image objects in the two authorized buckets; no deployment, bucket configuration, hosted SQL migration, product or hosted media record was changed.

## Environment findings

| Actual local name | Name the application reads | Result |
| --- | --- | --- |
| `R2_UPLOAD_BUCKET` | `R2_STAGING_BUCKET` | Rename required; diagnostic alias matched `ann-traders-uploads-private` |
| `url` | `NEXT_PUBLIC_SUPABASE_URL` | Rename required |
| `publishable_key` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Rename required |
| `service_role_key` | `SUPABASE_SERVICE_ROLE_KEY` | Rename required |

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_BUCKET` and `R2_PUBLIC_BASE_URL` are present. Endpoint/account validation passed and the public bucket matched `ann-traders-product-images`. The adapter hardcodes S3 region `auto`; the configured `R2_REGION` variable is unused. Diagnostic aliases existed only in memory; the application still fails strict validation until its expected names are supplied.

Missing from the local file: `APP_ORIGIN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CACHE_PURGE_TOKEN` and the worker's `CATALOG_WORKER_SECRET`. The worker secret belongs in its deployed Edge environment; its absence from this local file does not prove it is absent remotely. The same applies to worker scheduling/secrets, which were not inspected or changed. Database-password/connection entries in the local file are not application configuration and were never used for hosted SQL writes.

## Executed checks

| Check | Observed result |
| --- | --- |
| Authenticated connectivity | Both buckets passed |
| Actual adapter presigned PUT | HTTP 200; exact content length/type and `If-None-Match` signed; diagnostic TTL five seconds |
| Repeated PUT | HTTP 412; existing bytes could not be overwritten |
| Expired independent capability | HTTP 403; no object created |
| Anonymous staging S3 GET | HTTP 400 `InvalidArgument`; no image returned |
| Server private read | Downloaded bytes matched the generated test PNG |
| Actual Sharp verifier | PNG 1024×768 decoded; corrupt bytes and wrong MIME rejected |
| Generated outputs | WebP thumbnail 320×240, card 768×576, detail 1024×768 |
| Promotion | All three objects written with matching digest, MIME, length and `public, max-age=31536000, immutable`; checked through authenticated S3 GET/HEAD |
| Local SQL attachment | Actual RPC sequence planned/attached verified metadata, set primary, incremented revision and retained history after detach; transaction rolled back |
| Local cleanup fencing | Active capability blocked cleanup |
| Public test-object deletion | All three exact keys deleted, authenticated HEAD returned 404, repeated deletion succeeded |
| Staging deletion | Deleted after signed-URL expiry plus the adapter's ten-minute safety margin; authenticated HEAD returned 404 |

All four diagnostic objects are confirmed deleted. Both exact-key recovery journals report zero remaining objects. No generated image bytes were fetched through the public CDN, so the diagnostic did not create cached image copies there.

The anonymous S3 response does **not** establish that staging has no public custom domain or r2.dev URL. Bucket CORS configuration reads returned 403 `AccessDenied`, consistent with restricted object credentials. We did not broaden those permissions or inspect unrelated buckets, so exact token scope, public-access flags and lifecycle rules remain operator checks.

## Configuration blockers

1. CORS preflight from both `http://localhost:3000` and `http://127.0.0.1:3000` returned 403 with no required allow headers. Fresh Chromium contexts also blocked requests from these origins. An unrelated origin was rejected. Since `APP_ORIGIN` is absent, the intended production origin could not be tested. Configure exact intended origins, PUT and `content-type,if-none-match` using the reviewed infrastructure instructions. The application defaults to `http://localhost:3000` for origin enforcement. Valid S3 presigning alone does not prove browser uploads work: [Cloudflare CORS documentation](https://developers.cloudflare.com/r2/buckets/cors/).
2. Public-domain DNS resolved, but HTTPS failed with `ERR_TLS_CERT_ALTNAME_INVALID`. Do not bypass certificate validation; review the custom-domain binding/certificate. No promoted object was fetched through the CDN, avoiding cached test bytes. Public delivery and CDN purge remain unverified.
3. Hosted Supabase GET-only schema inspection exposed none of the six R2 RPCs. `product_media` was absent from the exposed REST schema and its metadata query returned 404 `PGRST205`. Confirm the intended project, applied migration history, exposed schemas and schema cache before planning migrations. Do not assume only migration 012 is missing or reset the database. No hosted attachment/detach or authenticated admin-session test was attempted.
4. CDN purge credentials are missing locally. The cleanup worker deliberately refuses successful acknowledgement if exact-URL purge cannot complete. Configure restricted zone purge credentials in the worker runtime; full hosted cleanup remains blocked until schema, worker and purge configuration are verified.

## Local correction and regression

Inspection and a real SQL-to-worker contract check found that migration 012's `r2_prepare_cleanup` omitted `staging_bucket` and `public_bucket`, causing `cleanupR2Media` to fail closed before deleting anything. Added **migration 013** to return the recorded bucket names while preserving cleanup fences, reference checks, return type and service-only grants. Historical migration 012 was not edited. The correction is local and has not been applied to hosted Supabase.

All migrations through 013 replayed into a fresh isolated PostgreSQL database. The additive upgrade check preserved all original product, legacy image/primary/order/alt, private PDF and audit fields. **74 tests passed**, including 47 real PostgreSQL tests and the new bucket-contract regression. This does not replace real Supabase Auth/PostgREST/Edge runtime acceptance.

The first live diagnostic stopped because its anonymous-GET assertion expected 401/403; actual R2 returned 400 without bytes. A follow-up checked that response explicitly, completed verification/promotion/local attachment and deleted the public objects. The diagnostic assertion was corrected locally. Raw evidence is preserved in `r2-live-results.json`, `r2-live-followup-results.json` and `r2-live-browser-results.json`; the first run's assertion failure is not a provider outage.

## Repeatable diagnostics

Run from the repository root with Node 24:

```powershell
node --experimental-transform-types scripts/inspect-r2-config.mjs
node --experimental-transform-types scripts/verify-r2-live.mjs
# Explicit object test; local database fixtures roll back, remote Supabase remains GET-only:
$env:R2_PROBE_DATABASE_URL = 'postgresql://ann_local@127.0.0.1:55432/<isolated-test-database>'
node --experimental-transform-types scripts/verify-r2-live.mjs --objects
```

The object test keeps a credential-free exact-key recovery journal under ignored `.local-r2/`, separated from browser test output. Allow it to finish its ten-minute capability safety wait. Cleanup deletes only keys recorded by that invocation. It intentionally does not fetch generated assets through the public CDN without a verified purge configuration. Review [R2 infrastructure guidance](../../infra/r2/README.md) and the [operator runbook](../operations/runbook.md) before changing infrastructure.
