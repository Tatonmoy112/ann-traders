# Security audit

Assessment date: 2026-11-01. Source review and local adversarial checks do not establish hosted access-control correctness.

## Repaired findings

| Severity | Finding                                                                                                             | Repair/evidence                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| High     | Destructive document deletion bypassed publication/revision checks and removed storage before validating references | Authenticated transaction retires metadata, preserves source/history, enforces draft/revision and evidence links                  |
| High     | Duplicate workflow used privileged independent writes with ignored failures                                         | Role-checked atomic SQL duplication; original identity/audit retained; partial failure rolls back                                 |
| High     | Nullable direct-RPC revision comparisons                                                                            | Explicit payload shape and null-safe comparisons; real two-session stale-write test                                               |
| High     | Multipart CSRF accepted hostname substrings and unrelated preview domains; master uploads lacked origin checks      | Exact configured origin and browser-context check shared by mutations                                                             |
| High     | Master SVG uploads passed active content through, and multipart parsing allocated before bounds                     | Raster-only bounded stream, decoder limits and WebP output; no SVG optimization permission                                        |
| High     | Admin worker marked catalog effects complete without delivery                                                       | One authoritative Edge consumer, signed receiver and retry on failure                                                             |
| Medium   | Technical values could use mismatched units/unmapped rules or duplicate axes                                        | Database guards and publication diagnostics; matching editor and anonymous-filter tests                                           |
| Medium   | Previously published tier history could be replaced                                                                 | Frozen tier comparison and retained rows after withdrawal                                                                         |
| Medium   | PostgreSQL NaN passes ordinary positive numeric checks                                                              | Fourteen validated finite-number constraints; direct RPC/table rejection tests for MOQ, prices, specs, packaging and unit factors |
| Medium   | Legacy inquiry RLS checked activity without elevated-role MFA                                                       | Shared database role/AAL2 evaluation; anonymous grants remain absent                                                              |

## Preserved boundaries

Recheck finding: two sessions could previously commit a published product with a concurrently deactivated definition. Migration 011 closes this integrity race by locking referenced choices/definitions before the final validation. It also protects mapped optional definitions without values. All four definition/choice race orderings now pass against real PostgreSQL sessions. The recorded before/after proof is in [dictionary-race-check.json](dictionary-race-check.json).

- Anonymous reads use approved public projections and explicit function grants. New definer functions qualify object names and have empty search paths; mutable RPCs recheck active roles and product state/revision.
- MFA remains required for admin/super-admin in application and database. Service-role use is confined to invitation/provider/private-file operations, never ordinary duplication or the customer deployment.
- Customer Supabase transport rejects every non-GET/HEAD request, uses no session, rejects secret/service JWT keys and disallows redirects. Cache-event POSTs only expire local cache; they write no business/database records.
- Cards and detail pages consult uncached publication visibility. Missing/failed visibility fails closed. Detail cache keys include published revision. Expired cached prices are suppressed at presentation.
- HMAC events bind the exact body, event ID, product ID, operation, positive revision and timestamp within five minutes. Repeated expiration is idempotent and requires no customer persistence. The existing bearer-only manual purge remains separately bounded.
- R2 signatures, byte verification, immutable outputs, ownership, leases, reference-aware cleanup and audit are retained. Private PDF paths and signed administrator downloads never appear in public projections.
- Original private inquiries remain preserved; the public site provides external contact navigation only.

## Remaining production gates

1. Run actual Supabase/PostgREST role/JWT/Storage tests in the approved target. The local platform objects are substitutes; no hosted policy or migration-ledger match is claimed.
2. Verify Auth signup settings, real AAL1/AAL2 enrollment/recovery, invitation/reset email, disabled/revoked sessions and exact allowed origins over HTTPS.
3. Verify real R2 token scope, conditional PUT/replay, private staging, CDN delivery/purge, worker retry/dead letters and cleanup after failure. Current browser media evidence uses a protocol double.
4. Configure distributed host/WAF rate limits for public reads, direct Supabase APIs, Edge document downloads, login/MFA and cache events. Existing process-local burst limits are not distributed protection.
5. Decide whether trusted administrator PDF uploads require malware scanning. Signature checks are not malware scanning; document download must stay disabled until the chosen policy and actual Storage behavior pass staging.
6. Configure platform error monitoring, alert routing, outbox age/dead-letter alerts and restore drills. Do not treat an unused optional Sentry environment variable as installed instrumentation.
7. Admin CSP still allows inline scripts/styles for the existing UI. Public production pages retain nonce/strict-dynamic CSP. Tightening the admin CSP requires a separately tested nonce rollout; existing React text rendering is preserved and no raw HTML execution was added.

The executed production dependency advisory result is saved in [dependency-audit.json](dependency-audit.json). It reports zero known advisories in 179 production dependencies at the time queried; this is not a guarantee against undisclosed vulnerabilities.
