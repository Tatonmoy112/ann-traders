# Cache and invalidation contract

| Resource                                      | Scope                                                 | Freshness and failure behavior                                                                                                |
| --------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Private admin HTML/Auth/APIs                  | Private, no-store                                     | Authorization on each request                                                                                                 |
| Admin product/relationship/dictionary queries | Browser session, existing short QueryClient freshness | Mutation invalidation and explicit errors                                                                                     |
| Public SQL views and listing RPC              | Database read                                         | Published, undeleted products in active categories; active variants/current prices only                                       |
| Public cards/detail/navigation data           | Next server data cache                                | 30-second rotating key, tagged public-catalog-v2; cached errors are not returned as empty success                             |
| Public publication visibility                 | Uncached Supabase read for every card/detail response | Withdrawal/category deactivation hides products even with a warm cache; upstream failure returns an error, not stale products |
| Public HTML and API envelopes                 | Request-rendered HTML; APIs private, no-store         | Do not add CDN HTML/API caching around the visibility gate                                                                    |
| R2 images                                     | Immutable public object keys                          | Development no-store; production custom-domain year-long cache, retirement/reference-aware cleanup and purge                  |
| Admin private document links                  | Authorized Storage links                              | Existing admin signing/expiry remains unchanged                                                                               |
| Public document references                    | Uncached published metadata                           | No private paths, signing or automatic download links                                                                         |

The public MVP deliberately keeps request-time rendering with `connection()` and Next's `unstable_cache` data API instead of enabling shared cached HTML. Cache keys include a 30-second wall-clock bucket because a revalidate interval alone permits stale-while-revalidate and stale-on-error beyond a nominal TTL. The anonymous transport always uses no-store. The cache handler must evict expired entries; self-hosted replicas need their own purge calls or a shared supported cache handler.

Normal edits/new publications appear within the next 30-second bucket. Expired prices are removed again before rendering cached results. Current prices newly activated during a bucket can remain on-request until the next bucket. Withdrawals are filtered against a fresh anonymous visibility read before serving cards or detail; already open pages, prefetched browser copies and downloaded images cannot be recalled. The publication check and a later transaction are not a single atomic operation; test realistic withdrawal timing in staging. List pages may temporarily contain fewer cards after a withdrawal, with conservative next-page navigation until refresh.

## Manual emergency purge

Configure an independent high-entropy `INTERNAL_CATALOG_REVALIDATE_SECRET` on the client deployment. POST to `/api/catalog/revalidate` with `Authorization: Bearer <secret>`. The handler checks the secret in constant time and calls `revalidateTag('public-catalog-v2', {expire:0})`; it performs no database writes. It accepts no caller-chosen tags, URLs or SQL. Missing/short configuration fails closed. Use HTTPS in deployed environments.

PowerShell operator example (secret already supplied through the environment):

```powershell
Invoke-RestMethod -Method Post -Uri 'https://catalog.example.com/api/catalog/revalidate' -Headers @{
  Authorization = 'Bearer ' + $env:INTERNAL_CATALOG_REVALIDATE_SECRET
}
```

Do not configure this manual endpoint as `CATALOG_INVALIDATE_URL`: it is not the signed event receiver.

## Event-based production acceptance

The existing transactional lifecycle/outbox and Edge worker remain intact. The worker signs the exact UTF-8 JSON body with HMAC SHA-256, sends the event UUID in Idempotency-Key, and includes timestamp/product revision. A future receiver must validate signature, allowed event types, clock window, durable event UUID replay state and monotonic revisions. That state must live outside the read-only catalog database client. Ordinary edits may use revalidateTag with the max profile; withdrawals must expire immediately and retain live visibility checks.

The remediation brief permits this TTL/manual-purge MVP. Durable signed delivery is intentionally not claimed as implemented. Unconfigured receiver jobs retry and eventually dead-letter under the existing eight-attempt policy. Operators must monitor and replay them when the verified receiver is enabled; do not discard or acknowledge undelivered events merely because TTL reads work.
