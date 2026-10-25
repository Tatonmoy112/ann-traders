# Cache and invalidation contract

| Resource | Owner / key | TTL / scope | Invalidation | Failure recovery / stale limit |
|---|---|---|---|---|
| Private HTML, Auth and APIs | Admin deployment / session | no-store, private | Each request | No shared cache |
| Product and relationship queries | Browser QueryClient / product ID, revision, filters | 10 seconds, current browser session | Mutation success invalidates product, list, review and relation keys | Refetch on focus; page reload after logout/login resets cache |
| Dictionary lookups | Browser / table | 10 seconds | Master mutation | Refetch and explicit failure state |
| Public SQL views | PostgreSQL | No application cache | Committed product state | Fresh at query time |
| Future public pages | Future catalog deployment | Not implemented; propose 60-second maximum public TTL | Signed outbox event and tag invalidation | Do not enable cache until receiver/replay store is implemented |
| Image assets | R2 / canonical immutable object key | Development r2.dev: no-store; production custom domain: 31536000 seconds; staging always private | Retirement queues reference-aware deletion; explicit development mode skips CDN API, production requires exact-file purge | Retry/dead letters; browser/downloaded copies remain outside revocation control; see R2 lifecycle |
| Private document links | Storage / generated object key | Signed for 60 seconds | New authorization check per download | Existing signed URL may work up to 60 seconds after revocation |

Worker signs the exact UTF-8 JSON body with HMAC SHA-256 in `X-Catalog-Signature`, sends event UUID in `Idempotency-Key`, and includes a Unix timestamp and product revision. Future receiver must verify constant-time signature, ±300-second clock window, event UUID replay store, allowed event type and monotonic revision. Use `revalidateTag(tag, 'max')` for ordinary edits; withdrawal must bypass or synchronously expire shared cached content. Never acknowledge a withdrawal before its visibility rule is effective.

PostgreSQL outbox and lifecycle commit atomically. Event UUID is stable across retries. At-least-once side effects require receiver idempotency. Events without a configured receiver fail and become dead letters after eight attempts. Operator must inspect and replay them when the future deployment is ready. No public app exists yet, so cross-deployment delivery is contract-tested only, not live-verified.
