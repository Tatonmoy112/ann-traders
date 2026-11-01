# Testing and performance report

Results are collected locally on 2026-11-01. This report is updated during final verification. Machine-readable files distinguish actual execution from historical repository claims.

The subsequent [full recheck](recheck-report.md) reran the checks, found and repaired a specification/publication race, and verified the final 29-migration schema. Current totals are 204 tests, six admin provider-double scenarios, ten production public scenarios, and nine configured-site read-only browser checks. [Fresh performance samples](performance-recheck.json) cover 500 and 5,000 products on that schema; the 20K/50K measurements below remain earlier execution evidence and were not rerun in this recheck.

## Executed evidence

- Pinned dependency installation completed without changing dependency versions or lockfile requirements.
- Baseline: 143 tests passed against an isolated PostgreSQL 17 cluster; existing admin lint failed and was repaired.
- Expanded database/security/contracts suite is executed with `TEST_DATABASE_URL`; tests are not counted as passed when skipped.
- Both Next applications have completed production compilation, TypeScript and route generation. Final lint/type/build results are recorded at the end of the implementation.
- [Upgrade and concurrency](upgrade-and-concurrency.json): original table values/IDs/prices/media/PDF/audit preservation, actual competing admin connections, overlapping prices and publication/category-rule serialization, plus a clean migration replay.
- [Public browser results](browser-results.json): production server rendering, cursor navigation, technical filters, SKU/unknown-filter/API security, variant prices/specs, cached withdrawal, signed events, outage behavior and 390px layout/contact checks. Its PostgREST transport is a local double backed by real anonymous PostgreSQL queries; CDN image failures are synthetic.
- Admin/R2 browser evidence uses local Auth/PostgREST/S3 doubles, real browser PUT/signing and Sharp decoding. It does not establish real provider permission/CORS behavior.
- Both Edge entrypoints passed pinned Deno type checking without being executed or deployed.
- Production advisory audit executed: zero reported advisories, 179 dependencies. See the saved JSON.

## Performance method

`pnpm refinement:benchmark` defaults to 500, 5,000, 20,000 and 50,000 parent products. Its synthetic mixed catalog includes 12 categories covering physical/software/services, two variants/specifications/prices per parent, four tiers, three media records, packaging and one document. It is workload data, not ANN Traders content, market prices or an approved taxonomy. All fixtures roll back. Run benchmarks in a **separate isolated database** from tests/browser fixtures: category advisory locks are intentionally transaction-wide.

Queries cover public cards, selective descendant category, brand, numeric technical filter, exact SKU search, detail, facet metadata and authenticated admin listing. Fifteen warm single-client SQL samples produce p50/p95/p99 and JSON response bytes. Function-level EXPLAIN includes buffers; the actual dynamically bound inner card SQL is also explained because a PL/pgSQL wrapper otherwise hides its internal plan. These are loopback database timings, excluding HTTP/TLS/rendering, cold cache, replicas, concurrency and production hardware. No unapproved SLA is declared passed.

## Measured optimization

At 5,000 products, the paired same-fixture experiment measured technical filtering P95 **159.19 ms → 6.56 ms**. Its inner plan measured **102.099 ms → 2.351 ms**, using the candidate partial `(name,id)` index to stop after the bounded page. The index was created/rolled back inside the experiment; migration 008 contains the justified production shape. [Before/after plans](performance-index-comparison.json) include the executed index name and buffers. Existing status/updated/FK/GIN indexes are retained; no speculative index matrix was applied.

Empty-search ranking was also simplified to a constant so the existing updated-time index can serve ordinary browsing. Bulk fixture publication now analyzes its populated tables before integrity checks; stale empty-table statistics previously made fixture generation unnecessarily slow. The repaired fixture statistics are not a production query-performance claim.

All four volumes completed. The [scale report](performance.json) contains measurements, payloads, plans and hardware through migration 008:

