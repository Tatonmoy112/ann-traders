# Public catalog remediation - 31 October 2026

Repository implementation of ANN_Traders_Architecture_Performance_Remediation.md. No hosted database, production deployment, R2 configuration or business data was changed.

## Implemented

- Public Supabase client requires a publishable/anonymous key and uses only public_catalog. Secret keys and privileged JWTs pasted into the public field are rejected. Service-role fallback/configuration is removed from the client.
- New migrations preserve owner-evaluated security-barrier views and remove anonymous raw dictionary/inquiry grants. The legacy inquiry FOR ALL policy is restricted to service_role instead of PUBLIC. Existing inquiry data is retained.
- Compact cards, conservative effective pricing, narrow dictionary/visibility views, one product detail projection with gallery/variants/prices/specifications/packaging/document references, and an invoker read-only bounded listing RPC.
- Server-rendered initial home/list/detail/documents content; small filter/variant/gallery controls. Exact slug filtering, deterministic ordering, validated pagination and category tree support.
- Real fixed/range/on-request labels with explicit currency/unit. Incompatible currencies/units/trade terms are never combined. Future/expired/inactive prices are excluded by SQL; cached price expiry is checked before output.
- Request-time HTML, short tagged data cache, uncached withdrawal visibility gates, generic failures and authenticated manual purge. No shared HTML/API cache or distributed replay-state claim.
- Public inquiry persistence and forms removed; verified operator-configured email/WhatsApp contact links replace them. Private PDFs remain contact-request references; the client cannot sign Storage URLs.
- Responsive Next images with fixed display slots, sizes, lazy cards/thumbnails, main detail image preload and broken-image fallback. Existing 320/768/2000 WebP generation is preserved. Production delivery configuration rejects r2.dev unless explicit development mode is selected.
- Unsupported years/client counts/certifications/discount/dispatch claims and placeholder contact information removed. CSS resets moved into the base layer so utility button styles remain visible.
- READMEs, architecture/security/cache contracts and generated schema types updated.

## Local evidence

The full migration chain was applied successfully to a newly created isolated PostgreSQL 17 cluster/database using the repository's test-only platform bootstrap. It was not applied to Supabase.

- 104 Vitest tests pass, including 57 real PostgreSQL tests, anonymous grants/RLS, draft/withdrawal visibility, effective pricing and public key handling.
- Client lint passes. Workspace typecheck and production builds for both admin and client pass. Workspace lint remains blocked by pre-existing admin findings: two react-hooks/set-state-in-effect errors in inquiries-manager.tsx:106 and products.tsx:49, plus 25 warnings. Those admin components were not changed by this remediation.
- [Production HTTP checks](public-catalog-runtime.json): 21 checks using next start, real anonymous PostgreSQL views and a minimal local PostgREST transport double. Confirm initial product HTML, lean cards, malformed pagination, unknown filters, removed RFQ POST, purge authorization, warm-cache withdrawal filtering and fail-closed visibility errors.
- [Chromium checks](public-catalog-browser.json): search, variant prices/specifications, mobile contact navigation, no browser product-query waterfall, no horizontal mobile overflow. Synthetic CDN image failures were intercepted; this does not verify live R2 delivery. Screenshots are in ignored test-results.
- The HTML detail route can stream a 200 response before notFound is resolved; the withdrawn product content is absent and noindex is emitted. The JSON detail API returns 404. Browser/preload copies are outside server revocation control.

## SQL benchmark

Five warm single-client samples per query, local loopback PostgreSQL, no concurrent load. Synthetic **published** products each have two variants/prices/specifications/packaging records, four quantity tiers, three media rows with three-size manifests, and a public document reference. Seed generation changes planner settings only while inserting fixtures; measured reads use defaults. SQL times exclude Supabase HTTP, internet, server rendering and browser costs.

