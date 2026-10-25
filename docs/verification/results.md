# Verification evidence

This records the original foundation checks. See [R2 refactor results](r2-results.md) for the current storage implementation and updated test counts.

Executed locally on 2026-10-24. No supplied hosted credentials were used for writes, migrations or deployment.

- Final `pnpm build` passed through Turborepo (1 successful task), including Next production compilation, strict TypeScript and route generation. Authentication and MFA pages render dynamically.
- TypeScript strict checks and ESLint pass.
- 53 tests pass: 34 real PostgreSQL tests, 10 domain/validation tests and 9 provider-contract tests.
- Two Playwright scenarios passed against a local HTTP provider double: authenticated catalog workflow and unauthorized request rejection. Desktop dashboard/editor and 390px mobile brand screenshots were captured and inspected. These are not live Supabase/Cloudflare E2E results.
- Final browser rerun passed both scenarios, including an authenticated cross-origin mutation rejection. Screenshots: [desktop dashboard](dashboard-desktop.png), [desktop editor](editor-desktop.png), [mobile brands](brands-mobile.png).
- All committed migrations through 011 applied to isolated PostgreSQL 18.4 on loopback. Supabase platform Auth/Storage objects were represented by local test substitutes; actual Supabase reset/pgTAP/Edge tests remain pending because Docker is not running.
- A second clean database replay applied all eleven migrations and again passed all 53 tests.
- Generated TypeScript schema types were read from the actual applied local PostgreSQL catalog, including foreign keys and RPC signatures.
- Production dependency audit covered 151 dependencies and found zero known advisories. See dependency-audit.json.
- Performance report: `performance.json`, 15 warm single-client RPC samples for each of 500/5,000/20,000 products, with 2 variants, specs and prices plus 1 synthetic image per product. P95 10.2/23.3/72.6 ms. This is database loopback latency, excluding HTTP, hosted infrastructure, cold cache and concurrency.

The first large fixture run exhausted advisory-lock memory. Migration 009 changed attribute serialization to row locks and role lookup to per-query init plans. The rerun completed at 20,000 products without raising PostgreSQL lock limits. This finding and repair are part of the evidence; no higher-throughput claim is made.

Browser testing also identified ambiguous form labels and a debounced-search timer that could override a pending navigation. Explicit control labels and navigation-time timer cancellation fixed these; the final workflow passed afterward. Reference repositories had existing uncommitted changes; this implementation did not edit their files or change global Git trust settings.
