# Full change recheck

Rechecked: **1 November 2026, Asia/Dhaka**. Result: the executed local and configured-site checks pass after one additional integrity repair. **Production approval remains withheld.**

## Additional issue found and repaired

Two real PostgreSQL sessions reproduced a race: deactivating a specification could commit concurrently with publication, leaving a published product with an inactive definition. The before-fix state is retained in [dictionary-race-check.json](dictionary-race-check.json).

Additive migration `20261101001100_publication_dictionary_serialization.sql` serializes the final publication check with definition/choice edits. Optional mapped definitions without stored values are also protected from incompatible semantic changes. Label corrections remain allowed. Four real-session checks verify both operation orders for definitions and choices; three new automated regressions cover optional mappings and label edits. No original migration or production data was changed.

## Freshly executed checks

| Check                               | Result                                   | Scope and evidence                                                                                                                                                                                                                         |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full automated suite                | **204 passed; 0 skipped**, 14 files      | Includes 95 real PostgreSQL integration cases; [test-results.json](test-results.json)                                                                                                                                                      |
| Clean migration replay              | **29 passed**                            | 18 unchanged original files plus 11 additive files                                                                                                                                                                                         |
| Populated upgrade and concurrency   | **9 checks passed**                      | Original values/IDs/history preserved; competing sessions reject stale writes, overlaps and dictionary races; [upgrade-and-concurrency.json](upgrade-and-concurrency.json)                                                                 |
| Lint and strict type checks         | **Passed**, cache bypassed               | Both applications and their imported workspace packages                                                                                                                                                                                    |
| Production builds                   | **Both passed**                          | Admin standalone build and isolated client production build; user dev server preserved                                                                                                                                                     |
| Edge function type checks           | **Both passed**                          | Catalog worker and document delivery; no deployment performed                                                                                                                                                                              |
| Admin/R2 browser scenarios          | **6 passed**, 0 failed/skipped/flaky     | Auth/PostgREST/R2 doubles; real Chromium and image decoding; [admin-browser-results.json](admin-browser-results.json)                                                                                                                      |
| Public production-browser scenarios | **10 passed**                            | Final 29-migration local database through an explicit HTTP transport double; [browser-results.json](browser-results.json)                                                                                                                  |
| Configured running website          | **9 checks passed**, 0 runtime errors    | Actual published API, homepage, product-code search, category filter, loaded R2 files, details/canonical metadata, documents, demo contacts and mobile navigation; [configured-client-checks.json](configured-client-checks.json)          |
| Hosted anonymous access boundaries  | **Observed expected denials**            | Raw product, administrator, audit and private document tables denied access; published listing succeeds; [hosted-anonymous-recheck.json](hosted-anonymous-recheck.json)                                                                    |
| Production advisory audit           | **0 known advisories**, 179 dependencies | Fresh registry audit; [dependency-audit.json](dependency-audit.json)                                                                                                                                                                       |
| Types and release artifacts         | **Regenerated/validated**                | Types introspected from applied local schema and app compilation rerun; all 29 migration artifact hashes checked; [type-contract-recheck.json](type-contract-recheck.json), [release-artifact-recheck.json](release-artifact-recheck.json) |
| Source hygiene                      | **Passed**                               | `git diff --check`; all eight new JavaScript scripts parse                                                                                                                                                                                 |

The configured-site script is repeatable with `node scripts/verify-configured-client.mjs` while the local website is running. Set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium is not installed at Playwright's default location. It uses GET requests and never starts/stops the user's server.

## Fresh performance samples

Final-schema local SQL measurements, 15 warm samples per query on this workstation:

| Products | Cards P95 | Technical filter P95 | Exact search P95 | Detail P95 |
| -------- | --------- | -------------------- | ---------------- | ---------- |
| 500      | 5.53 ms   | 7.71 ms              | 6.05 ms          | 7.27 ms    |
| 5,000    | 6.66 ms   | 6.80 ms              | 16.94 ms         | 6.00 ms    |

[performance-recheck.json](performance-recheck.json) contains actual plans and payload measurements. These are SQL timings, excluding network/rendering/cold cache and production concurrency. Earlier 20K/50K measurements remain available in `performance.json`; those larger volumes were not rerun during this recheck and predate the detail-view and publication-lock changes. No hosted SLA is declared passed.

## Remaining limitations and release gates

1. **Hosted database still uses the older catalog contract.** Basic published browsing works through the compatible original RPC. Advanced technical facets, cursor/SKU/model search and new authoring workflows require the reviewed additive migrations in an approved environment. The hosted migration ledger and complete role matrix remain unverified. No remote migrations were applied.
2. **One image source remains broken.** Two existing R2 uploads return HTTP 200 and render inside bounded desktop/mobile frames. The third synthetic Cloudflare Images URL returns HTTP 403 and needs a valid uploaded asset. The working files are the existing demo uploads; product-photograph/content approval was not performed.
3. **Contacts remain demo information**, explicitly marked, without active messaging links. Replace with verified business contacts before release.
4. Docker's Linux engine pipe is unavailable on this machine. Actual Supabase/pgTAP execution, official Supabase type generation and Linux container/deployment artifact verification remain blocked. The PostgreSQL Auth/Storage substitutes and provider doubles do not establish managed-platform behavior.
5. Real Auth/MFA/recovery/email, private Storage delivery, R2/CDN purge and worker scheduling/retry/cleanup, distributed rate limits, monitoring and backup restoration still require approved staging acceptance. The referenced attribute matrix is still absent from the supplied pack.

The user website was left running on port 3001. Owned browser fixture servers were stopped by their runners. The isolated PostgreSQL cluster is stopped after final cleanup; all rehearsal databases and evidence are retained. No production deployment, remote data mutation or credential rotation occurred.