| Published products | Initial unbounded card query p50 ms | Final bounded cards p50 ms | Final filtered cards p50 ms | Final detail p50 ms |
| -----------------: | ----------------------------------: | -------------------------: | --------------------------: | ------------------: |
|                 50 |                                5.40 |                       4.92 |                        3.68 |                3.52 |
|                500 |                               14.42 |                       2.89 |                        3.02 |                3.75 |
|              5,000 |                              238.41 |                       7.34 |                        6.96 |                5.97 |
|             20,000 |                              727.07 |                      17.70 |                       21.46 |               13.03 |

The initial EXPLAIN ANALYZE showed media/pricing aggregates running 20,000 times before the outer LIMIT. The bounded RPC first selects pageSize+1 identities from a narrow view, then computes only those card projections. No speculative indexes were added. The baseline is the first implementation during this remediation, not the original browser API or a before/after production performance comparison.

Raw [initial plans/timings](public-catalog-unbounded-baseline.json) and [final plans/timings](public-catalog-performance.json) are inspectable. With five samples the report records median and maximum, not a reliable p95. No Lighthouse score, LCP/INP/CLS improvement or production latency is claimed.

## Reproduce

Use a **new isolated local** PostgreSQL database. Apply scripts/local-postgres-bootstrap.sql and the complete ordered migration chain. Never run that bootstrap on Supabase or an existing business database.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/isolated_test'
corepack pnpm test
node scripts/benchmark-public-catalog.mjs
```

For HTTP/browser checks, use a separate isolated database with the same migrations. Start tests/fixtures/public-catalog-server.mjs with its TEST_DATABASE_URL; it creates 18 synthetic products inside a transaction and rolls them back on shutdown. It binds loopback port 55440. Start the **production-built** client with the following test-only environment:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:55440'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-public-key'
$env:INTERNAL_CATALOG_REVALIDATE_SECRET = 'local-public-catalog-purge-test-secret-000000'
corepack pnpm --filter @ann/client start
# In another terminal:
node scripts/verify-public-catalog.mjs
# Install the matching Playwright Chromium or set PLAYWRIGHT_CHROMIUM_PATH.
node scripts/verify-public-catalog-browser.mjs
```

Use these public test values at build time too if that build already has public configuration inlined. The fixture's test-control endpoints are confined to the local test server, never the application. Runtime checks withdraw a fixture product and toggle fixture availability; they never mutate a hosted database. These fixture scripts are manual local acceptance tools; hosted CI/browser execution is not claimed.

## Operator rollout and remaining acceptance

1. Back up and inspect the intended hosted project's migration history, view owners, grants, RLS and PostgREST exposed schemas. Review and apply only migrations 20261031000100 and 20261031000200 after their prerequisites; do not reset or change view owners. Verify anon has no normalized table/inquiry/profile/audit access and cannot write any public projection.
2. Deploy apps/client separately with publishable key, canonical origin, verified contacts and production R2 custom-domain settings. Remove any old service-role/privileged credentials from that deployment. Rebuild for image/CSP/public environment changes. Keep the admin credentials and media worker outside the public app.
3. Verify real R2 CDN/CORS, immutable cache headers, generated image sizes/bytes, fallbacks and detail LCP media on slow mobile connections. Private PDFs remain on request until a separately reviewed public delivery workflow is approved.
4. Test cold/hot request-time caching, visibility failures, withdrawal under concurrent traffic, manual emergency purge and each self-hosted replica/CDN configuration. Confirm no shared HTML/API caching is added around publication checks.
5. The brief's MVP TTL/manual purge is implemented. Signed event delivery with durable replay/revision handling remains a **production acceptance gap**; monitor existing outbox retries/dead letters meanwhile.
6. Run real Supabase/PostgREST relationship/query benchmarks, Lighthouse/DevTools/WebPageTest on representative Bangladesh mobile connections, and field p75 LCP/INP/CLS when traffic exists. No production URL/credentials/trace was provided here.
7. Have the business owner verify contact details and any future marketing/certification/delivery claims. The app now uses neutral copy rather than invented claims.
