# Hosted Supabase staging requirements

The reviewed rollout package is now available at [ops/staging](../../ops/staging/README.md): read-only preflight/postflight, an ordered source-checksum manifest and an atomic SQL fallback. Local rehearsals cover full rollback, existing-data rejection and RPC/RLS checks. It has not been applied remotely.

No hosted migration, data write or deployment was performed. GET-only REST inspection found no exposed `admin_profiles`, `products`, `product_media` or `product_documents` tables and none of the six R2 RPCs. The operator's hosted SQL Editor query confirmed `42P01`: `supabase_migrations.schema_migrations` does not exist. The configured direct database hostname also failed DNS resolution from this machine.

This is a missing application baseline, not a request to apply only the latest R2 patch. With no migration ledger and the application objects absent from REST, the required reviewed chain is **001–014** below. Absence of the ledger does not prove unrelated existing data or manually created objects are disposable. Verify the intended project, inspect any existing schema, back up, then approve only missing compatible migrations. Do not reset, infer permission to deploy, or restore legacy Images upload grants.

| Order | Exact migration | Required behavior |
| --- | --- | --- |
| 001 | `20261024000100_core.sql` | Original 28 core entities |
| 002 | `20261024000200_integrity.sql` | Integrity constraints |
| 003 | `20261024000300_security_rpc.sql` | RLS/RBAC and product RPCs |
| 004 | `20261024000400_relations_search.sql` | Relations and product search |
| 005 | `20261024000500_media.sql` | Media, private PDFs and media actions |
| 006 | `20261024000600_hardening.sql` | Privilege hardening/admin management |
| 007 | `20261024000700_audit_and_public.sql` | Audit and public projections |
| 008 | `20261024000800_outbox.sql` | Durable worker jobs and reference checks |
| 009 | `20261024000900_query_guards.sql` | Query and mutation guards |
| 010 | `20261024001000_domain_checks.sql` | Domain constraints |
| 011 | `20261024001100_concurrent_publication.sql` | Concurrent publication guards |
| 012 | `20261024001200_r2_media.sql` | R2 sessions, verification leases, manifests and retirement |
| 013 | `20261024001300_r2_cleanup_bucket_contract.sql` | Cleanup bucket contract |
| 014 | `20261024001400_public_image_keys.sql` | Canonical public keys and cross-domain reference safety |

The specifically confirmed missing **service-role R2 endpoints** are:

```text
r2_create_upload
r2_claim_upload
r2_plan_promotion
r2_finish_upload
r2_fail_upload
r2_prepare_cleanup
```

The application also needs authenticated product RPCs `create_product_draft`, `save_product_draft`, `product_publish_errors`, `product_lifecycle`, `save_product_relation`, `list_admin_products` and `product_media_action`; private document attachment `attach_verified_document`; and worker RPCs `claim_catalog_jobs`, `complete_catalog_job`, `image_asset_referenced`. `manage_admin` retains its existing elevated-role controls. Some authenticated-only functions need not appear in service-role OpenAPI, so lack of exposure by that role alone is not proof their SQL definition is absent. The missing core tables, missing service-role R2 endpoints and operator-confirmed absent ledger are the staging readiness evidence.

`stage_image` and `attach_verified_image` are historical functions. Their service execution is deliberately revoked by migration 012; do not re-enable them to make an old upload path work. Private PDF storage remains Supabase Storage.

After approved staging migration application, verify Auth redirect URLs, invited users and MFA, role grants, exact-origin R2 CORS, private staging public-access flags, public delivery mode, worker secrets/scheduling, cleanup retry/dead letters and public projections. Before production, use a valid HTTPS custom domain and Cloudflare purge mode. The local development success does not authorize or replace hosted staging verification.
