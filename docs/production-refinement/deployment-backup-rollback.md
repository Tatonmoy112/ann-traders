# Deployment, backup and rollback

No remote schema, production data, deployment, infrastructure or credentials were changed during this refinement. The steps below are an operator release procedure, not executed production work.

## Prepare and inspect

1. Build/test the exact revision; run `pnpm refinement:prepare`. Review the generated migration manifest and review SQL. They contain eleven incremental migrations and hashes for all 18 original prerequisites. Packaging makes zero database connections.
2. Confirm the approved staging/production project IDs and connection endpoints independently. Obtain the actual migration ledger, schema/grants/policies/function owners and data-quality results. Compare the pack's read-only audit SQL and generated local inventory to the target. A local surrogate ledger is not a Supabase migration ledger.
3. Do not use the older 001–014 empty-project baseline bundle for this update. Never reset a populated project or replay a baseline into it. Missing prerequisite public catalog migrations must be reviewed and applied in original chronological order through the normal migration mechanism.
4. Review inherited required rules, inactive/unmapped/mismatched specs, duplicate axes, price contexts, unpublished legacy data and asset limits. No automatic destructive backfill is provided. Correct approved catalog data through guarded authoring before attempting publication.

## Backup and staging rehearsal

Take a recoverable managed database backup/PITR point and an independent logical dump according to the actual Supabase plan. An operator with a verified connection can use `pg_dump --format=custom --file=<protected-backup-path> <connection>` with a client compatible with the server. Store credentials in protected environment/secret tooling, not command history or this repository. Include role/grant/extension recovery and provider-specific Auth/Storage procedures in the restore plan.

Export the R2 delivery objects referenced by manifests and the private PDF bucket separately. Database backups do not contain file bytes. Keep a timestamped object inventory and checksum mapping. Do not assume deleted generated image outputs or retired history can be recovered from PostgreSQL alone. Agree on retention, RPO and RTO; none have been approved or measured here.

Restore into an isolated staging project, validate counts/IDs/price/audit/media references and grants, then apply the eleven incremental migrations in order. Migration 008 has a five-second lock budget and 120-second statement budget. At larger production volumes, measure index construction on the clone and use an explicitly reviewed concurrent-build procedure/history record if the lock budget is unsuitable; do not silently remove its timeout or duplicate the index.

The local upgrade rehearsal compares every original public table value before/after upgrade and tests real concurrent sessions. It does not replace this managed-platform restore drill.

Migration 011 adds publication/dictionary serialization and optional-mapping semantic protection. Rehearse concurrent specification edits and publication in both orders, including controlled choices. Labels may still be corrected; disabling or reinterpreting a mapped definition used by published products requires withdrawal first.

## Deployment order

1. Apply reviewed migrations to staging through Supabase CLI/versioned migration tooling; retain the real ledger. Regenerate official platform types and compare them to the committed locally generated types. Expose `public_catalog` in PostgREST; reload its schema cache and verify grants/owners.
2. Deploy the admin with exact HTTPS `APP_ORIGIN`, SSR/Auth configuration and server-only provider credentials. All ordinary catalog mutations use the session-scoped database client. Existing elevated-role MFA remains mandatory.
3. Deploy `catalog-worker` with its pinned Deno import map. Use a random 32–256-character `CATALOG_WORKER_SECRET`. Set `CATALOG_INVALIDATE_URL=https://<public-host>/api/catalog/events` and matching `INTERNAL_CATALOG_REVALIDATE_SECRET` in worker/public deployments. The admin scheduler invokes this authoritative worker, rather than acknowledging jobs itself.
4. Verify scheduling capacity and hosting-plan limits before enabling the supplied once-per-minute cron. Each Edge call claims one job to remain inside the lease; increase invocation concurrency/frequency according to measured backlog, not by claiming a batch that cannot finish before lease expiry. Alert on oldest pending age, failed attempts and dead letters. Never acknowledge undelivered work manually.
5. Deploy the public client with only its project URL, anonymous/publishable key, verified site/media origins, contact details and internal cache secret. Rebuild when public build-time settings change. Never copy the admin `.env.local` or service-role/R2 credentials into this deployment.
6. Deploy `catalog-document` as an intentionally public GET/HEAD function with JWT gateway verification disabled; its handler authorizes every read against the anonymous published document view. Its service key remains in the Edge runtime. Verify published/private/retired/withdrawn cases and PDF attachment headers against real Storage. Only then set `CATALOG_PUBLIC_DOCUMENT_DOWNLOADS=true` on the public server; otherwise public references retain contact links.
7. Perform a real browser create → variants/specs/prices → image/PDF → publish → search/filter/detail → withdraw → cleanup workflow. Test direct anonymous REST/RPC access and the complete role matrix. Confirm no draft, private path or stale withdrawn page is returned. Monitor errors and outbox state.

Production execution requires explicit authorization after these gates pass. A successful local build does not authorize deploying it.

## Rollback and incidents

Prefer a forward corrective migration and compatible application rollback. Preserve new columns/functions/rows and all original migration/audit history. The old public listing RPC remains compatible, but do not restore an older admin release that contains destructive document deletion, unaudited partial duplication or price timestamp truncation.

On error, stop the rollout and preserve the migration ledger, audit/outbox evidence and file inventory. Investigate failed locks/indexes and data-quality findings before retrying. Restore a verified backup into a separate target and validate it before changing traffic. Never run the test bootstrap, `db reset`, schema drops, broad asset deletion or credential rotation against an existing remote project as a rollback shortcut.

Migration 010 validates finite NUMERIC values under a five-second lock and 120-second statement budget. Rehearse its scans on the restored dataset. A named `finite_<column>` failure identifies an existing NaN/infinite value requiring explicit operator correction and review; the transaction rolls back without coercing or deleting data. Do not skip validation to force rollout.

## Repeat the local evidence

The retained Windows rehearsal cluster is `.local-db-refinement`, bound to loopback port 55439. It was stopped after verification. Start that specific cluster with PostgreSQL 17 `pg_ctl -D .local-db-refinement -l .local-db-refinement.log -o "-h 127.0.0.1 -p 55439" start` before using the saved local-only connection files. These ignored files are test state, not deployment configuration.

In PowerShell, set `$env:TEST_DATABASE_URL=(Get-Content .local-db-refinement/verified-connection.txt).Trim()`, then run `pnpm test` and `pnpm refinement:browser`. The latter builds a synthetic-config client and stops its own loopback servers; rebuild the client with the intended environment before any deployment. `PLAYWRIGHT_CHROMIUM_PATH` can select an installed Chromium executable. Reserved Windows ports can be overridden with `ANN_E2E_SUPABASE_PORT` and `ANN_E2E_R2_PORT` for the admin suite.

`pnpm refinement:verify` creates new retained databases on the selected **local** PostgreSQL instance; it never resets an existing database. CI supplies its own disposable PostgreSQL service and runs the clean replay, tests and browser workflows. Its actual Supabase job is still needed for pgTAP and platform acceptance.
