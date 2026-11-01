# Final production readiness report

**Release status: NOT APPROVED FOR PRODUCTION.** The repository has been materially refined and locally verified, but required managed-platform/integration/restore gates remain open. No production migration, deployment, data mutation or credential rotation occurred.

## Implemented

Eleven additive migrations retain the original normalized domain, identifiers, audit, price and media history. Refinements cover inherited typed specifications, unit families, variant axes, null-safe concurrency, immutable commercial history, atomic duplication, document retirement/visibility, SKU/model/part search, descendant/technical filters, cursor pagination, safe detailed technical data and a measured name index.

Admin changes connect these rules to MPN/features/order inputs, search-capable lookups and dictionaries, document title/visibility/SKU management and image/SKU assignment. Exact mutation origins, bounded decoded master uploads and authoritative worker invocation replace unsafe paths. The public app remains anonymous and read-only, with secure optional PDF delivery, immediate withdrawal gates and signed cache invalidation. Existing R2 verification/cleanup, roles and MFA remain in place. The ninth migration removes a measured redundant detail-query join while keeping publication predicates identical.

The tenth migration closes PostgreSQL's NaN positive-check bypass across numeric catalog fields. All 14 new constraints validated locally. It fails atomically for operator review if an existing installation contains invalid values. The public root layout's empty-media-configuration hydration failure and the admin preview's render-time clock were also repaired.

The recheck reproduced an additional dictionary/publication race in two real sessions. Migration 011 now locks choices/definitions during the final publication check and protects optional mapped semantics without stored values. Four additional competing-session checks pass, covering both operation orders for definitions and choices. The original 18 migrations are unchanged. See [before/after race evidence](dictionary-race-check.json) and the [recheck report](recheck-report.md).

## Evidence and limitations

Local evidence: **204 tests passed**, **6 admin/R2 browser scenarios passed**, **10 public production-browser checks passed**, both apps built, lint/types passed and both Edge entrypoints passed Deno checking. All **29 migrations** replayed cleanly; the populated upgrade preserved original values and real concurrent sessions passed. SQL benchmarks completed at 500/5K/20K/50K products; migration 009 has a separate paired detail-plan follow-up.

See [testing and performance](testing-and-performance.md), [upgrade/concurrency](upgrade-and-concurrency.json), [public browser evidence](browser-results.json), [security audit](security-audit.md), [schema inventory](schema-inventory.json) and [migration manifest](migration-manifest.json). Local tests use PostgreSQL 17 with explicit platform substitutes; browser providers are doubles. These counts are execution evidence, not an assertion that the production gates below have passed.

Follow-up verification also covered the actual configured dev website with anonymous hosted reads: homepage/company content, listing, detail and mobile navigation passed. Existing published-only API compatibility is retained while the advanced hosted RPC is absent. Two real R2 images render after configuring their delivery origin, and fixed image frames prevent tall uploads stretching cards. One synthetic source returns 403 and needs a valid uploaded asset. Requested demo contact information is clearly marked. See the configured-site and media/contact reports linked from testing evidence; no hosted mutations occurred.

## Required release gates

| Gate                                                                        | State                                                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Source/local database refinements                                           | Implemented; verify exact release evidence below                                         |
| Additive upgrade/data preservation and concurrent SQL checks                | Executed locally                                                                         |
| Lint/types/tests/build/browser/worker checks                                | Executed locally; inspect reports for final results                                      |
| Representative SQL performance                                              | Executed local volumes in `performance.json`; hosted targets not agreed/tested           |
| Installed hosted schema/ledger and direct REST/RPC grants                   | Basic anonymous reads/denials verified; advanced schema and ledger still require staging |
| Real login/MFA, email/reset/invitation and disabled-session checks          | Staging required                                                                         |
| Real private PDFs and optional public byte delivery                         | Staging required; download feature defaults off                                          |
| R2/CDN permissions, purge and lease/retry/cleanup failure acceptance        | Staging required                                                                         |
| Scheduler capacity, distributed rate limits and monitoring alerts           | Operator configuration and staging acceptance required                                   |
| Approved dictionary/content, tax/quotation rules and certification evidence | Business review required; supplied matrix is missing                                     |
| Database/file backup restoration and agreed RPO/RTO                         | Unexecuted operator gate                                                                 |
| Production migration/deployment                                             | Explicit authorization required after acceptance                                         |

The release procedure is in [deployment, backup and rollback](deployment-backup-rollback.md). Preserve the strengthened admin routes during rollback and use forward migrations; never reset a live project.
