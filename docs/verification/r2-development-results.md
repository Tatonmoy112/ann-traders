# Local R2 development verification — 2026-10-24

The development integration uses real R2, the real local Supabase Docker stack and the actual Next admin. No custom domain is required locally. Normal TLS verification remains enabled. No hosted database writes, hosted migrations, deployments or changes to R2 public-access flags were performed. The user applied the reviewed localhost CORS policy to private staging; subsequent preflights passed.

## Configuration and behavior

`apps/admin/.env.local` now contains canonical local Supabase names and generated local keys, `APP_ORIGIN=http://localhost:3000`, `R2_ENVIRONMENT=development`, `R2_CDN_PURGE_MODE=disabled`, the private/public bucket names and the actual public bucket HTTPS r2.dev origin. Duplicate placeholder public-base lines were normalized using the actual development URL already provided in the file. Server secrets were never printed or included in committed reports. Persistent local state and backups now use ignored `.local-r2/`, separated from Playwright's cleared output directory.

The staging bucket remains separate and is never enabled for public delivery. Signed PUT URLs target only its S3 API; only verified re-encoded WebP outputs enter the public bucket. Both `localhost:3000` and `127.0.0.1:3000` preflights returned 204 with exact allowed origins and headers. An unrelated origin returned 403. Bucket-configuration inspection remains denied to the restricted object credentials; the user's private-access settings were not overridden.

Development objects use `no-store` and CDN purge is explicitly skipped. Production defaults remain strict: custom HTTPS delivery, Cloudflare purge mode and required purge credentials. Disabled purge on a custom domain or in production mode fails validation. No TLS exceptions or certificate bypasses were added.

Object keys are canonical in media manifests, public `image_key`, and variant `key`. Admin URLs derive from the current configured origin. Domain cutover needs no object upload; former recorded origins must be explicitly trusted for retirement cleanup. Migration 014 protects category/brand references to the same key across domains. Existing Images media, the original 28 entities, media history, private PDF storage, publication guards and RBAC are preserved.

## Executed validation

| Check | Result |
| --- | --- |
| Actual local Supabase migrations | 001–014 applied locally; no reset of hosted data |
| Unit/integration SQL suite against actual local Supabase PostgreSQL | 83 passed: 49 PostgreSQL, 18 storage, 3 decoder, 10 domain, 3 PDF/signature |
| Actual Supabase pgTAP | 14 passed |
| ESLint / TypeScript | Passed |
| Edge Deno type checking | Passed |
| Real local invited-editor login | Passed |
| Public self-signup rejection | Passed; global signup disabled |
| Actual app session → browser presigned PUT → private object read → Sharp verification → public promotion → Supabase attachment | Passed |
| HTTPS public r2.dev image delivery | All three generated sizes passed; content length/MIME and no-store headers checked with TLS verification enabled |
| Unverified original at public bucket | 404 |
| Repeated signed PUT | 412 |
| Cross-origin mutation | 403 |
| Unauthenticated completion | 401 |
| Browser corrupt-image upload and verification | PUT succeeded; completion 422; failed media had no promoted manifest |
| Authenticated detach | Passed; media history retained |
| Outbox/worker test-object cleanup | Passed through real local Edge worker after unchanged URL expiry plus ten-minute margin: 6 jobs acknowledged; all 3 staging objects and 3 public variants confirmed 404 |
| Provider-double browser regressions | All 6 passed, including catalog lifecycle, replacement, corruption, expired URLs and outage retry |

The first provider attempt failed at private read because the development server was launched without outbound network access. Its media was safely retired and queued for recovery. The network-enabled runtime passed the full upload/verification/promotion flow. Local password login initially uncovered the CLI's email-provider toggle behavior; enabling that provider while keeping global signup disabled fixed login, and real signup rejection was verified. No auth guard was bypassed.

The local Edge handler boots and authenticated invocation succeeds. Both the failed attempt and the successful test session were reconciled by the actual worker. All six diagnostic objects are confirmed absent using authenticated S3 HEAD. The final test waited for real capability expiry and the existing safety margin; no SQL fence was shortened and no live staging capability was reopened. Local retired rows/audit history remain inspectable. Per-run JSON reports distinguish successful integration from failed runtime attempts. The first worker isolate logged a CPU soft-limit warning after processing a job; acknowledgements and cleanup succeeded. Hosted Edge resource limits remain part of staging acceptance.

The local admin, Supabase stack, Edge handler and 15-second local worker polling loop were left running. Generated local editor credentials are saved under ignored `.local-r2/local-r2-user.json`; no password appears in this report. Saved R2 reports passed a secret-value redaction check. Persistent local settings/journals are isolated from Playwright output cleanup.

## Hosted staging

The user confirmed `42P01` for the hosted migration ledger, and read-only REST inspection found no core app tables or R2 RPCs. The exact required baseline chain and RPC list is in [hosted staging requirements](r2-hosted-staging-requirements.md). All hosted changes remain unapplied pending separate approval. Local success does not validate production custom-domain TLS, CDN purge or deployed scheduling.

See [local startup and operations](../operations/local-r2-development.md), [current connectivity evidence](r2-development-connectivity.json), [real local integration evidence](r2-local-integration.json), and [hosted schema evidence](r2-hosted-schema-audit.json).