| Products | Cards P95 | Technical filter P95 | Exact SKU P95 | Detail P95 |
| -------- | --------- | -------------------- | ------------- | ---------- |
| 500      | 4.81 ms   | 5.46 ms              | 4.46 ms       | 5.78 ms    |
| 5,000    | 5.11 ms   | 6.07 ms              | 16.30 ms      | 9.24 ms    |
| 20,000   | 6.30 ms   | 5.05 ms              | 44.93 ms      | 15.39 ms   |
| 50,000   | 4.33 ms   | 5.33 ms              | 133.39 ms     | 133.01 ms  |

The 50K detail plan exposed a redundant catalog-wide visibility join. Migration 009 keeps the identical predicate inline and uses the existing unique slug index. A paired 5K follow-up measured P95 **34.79 ms → 5.88 ms**, and its after-plan no longer scans all products. See [detail comparison](detail-plan-comparison.json). The four-volume scale report predates that final projection repair; its 50K detail timing is not presented as a remeasurement of migration 009. A full hosted scale run remains a release gate.

The final executed local suite has **204 passing tests in 14 files, zero skipped**. The admin/R2 Playwright report has **6 expected passes, zero failures/skips/flaky results**. The public production-browser report has **10 passing workflow checks**. Both apps pass lint and strict type checking and have successful production builds; both Edge entrypoints pass Deno checking. Fresh replay covers **29 migrations** (18 original plus 11 additive). See the accompanying JSON for individual outcomes.

The final public production-browser run used the fresh 29-migration schema and rejects hydration/runtime errors. Screenshots in `evidence/` were captured after rendered content was visible and visually inspected. Final command outcomes are summarized in [local-checks.json](local-checks.json).

Windows Turbo emitted a long-link-name warning while caching the admin standalone output, after both Next builds succeeded with exit code zero. Linux container/release artifact verification is still required; the local build is not evidence that a portable deployment image was built.

## Blocked or excluded checks

### Follow-up: configured development website

The reported 500 was reproduced as an application-local environment/configuration gap. The ignored `apps/client/.env.local` now contains only existing public project/delivery settings and requested preview contacts. Anonymous hosted GET checks confirmed that the original published listing API exists while advanced discovery is not installed. The client now uses the original published-only RPC for basic browsing when, and only when, the new RPC is absent (`PGRST202`). It does not bypass permission errors, read raw tables, silently drop technical filters, or apply remote migrations. Ten new compatibility regressions bring the executed suite to 204 tests.

The running user dev site was verified separately: homepage/company content, three published cards, a published detail and 390px layout all passed without browser runtime errors. See [configured client checks](configured-client-checks.json). The homepage also streams company information and handles catalog outages without displaying stale cards; that scenario is included in the ten-check production fixture run.

Two approved R2 image files returned HTTP 200 but their delivery origin was unconfigured. Configuring that exact local development origin restored them. A third synthetic Cloudflare Images URL returns HTTP 403 and retains the safe unavailable fallback. Actual loaded images also exposed an intrinsic-size overflow hidden by unavailable-image fixture tests: cards stretched to 581–802px instead of the intended 4:3 box. Positioned Next Image fill now keeps 4:3 desktop/mobile cards and bounded gallery thumbnails. See [media/contact browser checks](client-media-contact-checks.json) and screenshots in `evidence/`.

Requested demo contact details are explicitly labeled and never activate email/WhatsApp messaging links. Real business contacts still require verification. Anonymous hosted reads do not satisfy the outstanding Auth/MFA, ledger, private Storage, worker or backup gates below.

- Docker Desktop's Linux engine is unavailable. Actual Supabase startup, pgTAP execution, official CLI type generation and container release execution are blocked. The 19 pgTAP assertions were updated but must run in Supabase CI/staging.
- No approved hosted endpoint/session/credentials were configured for this refinement. Real Auth/MFA/invitation delivery, Storage downloads/policies, R2/CDN, Edge scheduling/invalidation and hosted migrations remain unverified.
- Managed backup restore/PITR and R2/PDF recovery drills, cold/concurrent hosted HTTP load and distributed WAF enforcement need staging/operator evidence.
- Windows reserves ports 54329/54330 on this machine. Browser tests use `ANN_E2E_SUPABASE_PORT=55441` and `ANN_E2E_R2_PORT=55442`; no host reservation was changed. Process-sandbox teardown limitations were isolated from application assertions and the complete browser report is retained separately.
