# ANN Traders hosted staging release

This is a prepared, locally rehearsed baseline package. **No hosted SQL, deployment or infrastructure change has been executed.** Remote application requires the user's explicit approval, a confirmed staging project, a working connection and a backup. The previously supplied database hostname failed DNS resolution. Do not paste database passwords or tokens into chat or committed files.

Current connection diagnosis: the direct endpoint resolves only through IPv6, and this machine's IPv6 TCP attempt returned `ENETUNREACH`. In Supabase Dashboard → Connect, copy the real **Session pooler** connection string (port 5432) into `DATABASE_URL` in `apps/admin/.env.local`. Its username includes the project reference; copy the exact dashboard host rather than guessing a region/cluster. `SUPABASE_DB_PASSWORD` can supply the `[YOUR-PASSWORD]` placeholder in the URL. Keep secrets in the local file. Session mode is the documented IPv4 alternative: [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

Run `pnpm.cmd staging:preflight` after updating the connection. It checks the database/API project match, enforces certificate validation and a read-only session, and executes only the generated preflight. It cannot apply migrations or repair history. `STAGING_DATABASE_URL` / `STAGING_SUPABASE_URL` are optional explicit overrides when the app still points locally. The sanitized result is in [hosted preflight evidence](../../docs/verification/hosted-preflight-results.json).

## Reviewable artifacts

| File | Purpose |
| --- | --- |
| [generated/preflight.sql](generated/preflight.sql) | Read-only assertions suitable for the hosted SQL Editor before approval |
| [generated/baseline.sql](generated/baseline.sql) | Atomic SQL Editor fallback for the 001–014 baseline |
| [generated/verify.sql](generated/verify.sql) | Read-only schema, RLS, RPC, legacy-path and private-PDF checks |
| [generated/manifest.json](generated/manifest.json) | Ordered original filenames, versions, source hashes and bundle hash |

Original migration files remain authoritative and unchanged. Build/rehearse with:

```powershell
pnpm.cmd staging:prepare
pnpm.cmd staging:verify:local
```

Packaging opens no database connection. Rehearsal requires the local Supabase ports 54321/54322 and ignored `.local-r2/supabase-status.json`. It reads the current local application's schema and creates separate test databases; it never resets or drops an existing database. Auth/Storage platform substitutes are used only inside those new isolated databases. The postflight also passes against the actual local Supabase stack. Results: [verification evidence](../../docs/verification/staging-release-results.json).

## Preflight before any application

Confirm the intended project in the Supabase dashboard, and run the **whole** `generated/preflight.sql` in its SQL Editor. It uses a read-only transaction. A successful preflight makes no schema, migration-history, account or data changes. Share only success/error metadata, not connection settings.

The baseline requires empty dedicated `public`, `private` and `public_catalog` application namespaces, no prior application migration records and no existing `catalog-documents` bucket. It blocks unrelated public tables too: migration 003 changes grants/RLS across public tables. Missing migration history alone is not permission to overwrite an existing schema. If preflight rejects, stop and plan incremental migrations; do not drop objects or remove the guard. An aborted editor transaction can be closed with `ROLLBACK`.

## Preferred deployment after approval

Use the existing original `supabase/migrations` files with the official Supabase CLI. Confirm the linked staging project and migration list, review `db push --dry-run`, then apply only the reviewed migrations with `db push`. Do not use `db reset`, `--include-seed`, global auth configuration push or deployment commands as part of this database release. Use secure local credentials/settings, not credentials pasted into shell history.

The CLI records successful migrations in `supabase_migrations.schema_migrations`; subsequent pushes use that history. This is why the original files are the preferred deployment path. [Official CLI reference](https://supabase.com/docs/reference/cli/introduction), [migration history guidance](https://supabase.com/docs/guides/deployment/database-migrations).

## SQL Editor fallback after approval

If CLI connectivity cannot be established and an approved operator uses SQL Editor instead, run the complete `generated/baseline.sql` in one execution. It includes the same preflight, all fourteen migration bodies, postflight assertions and a PostgREST schema-reload notification in **one transaction**. Any failure rolls the complete release back. A five-second lock timeout and two-minute statement timeout bound waits. Reapplication is intentionally rejected.

The generator removes only each file's outer BEGIN/COMMIT wrappers and makes migration 001's search_path setting transaction-local. It preserves the original SQL behavior inside the outer transaction. Source hashes are included beside each migration. No seed data, administrator account, external storage object, Auth settings or worker deployment is included. It inserts the private PDF bucket's metadata as the original migration requires.

**The SQL Editor bundle does not record Supabase CLI migration history.** After successful application, run `generated/verify.sql`, compare the deployed schema to the reviewed manifest, and explicitly repair the matching fourteen versions as applied using `supabase migration repair --status applied <versions>` once an approved CLI connection is available. Do not run `db push` before this reconciliation, and do not mark a failed/unverified bundle as applied. Repair updates history only; it does not apply SQL. The manifest lists the exact versions. Do not invent a migration ledger by hand. [Official migration repair guidance](https://supabase.com/docs/guides/deployment/database-migrations).

## Postflight and next release steps

Run the whole `generated/verify.sql`, confirm all fourteen ledger versions when using the CLI path, and refresh the existing GET-only hosted schema audit. The checks require all 28 tables with RLS; six R2 service-only RPCs; no legacy Images upload grant; canonical public image keys; anonymous public projections with normalized products private; and private PDF bucket limits.

Database success does not create an invited administrator, configure Auth redirect URLs/MFA, set hosted worker secrets, deploy/schedule the worker or grant permission to change R2. Those are separate concrete staging steps after database approval. The current local r2.dev setup stays in development mode. Before production, configure a valid custom domain, production/cloudflare purge modes and production CORS, then perform hosted acceptance tests.
