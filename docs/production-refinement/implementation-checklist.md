# Production refinement checklist

Date: 2026-11-01 (Asia/Dhaka). Status: local implementation and verification completed; production release is not approved.

## Phase 1 — establish evidence

- [x] Locate the supplied refinement pack and inventory its seven files.
- [x] Read blueprint, implementation brief, ERD, README and SQL audit/index proposals.
- [x] Identify missing `reference/attribute_matrix.csv` (referenced, not supplied).
- [x] Inventory both apps, shared packages, migrations, tests and deployment files.
- [x] Finish source/schema/security review and document discrepancies.
- [x] Install pinned dependencies and execute baseline checks.
- [x] Replay migrations in a new isolated local PostgreSQL database; retain existing databases.

## Phase 2 — catalog integrity and admin

- [x] Implement additive typed-attribute/unit/applicability and publication refinements.
- [x] Define category rule resolution and protect dictionary changes.
- [x] Verify SKU/default/variant axes, commercial contexts and price history.
- [x] Complete corresponding admin inputs, validation and feedback.
- [x] Verify media/document lifecycle without changing the R2 provider contract.
- [x] Execute database integration and regression tests.

## Phase 3 — public catalog

- [x] Verify anonymous projections and read-only transport; preserve legacy inquiries privately.
- [x] Implement SKU/model search, category descendants and technical filters.
- [x] Expose product specifications and complete safe variant technical information.
- [x] Verify fixed/range/request prices, units, currency, MOQ and expiration.
- [x] Verify SSR, SEO, bounded pagination and immediate withdrawal checks.
- [x] Execute browser/API and responsive checks.

## Phase 4 — performance, security and release

- [x] Capture schema inventory and query plans from the isolated applied database.
- [x] Measure 500/5,000/20,000/50,000 product workloads where practical.
- [x] Add indexes only where measured plans justify them.
- [x] Run lint, typecheck, automated tests, worker check and production builds.
- [x] Document security findings, deployment order, backup and forward rollback.
- [x] Publish final readiness report with actual results and explicit remaining gates.
- [ ] Staging: actual Supabase Auth/MFA/Storage/PostgREST, R2, worker/invalidation and restore drill (requires configured approved environment).

## Constraints

No remote production writes, migrations, deployments or credential rotation. Existing migration history, identifiers, audits, prices and integrations must be preserved. Test fixtures are synthetic and isolated. Local platform substitutes and provider doubles do not satisfy real staging gates.

Local evidence: 29 migrations replayed; 204 tests; 6 admin/R2 browser scenarios; 10 public workflow checks. Real service/restore gates remain open in the final readiness report.

Full recheck: nine additional configured-site browser checks passed. A newly reproduced dictionary/publication race was repaired by migration 011 and four additional real-session orderings. See `recheck-report.md` and `dictionary-race-check.json`.
