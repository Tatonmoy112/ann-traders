# ADR 0002 — Durable outbox first

The first implementation uses a bounded PostgreSQL outbox with `SKIP LOCKED`, leases, retry counters and dead letters. This is a deliberate deviation from the requested PGMQ transport: it can be tested on plain PostgreSQL and keeps the job ledger authoritative. It does not claim PGMQ/Cron provisioning is complete. Add PGMQ as transport only after Supabase runtime verification; do not add a second source of job truth.

The Edge consumer is supplied but has not been deployed or run against Supabase. Schedule it with an authenticated Cron HTTP call using Vault-managed secrets. Until scheduled, events remain durable and provider deletions are pending. Catalog invalidations fail visibly into retry/dead-letter storage until the future catalog receiver exists; they are not silently acknowledged.
