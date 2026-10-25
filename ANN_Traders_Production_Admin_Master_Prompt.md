# ANN TRADERS — MASTER ENGINEERING PROMPT
## Production-Grade Textile & Garments Supply Catalog Admin, Supabase Backend, and Future Read-Only Public Catalog

Purpose: Paste this prompt into a coding agent (Claude Code, Google AI Studio with repository access, Codex, or equivalent) in the project workspace. The agent must inspect the existing database-design document and reference admin UI folder, then implement Phase 1 (the actual admin application and Supabase backend), not merely generate a mockup or architecture essay.

---

# 0. YOUR ROLE, OPERATING RULES, AND REQUIRED OUTCOME

Act simultaneously as:
1. Principal software architect specializing in Next.js 16, TypeScript, monorepos, scalable SaaS-style admin interfaces, and production operations.
2. PostgreSQL/Supabase database architect, with expertise in constraints, RLS/RBAC, migrations, transactions, indexing, and reliable asynchronous workflows.
3. Application-security engineer experienced in OWASP ASVS, secure session management, least privilege, secrets, and file-upload threats.
4. Bangladesh textile, garments accessories, industrial machinery, and B2B supply-catalog domain analyst.
5. Senior UI/UX engineer experienced with responsive, low-friction, dense enterprise product-entry workflows.
6. SRE/DevOps engineer for Docker-based development, Vercel deployments, GitHub Actions, monitoring, backups, and recovery.

Mission: Build a maintainable, secure, visually premium, genuinely usable ANN Traders Admin Panel backed by Supabase PostgreSQL, Supabase Auth, RLS, RPC/transactional logic, Supabase Storage for documents, and Cloudflare Images for product images. The next phase will create a completely separate customer-facing website that reads ONLY published, public catalog information. Design its integration contract now; do not build the public customer application in Phase 1.

Success is working software, not just a plan. Inspect existing files first. Proceed in small, testable implementation phases. Do not claim features are completed when they are not. Avoid scaffolding-only deliverables, hardcoded demo-only data, mock authorization, placeholder forms, broken routes, and TODO-based substitutes for critical controls.

Constraints:
- Product catalog ONLY: no checkout, shopping cart, customer login, customer write operations, orders, stock-ledger/accounting, payment gateway, or ERP unless already explicitly required by source design. An inquiry feature is not part of scope unless requested later.
- Admin and customer frontend must be separate deployable Next.js applications, with separate domains/environment configurations and independent caching policies, sharing one Supabase project.
- Admin creates, edits, publishes, archives, restores, and soft-deletes catalog information in Supabase; public site cannot write anything.
- The supplied 28-entity design is authoritative starting scope, not automatically production-perfect. Preserve its intent and names wherever practical; document and migrate necessary integrity/security extensions. Do not silently change the domain model.
- Do not deploy to production, delete remote data, overwrite an existing schema, rotate keys, or make destructive operations without explicit permission. Work on local/dev instances until approved.
- Prefer one simple, verifiable solution rather than introducing Redis, Kafka, a standalone Node API, or extra cloud services without demonstrated need.

# 1. READ AND AUDIT THE ACTUAL PROJECT FIRST (MANDATORY)

Inspect these Windows project paths (or their current workspace equivalents):
- `D:\Project\ann traders\database-design.md` — primary source for the database design.
- `D:\Project\ann traders\reference admin panel` — UI/UX component, visual style, interaction, navigation, and layout reference; inspect actual contents rather than guessing what is inside.
- Inspect current repository, existing package files, Git state, configuration, migrations, docs, image assets, fonts, and component definitions before touching anything.

The supplied design describes 28 entities:
`categories`, `brands`, `units`, `products`, `product_extra_categories`, `product_variants`, `attribute_definitions`, `attribute_options`, `category_attributes`, `product_attribute_values`, `variant_attribute_values`, `variant_prices`, `price_tiers`, `variant_packaging`, `product_media`, `product_documents`, `industries`, `product_industries`, `applications`, `product_applications`, `certifications`, `product_certifications`, `fibers`, `variant_fiber_composition`, `equipment_models`, `variant_equipment_compatibility`, `admin_profiles`, `audit_logs`.

Before coding, produce `docs/architecture/schema-audit.md` with:
- The 28-table entity map, relationships, permissions, data ownership, indexes, delete behavior, unique constraints, and missing constraints.
- Production-risk findings, severity, proposed additive schema migrations, and business-rule questions.
- A table matching each proposed change to its justification and compatibility impact.
- Distinguish what is present in supplied design from your new recommendation.
- Review visual reference files and write `docs/design/reference-audit.md` describing reusable patterns, colors, typography, spacing, layout, table behavior, navigation, dialogs, forms, interaction states, and mobile handling. If files are not accessible, explicitly report that limitation and proceed using a coherent premium design system rather than inventing their contents.
- Inspect reference sites for industry taxonomy and content conventions, not as approved sources for live product prices, copyrighted images, credentials, or a UI to clone:
  - https://fabrix.com.bd/
  - https://www.odyssey-bd.com/
  - https://rukonmarkerpaper.com/
  - https://paramountbdm.com/
  - https://www.smarttechbd.net/
  - https://digifab-bd.com/
  - https://dysin.com/
  - https://creativesafetysolution.com/
  - https://pridesys.com/
- Review installed package versions and current official documentation before using Next.js/Supabase APIs. Use stable, compatible packages and record the versions chosen.

Do not wait for answers to minor ambiguities: use the least-risk documented assumptions, build extensibly, and surface decisions in `docs/decisions/`. Escalate ONLY requirements that would force risky destructive changes, expose secrets, or require real external credentials.

# 2. LOCKED TECHNICAL STACK

| Area | Choice / rule |
|---|---|
| Admin framework | Next.js 16 App Router, separate deployable app |
| Future public framework | Next.js 16 App Router, separate deployable app |
| Language | TypeScript strict; no `any` without documented boundary justification |
| UI | React, Tailwind CSS, shadcn/ui, Radix UI, Lucide React |
| Async server state | TanStack Query; explicit query keys and invalidation after mutations |
| Client-only complex state | Redux Toolkit only if justified; otherwise local state/URL params |
| Forms | React Hook Form + Zod (shared schemas; server-side validation too) |
| Admin tables | TanStack Table + server-side pagination/sort/filter |
| Large lists | TanStack Virtual if measured need; never fetch everything to virtualize |
| Backend / DB | Supabase hosted infrastructure + PostgreSQL |
| Auth | Supabase Auth with SSR-safe cookie sessions |
| Authorization | Grants + PostgreSQL RLS + explicit RBAC; all checks server/DB side |
| Transactions | PostgreSQL functions/RPC for related multi-table mutations |
| Privileged integrations | Narrowly scoped Next.js server route handlers / Supabase Edge Functions |
| Images | Cloudflare Images for product, brand, and category images |
| Files | Supabase Storage buckets for PDFs and technical documents |
| Async processing | Supabase Queues (pgmq), consumed via authenticated scheduled Edge Functions where needed |
| Scheduling | Supabase Cron (pg_cron), secrets via server-side configuration / Vault |
| Search | PostgreSQL FTS + `pg_trgm`, indexed and server-side |
| Error monitoring | Sentry and Supabase/Vercel/Cloudflare platform logs |
| Testing | Vitest, Supabase local DB tests, Playwright E2E |
| Local development | pnpm, Turborepo, Docker, Supabase CLI local containers |
| Deployment | Vercel admin/public apps, Supabase backend, Cloudflare Images |
| CI/CD | GitHub Actions: lint, typecheck, unit, DB, E2E, build, controlled migrations |

Use official Supabase SSR guidance with `@supabase/ssr` for cookie-based Next.js Auth, including Next.js 16 `proxy.ts` for refresh plumbing. Proxy alone is not an authorization boundary; validate identity and roles again on every protected server operation, and rely on RLS as the final backstop. Use `getClaims()` for JWT claim validation and `getUser()` where a fresh authoritative Auth-user lookup is required. Never trust an unchecked session payload from cookies.

# 3. HIGH-LEVEL ARCHITECTURE AND REPO LAYOUT

Use pnpm workspaces + Turborepo. Proposed structure (adjust only after auditing repository):

```text
ann-traders/
  apps/
    admin/                     # Implement now. Privately authenticated admin Next.js 16 app.
    catalog/                   # Contract-only minimal future scaffold; no customer UI in Phase 1.
  packages/
    ui/                        # Shared design system, components, tokens.
    database/                  # Generated Supabase DB types, typed data access, DTOs.
    validation/                # Zod payload and form schemas.
    config/                    # Shared TS, lint, formatting, Tailwind configuration.
    domain/                    # Units, pricing, publishing rules, DTO transformation.
  supabase/
    migrations/                # Versioned, reviewed SQL, including grants and RLS.
    seed.sql                   # Safe deterministic test fixtures only.
    tests/                     # RLS, RPC, constraints, SQL integration tests.
    functions/                 # Authenticated webhooks/queue consumers as needed.
    config.toml
  docs/
    architecture/
    decisions/
    security/
    operations/
    design/
    api/
  scripts/                     # Local utilities, type-generation and verifications.
  .github/workflows/
  docker-compose.yml           # Local app services; avoid duplicating Supabase containers.
  Dockerfile.admin
  Dockerfile.catalog            # Optional later; scaffold only if it adds value.
  .env.example
  pnpm-workspace.yaml
  turbo.json
  README.md
```

Prefer Server Components for initial layout and data needs; interactive admin grids/forms use Client Components and TanStack Query. Put integration/adapters at server boundaries. Do not create a custom Express/Nest backend because Supabase already fills that role. Use server routes/actions for secure, specialized operations (Cloudflare uploads, authenticated cache invalidation, invitation workflows). Direct authenticated browser-to-Supabase queries are acceptable only when policy/grants fully secure them; complex catalog mutations should go through typed database RPC that executes atomically.

Trust boundaries:
- Browser admin: publishable Supabase key, authenticated user access token; no Cloudflare API secret or Supabase service-role/secret key.
- Admin server: request-level JWT verification, role checks, input validation, narrow Cloudflare capability, no blanket bypass of RLS for ordinary CRUD.
- PostgreSQL: grants, RLS, constraints, indexes, controlled functions, auditing.
- Public app: anonymous read-only of public published projection; no admin data, drafts, soft-deleted rows, private docs, cost data, staging assets, or other internal metadata.
- Worker: server-only privileges, secure invocations, audit logs, bounded batch sizes.

# 4. DATABASE ENGINEERING: SCHEMA + INTEGRITY

Implement migration files, never manual undocumented Dashboard-only schema tweaks. Generate TypeScript database types from the local/dev schema. Every table has explicit owner, grants, RLS policy, indexes aligned to measured query patterns, and consistent `created_at` / `updated_at` semantics.

## 4.1 Preserve the 28 original core entities

Build the complete normalized base model with foreign keys, check constraints, cascade/restrict decisions, and referential integrity. Do not remove variant-specific technical attributes, historical prices, compatible equipment, compositions, or packaging to make the UI simpler.

Important invariants to enforce (use DB constraints / triggers / atomic RPC where appropriate):
- Unique normalized product code, SKU, category/brand slug; explain case-folding, collision, and slug stability policies.
- Recursive category tree has no parent cycles, no self-parent, defensible maximum depth and ordering.
- Every published product has at least one active variant; the product may be an incomplete draft during authoring. At most one default active variant per product, and exactly one at publish time.
- Product child records must belong to that product: variant media/document links cannot point to a variant belonging to a different product.
- Required category product/variant attributes validated before publishing; numeric values are valid and typed, option IDs belong to the correct attribute, scalar attributes cannot be duplicated, multi-select options cannot be duplicated.
- Fiber components have percentages from 0 to 100 and total 100% at variant publication for categories requiring fiber composition; avoid restricting categories that do not use fiber.
- Suitable domain checks for positive MOQ, price, pack quantity, supply capacity and nonnegative lead times; availability values constrained to the design.
- Price windows are valid (`valid_until > valid_from` where applicable). Decide and enforce a single unambiguous active price per relevant currency / price unit / trade term / pricing context and time, or document clear precedence. Avoid invalid overlapping active ranges.
- `price_type` is `fixed`, `range`, or `on_request`, with matching numeric-field requirements; validate min/max order; non-overlapping tier quantities, positive tier prices, meaningful tier ranges and correct units.
- Only valid unit-family conversions; GSM is a measurement attribute, not a quantity unit interchangeable with KG. Do not silently convert KG to yard without enough width, GSM, and physical conversion context.
- Product publish/unpublish/archive/soft-delete/restoration is consistently reflected across public exposure, associated prices, media, documents, and search results.
- Prevent unsafe hard deletion for historical pricing or referenced master data; define soft-delete semantics and clear admin confirmation UI.
- `updated_at` triggers, actor tracking, and reliable audit trails for important writes. Database timestamps UTC; display dates/times in `Asia/Dhaka`.
- Use `NUMERIC`, never floating-point arithmetic for currency, quantity, conversion factors, or price comparisons. Preserve currency code as ISO code (BDT, USD etc.).
- URL fields and stored file metadata validated; disallow arbitrary untrusted URLs in public media if they can bypass an approved image host.

## 4.2 Review recommended targeted schema extensions

Add only justified migrations for missing production capabilities, such as:
- Cloudflare images `provider`, `provider_asset_id` (Cloudflare image ID), `delivery_url` / canonical base variant URL, `upload_status`, `content_type`, bytes, dimensions, optional checksum, and uploader attribution; preserve compatibility with the supplied `product_media.external_url` field if it already exists. Do not store just a URL: asset ID is needed for safe delete/replacement.
- Same Cloudflare media ownership model for `categories.image_path` and `brands.logo_path` if needed.
- Staged/pending media uploads and orphan cleanup, without publishing unverified files.
- Optional `product_revision` / optimistic concurrency guard using `updated_at` or explicit revision number to prevent silent overwrites.
- DB-backed `outbox_events` and/or job ledger for reliable post-commit cache invalidation and media cleanup; protect against retries.
- Admin invitations / role change audit metadata, if needed; do not implement a public signup flow.
- A safe `public_catalog` schema or strictly limited security-invoker views/RPC exposing only public DTOs, rather than granting unrestricted reads on all normalized tables.
- Product/variant search projection or stored search vector, if validated via EXPLAIN and benchmark.

For any extension, include `why`, change impact, migration SQL, rollback strategy, performance implications, and RLS/grants.

## 4.3 Transactions and APIs

Design explicit, versioned, typed operations:
- `create_product_draft` with initial safe defaults.
- `save_product_details` and `save_product_variants` with ownership and concurrency checks.
- `upsert_variant_price`, `replace_tiers`, and availability updates with validation.
- `publish_product` with full cross-table validation inside one transaction and actionable field-specific error messages.
- `unpublish_product`, `archive_product`, `soft_delete_product`, `restore_product`.
- `reorder_product_media`, `set_primary_image`, `attach_verified_image`, `detach_image`.
- `list_admin_products` (paginated / sorted / filtered), `get_admin_product_detail` with bounded relational hydration.
- `list_public_products`, `get_public_product_by_slug`, safe public filter options (future app contract; no public UI required).

Function names are proposals, not a license to expose broad privileged `SECURITY DEFINER` functions. Prefer `SECURITY INVOKER`; use tightly controlled, audited definer functions in non-exposed schemas only when necessary. Pin search paths, fully qualify table names, validate `auth.uid()` and role, revoke EXECUTE from PUBLIC/anon, and test all grants. If a function must be API-exposed, keep it invoker with RLS and explicit permission checks or use a narrowly protected server endpoint.

# 5. ROLES, SESSION SECURITY, RLS + RBAC

Implement the following initial matrix, refining only with documented justification:

| Capability | Super Admin | Admin | Editor | Anonymous public |
|---|---|---|---|---|
| Admin login and authorized reads | Yes | Yes | Yes | No |
| Create/edit drafts, variants, pricing/media | Yes | Yes | Yes (as approved) | No |
| Publish/unpublish products | Yes | Yes | No by default | No |
| Soft-delete/restore products | Yes | Yes (policy-based) | No | No |
| Manage categories, brands, units, spec dictionaries | Yes | Yes | Read-only by default | Published-safe read only |
| Invite/disable admins, assign roles | Yes | No | No | No |
| Change own role / self-activate | No (use controlled super-admin workflow) | No | No | No |
| View audit history | Yes | Yes (scoped) | No | No |
| Read published public projection | Yes | Yes | Yes | Yes |
| Write Supabase catalog as anonymous | No | No | No | No |

Required behaviors:
- Email/password login using Supabase Auth, invitation-based admin onboarding, password reset, logout, session expiry/refresh, account deactivation and revalidation of role.
- No public signup or implicit admin role on account creation.
- MFA support / enforcement for privileged admin roles according to current Supabase functionality; document enrollment and recovery.
- Separate `admin_profiles` row mapping to `auth.users.id`, protected role updates, active flag and disable flows; revoked or disabled users cannot continue modifying via stale sessions/JWTs.
- Defense in depth: restrict database grants as well as RLS; `anon` SELECT only on intentionally public sources, zero INSERT/UPDATE/DELETE/EXECUTE to administrative pathways; no public read to `admin_profiles`, `audit_logs`, privileged functions, internal events, staging assets.
- Audit role changes, permissions, product writes, price modifications and administrative deletions, with actor, UTC timestamp, action, row identifiers, before/after safe diff (redact secrets, access tokens, and private data).
- Create automated RLS tests for signed-out users, inactive admins, all roles, row mutation attempts, role escalation, draft leakage, and protected document reads.
- Page guards, route handlers, server actions, and functions independently authorize; hidden UI buttons never equal security.

# 6. FULL ADMIN PANEL — REAL FUNCTIONAL MODULES

Use the existing reference admin panel's design language after inspection. Make it refined, premium, clean, light-mode-first, accessible, enterprise-grade and highly usable on desktop/tablet/mobile. Consistent 1px subtle borders, restrained shadows, uncluttered content areas, crisp typography, consistent form control height, readable dense tables, usable dialogs and drawers; no gratuitous gradients, giant cards, or unnecessary animations. Preserve reference assets only when permission/rights are clear.

## 6.1 Core navigation / admin UX

- Secure Login, Forgot/Reset Password, Session Expired, Unauthorized, Not Found, Error boundary.
- Sidebar (collapsible), top bar, breadcrumbs, global quick search, account menu, role-aware navigation, notification/toast region.
- Dashboard with real database data: total published/draft/archived products, active variants, catalog completion issues, missing primary images, prices missing/on request, recent edits and activity. Queries must be efficient and scoped; no fabricated analytics.
- Catalog: all products, draft/published/archived tabs or filters, create, edit, duplicate, preview, publish/unpublish, archive, soft-delete, restore; status badges, batch actions where safe.
- Categories: nested tree, create/edit/reparent/reorder, optional images, cycle prevention, category-to-attribute mapping.
- Brands: list, logo upload, metadata, website links, active state.
- Attribute Manager: definitions, typed select options, unit selection, filterable/searchable flags, variant axis flag, category mapping and required rules.
- Units: name/code/symbol/family/conversion factor with input checks.
- Variants & Prices: shown within product editor plus useful management screens if appropriate; avoid redundant unmaintainable UIs.
- Media Library: Cloudflare image operations; status, previews, ownership, primary images, sort order, alt text, cleanup confirmation.
- Technical Documents: Supabase Storage uploads; document title/type/public flag, permissions, previews/download links where allowed.
- Industrial Taxonomy: industries, applications, certifications, fibers, equipment models, equipment compatibility.
- Admin Users & Roles: super-admin-controlled invitations, activation/deactivation, permission matrix.
- Activity / Audit Log: secure filters, date range, entity/actor/action, before/after inspection with redaction.
- Admin Settings: company identity, supported units/currencies/price presentation policies (only if backed by explicit schema and genuine need), profile and security settings.
- Data tools: CSV import/export if justified for bulk entry; secure preview/validation/errors, dry-run and bounded batches; never let imported files bypass DB constraints or authorization.

## 6.2 Product list view

Build an actual server-side data table with search by name/product code/SKU/model/brand, status, category tree, brand, pricing state, availability, featured flag and last update; column visibility, sorting, pagination, selection, row actions, loading/empty/error states, URL-synced filters, debounced search, keyboard accessibility, and bulk operations only where safe. Avoid N+1 queries. Render small optimized thumbnails and prevent layout shift. Use cursor pagination only if beneficial for very large catalogs and explain the trade-off.

## 6.3 Product creation/editing flow (highest priority)

Implement a usable multi-section form or stepper with persistent drafts and deterministic save behavior. Suggested sections:
1. Basics — name, product code, slug, category, additional categories, brand, type, origin, summary, full description, key features, featured/new arrival, SEO.
2. Variants — SKU, name, model/manufacturer part, default flag, variant status, MOQ, lead time, monthly capacity, units.
3. Specifications — category-driven dynamic validated fields; distinction between product-level and variant-level values; textile GSM, width, color, composition, fabric construction, chemical pH/concentration, safety standards, machine voltage/power/speed, marker-paper roll width/weight and machine compatibility as appropriate.
4. Pricing — fixed/range/on-request by variant, ISO currency, amount, unit, terms, effective date window, tiered MOQ pricing; clear localized price preview.
5. Packaging — roll/bag/box/drum/carton, quantity/unit, description/default.
6. Images — upload, progress, preview, reorder, set primary, add alt text, associate with product or variant.
7. Technical Documents — TDS/SDS/MSDS/certificates/manuals, visibility rules.
8. Industry / applications / certifications / fiber composition / compatible equipment.
9. SEO + public catalog preview — preview exactly the public DTO without granting public access to drafts.
10. Review & Publish — full validation summary, missing required elements, publish eligibility, explicit publish action.

Must support draft-first saves without requiring every publishing field, save failure/retry, dirty form warning, unsaved navigation guard, Zod plus server verification, cancellation/reset, server-side duplicate SKU/product-code errors mapped to fields, optimistic concurrency conflict detection, keyboard use, and error messages that identify *which variant or attribute* needs correction. There must be a real end-to-end edit path for all designed product relationships, not just fields on `products`.

# 7. BANGLADESH TEXTILE & GARMENTS B2B DOMAIN CORRECTNESS

The catalog may contain fabrics, knit/woven/denim, marker/pattern/plotter paper, plotter inks/cartridges, cutter blades, CAD/CAM equipment, garments machines, dyes/chemicals/auxiliaries, packaging, safety/PPE, software/licenses, and other industrial supply products.

Use schema-driven taxonomy and category-specific specifications; do not hardcode one universal variant screen with irrelevant inputs.

- Expected pricing presentations include `৳85/kg`, `৳.../yard`, `৳.../meter`, `৳.../roll`, `৳.../piece`, `৳.../liter`, `৳.../set`, USD quotations, price ranges, and Price on Request. These are formatting examples, not market quotes.
- Support MOQ with a distinct quantity and unit, tier pricing, packs/cartons/roll dimensions, lead time and supply capacity.
- A 65 GSM / 64-inch marker paper and a 70 GSM / 72-inch marker paper are different SKU variants even when the product name is identical.
- Do not confuse *GSM*, *width*, *roll length*, *roll weight*, *sale unit*, *MOQ unit*, and *pricing unit*. They have different domain semantics.
- Technical documents may be public or private. Chemicals should support SDS/TDS metadata and document-type distinctions; certifications should have issuer, expiry and supporting documents where relevant.
- Optional shade/color code, origin, compatible machine model, manufacturer part number, industrial application and pack specifications when valid for the category.
- Product price, availability, lead time, and trade term must be clearly labeled as supplied catalog information and not falsely marketed as guaranteed live inventory or a binding quotation.
- Default locale `en-BD`, currencies BDT and USD, display currency symbol appropriately, time zone `Asia/Dhaka`, store times in UTC. Keep architecture i18n-ready, but do not automatically implement full Bengali translation.
- Do not scrape/reproduce competitor prices or photographs; seed only fictional/labeled test data.

# 8. CLOUDFLARE IMAGES — SECURE DIRECT UPLOAD & MEDIA LIFECYCLE

Cloudflare Images stores original/managed images. Supabase PostgreSQL stores references including the stable Cloudflare image asset ID and delivery URL. Supabase Storage is for technical documents, NOT duplicate product image storage.

Build this exact conceptual flow:
1. Signed-in admin picks images. Browser validates extension/type, size, count, and basic dimensions; server repeats all relevant checks. Block unsupported/problematic formats where appropriate (especially untrusted SVG unless proven safe).
2. Admin calls a protected Next.js server endpoint `/api/admin/images/create-upload` (or equivalent); handler validates Auth + role + rate limits and calls Cloudflare Images Direct Creator Upload using a server-only scoped Cloudflare token.
3. Server responds with Cloudflare's time-limited one-time upload URL and a temporary upload record bound to the admin, product/draft context and Cloudflare image ID. Never return the Cloudflare API token to the browser.
4. Browser uploads bytes directly to Cloudflare over HTTPS and shows real progress, retry/abort where supported.
5. After upload, a trusted server verifies status/ownership and Cloudflare image ID using Cloudflare's API and/or a signature-verified webhook; NEVER trust a client-submitted `image_id`, `external_url`, or `uploaded=true` without verification.
6. Only then mark the media as available and atomically attach it to the relevant product/variant. Persist `provider=cloudflare_images`, `provider_asset_id`, `delivery_url` (Cloudflare image delivery URL), preferred variant, alt text, order and primary flag as appropriate.
7. Serve optimized named Cloudflare variants (`thumbnail`, `card`, `detail`, `original` where required); configure `next/image` remote patterns or a deliberate, benchmarked image delivery strategy. Ensure correct `width`, `height`, lazy load and responsive `sizes`.
8. For replace/delete: update DB ownership/reference transactionally, enqueue Cloudflare cleanup only after DB success, ensure assets are not referenced elsewhere, support delayed retries, dead letters and reconciliation of orphaned/pending assets.
9. Cloudflare asset deletion failure must not corrupt product records. Failed upload must not leave a published broken URL. Limit abuse with per-user quotas and timeouts.
10. If signed/private Cloudflare Images are used, account for tokenized delivery and do not store nonfunctional public URLs. For publicly displayed product pictures, use an approved public image variant/policy.

Do not run all browser uploads through Next.js/Vercel server as base64 or multipart proxy unless there is a documented technical reason. Avoid exposing account hash or public CDN image URL as a substitute for authorization.

# 9. SUPABASE STORAGE — TECHNICAL DOCUMENTS

- Separate buckets/policies for public catalog documents versus admin-private documents as needed.
- Authenticate uploads and validate MIME/content signature, size, filename and document type. Use generated unique safe storage keys; no arbitrary user-controlled paths or filename traversal.
- Store bucket/path, linked product/variant, visibility, metadata and uploader; never store a signed temporary URL permanently.
- Public documents accessible only when linked to published permitted products and flagged `is_public=true`; evaluate whether public bucket would violate this, and prefer private buckets + short-lived signed URLs / secure proxy when visibility can change or docs may be sensitive.
- Validate download/view permissions at access time; avoid exposing raw private paths or signed links through public cached JSON.
- Document security, potentially malware scanning workflow when external input is allowed, file replacement, orphan cleanup, versioning if necessary, and CDN cache implications after revocation.

# 10. SUPABASE QUEUES, CRON, EVENTS AND WORKERS

Do not deploy an always-running background worker inside Vercel serverless functions. Prefer a pgmq queue + authenticated scheduled Supabase Edge Function consumer for asynchronous work that requires retries, e.g.:
- Cloudflare orphan cleanup and delayed deletion.
- Image-upload reconciliation/verification if webhooks fail.
- Cross-app public cache invalidation notification / webhook dispatch.
- Optional safe bulk CSV import jobs, large exports, scheduled catalog integrity checks.

Design:
- Transactional outbox when events must not be lost between DB commit and enqueue; or atomic enqueue inside the same Postgres transaction when reliable and supported.
- Minimal event envelope: event ID, type, aggregate/entity ID, version, time, payload, idempotency key, attempts and correlation ID.
- Visibility timeout, retry with backoff/jitter, max attempts, poison-message/dead-letter strategy, bounded batches, concurrency limits and quotas.
- Every worker handler idempotent; visibility-timeout delivery is not globally exactly-once side-effect execution. Never double-delete, double-publish, or double-send after retries.
- Private worker entry points, protected secrets, verified signatures or authorization, least privileges, structured errors, event tracing and alerts on backlogs.
- Supabase Cron jobs for periodic processing, cleanup and monitoring; no expensive SQL full scans every minute. Use `pg_cron` with protected values in Vault/environment and review available extensions and plan limits.
- Clear operational playbook: inspect queue, retry, replay, dead letters, poison messages, image orphans, stale invalidations.

If queues/cron are unnecessary for a specific minor task, use a straightforward synchronous call instead; do not create an unneeded distributed system.

# 11. CACHING STRATEGY: ADMIN FRESHNESS + FUTURE PUBLIC CDN

Two separate apps need deliberately different rules.

Admin application:
- Always show authoritative draft/current data; do not cache private admin HTML/data at shared CDN edge.
- Use TanStack Query with tuned `staleTime`, query keys scoped to user/role and filters, proper mutations and invalidation/refetch, optional optimistic updates only where rollback is correct. Strong consistency for publish, price, and permissions.
- Mark protected responses `Cache-Control: private, no-store` where required; NEVER share-cdn-cache auth response or `Set-Cookie`. Scrutinize Next.js server component caching.

Future public catalog:
- Only published, sanitized projection. Use Next.js 16 Cache Components (`cacheComponents: true` and `'use cache'`) where appropriate, `cacheLife`, `cacheTag`, and `revalidateTag(tag, 'max')` in route handlers for stale-while-revalidate invalidation. `updateTag` is Server Actions only, not a remote webhook or route-handler API; do not mistakenly use it there.
- Cache categories, brands, public product list/detail, filter metadata separately with well-defined keys, region-aware invalidation and TTL fallback. Design tags such as `catalog:products`, `catalog:product:<id>`, `catalog:category:<id>`, `catalog:filters`.
- After committed publish/update/unpublish/deletion, enqueue a secure invalidation event. Since admin and public apps are separate Vercel deployments, invalidating admin cache does not automatically invalidate public app cache. Implement a trusted server-to-server signed request or purpose-built event consumer targeted to public app's invalidation endpoint, with replay protection, idempotency, rate limits, timestamps, and retry.
- Use a bounded stale-while-revalidate policy for harmless product edits, but consider stricter immediate/invalidation bypass behavior for unpublishing, private-document revocation or critical price visibility changes; explicitly state consistency guarantees and failure modes.
- Cloudflare Images CDN caches immutable image assets/variants. Cloudflare CDN does not automatically cache Vercel-rendered HTML/API just because Images are hosted on Cloudflare; treat page/API CDN caching as a separate deployment configuration and avoid layering two conflicting caches.
- Avoid `no-store` everywhere on public app; avoid caching any request that depends on private session cookies. No public edge cache of admin data.

Create a cache matrix in `docs/architecture/caching.md` with resource, owner, key, TTL, scope, invalidation source, event recovery, and maximum stale tolerance.

# 12. SEARCH, FILTERING, QUERY DESIGN AND DATABASE PERFORMANCE

Implement performant admin search now, reusable public search contract later:
- Case-insensitive name, SKU, code, model and brand search, with `pg_trgm` / GIN where appropriate; indexed PostgreSQL FTS for description/features if valuable.
- English with Bangladesh market terminology as baseline; check limitations for Bengali tokenization rather than claiming built-in high-quality Bangla FTS. Use trigram/normalization and test realistic data.
- Query in PostgreSQL using safe parameter binding; no unsafe string-concatenated SQL, unbounded `ILIKE '%...%'` full scans, or client-side fetching of tens of thousands of products.
- Server-side category descendants, brand, price visibility, currency, product status, variants, availability, feature flags, technical filterable attributes, industry, application, and certifications.
- Consider materialized/search read models only after evidence and an invalidation plan; avoid unnecessary denormalized duplication on day one.
- Composite/partial indexes for `status='published' AND deleted_at IS NULL`, category/brand foreign keys, `sku`, price effective range lookups, attribute `(attribute_id, option_id/value_number)` and sort paths; validate against real query plans.
- Use `EXPLAIN (ANALYZE, BUFFERS)` on representative dataset, and report P50/P95 latencies before/after indexing.
- Use cursor/keyset pagination where suitable, bounded `limit` and stable sort with tiebreaker; count exact rows only when cost acceptable; avoid N+1 joins and excessively large relation embeds.
- Supabase serverless connection management: prefer HTTP Data API/RPC where suitable; if using direct Postgres, document transaction-pooling compatibility, prepared statement limitations, migrations with session/direct connections, and pooled connection limits. Don't create a new raw DB connection for every Vercel request.

Performance test dataset should contain at least ~5,000–20,000 synthetic products with multiple variants/specs/prices/images and representative filters, to identify query problems before production. Also test 500 products and small catalogs so complexity stays proportionate. Targets to be proposed and measured, not invented as achieved: e.g. typical admin search API P95 < 500 ms under stated local/staging load, and smooth pagination without massive payloads. State test hardware/network/load and explain failures.

# 13. APPLICATION SECURITY (NON-NEGOTIABLE)

Provide `docs/security/threat-model.md` with assets, attackers, trust boundaries, abuse paths and mitigations. Cover:
- OWASP Top 10 / ASVS-aligned secure coding; input schema validation server-side and DB-side checks; output encoding, sanitization/whitelisting for rich-text descriptions, XSS and unsafe HTML prevention.
- Authentication, least-privilege RBAC/RLS/grants, CSRF/origin checks for state-changing cookie-authenticated actions, secure session cookies/TLS, HTTPS, session expiry/rotation and no sensitive tokens in localStorage when SSR cookies are used.
- Narrow, server-only Supabase secret/service-role access for explicitly privileged system functions; never leak into `NEXT_PUBLIC_*`, source maps, logs, client bundle or test fixtures.
- Secret storage in Vercel/Supabase/Cloudflare GitHub environment secrets; no committed `.env` keys or real credentials; `.env.example` contains only names.
- Rate limiting, sensible request-size and upload limits, signup disabled, brute-force defenses, lockout/risk policy without easy denial of service, MFA for elevated roles.
- SSRF and URL injection protections for `external_url`, image and document URLs, webhook callbacks, redirects and SVG content.
- Content-Security-Policy suited to Supabase, Cloudflare Images and monitoring, clickjacking/X-Frame-Options, HSTS on production, referrer policy and no wildcard CORS.
- Concurrency authorization attacks, object-level access (IDOR), mass assignment, unauthorized profile role updates, SQL injection, unverified webhooks, token replay and private-data leakage.
- Database grants verified by SQL tests; secure invoker/definer strategy with pinned search paths and narrowed function execution privileges.
- Dependency pinning and automated vulnerability checks, safe error messages, PII redaction, no raw SQL errors or stack traces shown to users.
- Preserve immutable audit integrity as far as privileges allow; prevent admins from quietly rewriting or deleting sensitive audit evidence.
- Backups, point-in-time recovery if supported by selected paid plan, periodic restore drill, migration rollback, environment separation and incident response.

Write actionable security test cases, not generic assertions that the app is secure.

# 14. OPERATIONAL RELIABILITY, ERROR HANDLING AND OBSERVABILITY

- Sentry in client/server/Edge boundaries as compatible, release version, environment labels, trace correlation IDs, sampling and PII scrubbing.
- Structured logs of CRUD mutations, Cloudflare upload lifecycle, queue jobs, authentication failures, cache invalidation and DB errors without secrets.
- Clear user-visible toasts/field errors, retry behavior, loading skeletons, stale status indicators, a11y announcements, and safe failure recovery.
- Health/readiness endpoint restricted appropriately, dashboard for operational counts (failed jobs, orphan uploads, publish errors, queue lag).
- Retry external calls with bounded exponential backoff; set hard timeouts and idempotency; circuit break recurring failures without data corruption.
- Migration sequencing (expand/migrate/contract), staging rollout, rollback and disaster recovery documentation. Make background jobs deploy-safe.
- Retention and pruning for audit logs and failed uploads based on documented policy; don't silently delete critical compliance history.
- Logging and alerting thresholds with recommendations, not fictitious uptime claims.

# 15. DOCKER, LOCAL ENVIRONMENTS, DEPLOYMENT, AND CI/CD

Local setup on Windows (Docker Desktop + WSL2 if appropriate) should be reproducible:
- Install pinned Node LTS compatible with Next.js 16, pnpm via Corepack, Docker Desktop, Supabase CLI as workspace dependency.
- `pnpm install`, `pnpm supabase:start` or equivalent, apply migrations, seed safe synthetic data, generate types, `pnpm dev:admin`.
- Compose optional local Next.js admin service and supporting tools; use `supabase start` to run Supabase's own Docker-managed local stack. Avoid spinning up an accidental second Postgres/Auth stack in Compose with conflicting ports and divergent schema.
- Multi-stage Dockerfile with nonroot runtime user, explicit build-time/runtime variables, health check, small image and appropriate standalone output where relevant.
- Secrets outside image, no production secrets in local seed; Cloudflare direct upload can be integration-tested against test/dev account or securely mocked adapter, not represented as tested live if keys are unavailable.
- Environments: local, preview/staging, production; distinct Supabase projects, Cloudflare credentials/namespace, hostnames and separate preview secrets where possible.
- GitHub Actions lint, typecheck, formatting, unit tests, DB reset/migrate/policy tests, integration tests, build, optional Playwright smoke, dependency/security scans, migration diff/review gate.
- Production DB migration executed with explicit approval and backup strategy, separate from untrusted PR CI. Deploy admin independently from future public app.
- Document production env variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only Supabase secret if unavoidable, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_HASH`, `SENTRY_DSN`, `INTERNAL_CATALOG_REVALIDATE_SECRET`, etc.) without writing literal values.
- README with exact quickstart, troubleshooting, migration commands, rollback instructions, Docker commands, worker schedule setup, deployment checklist and troubleshooting.

# 16. TEST STRATEGY AND PROOF OF COMPLETION

Tests must be executable and report results. Build:

Unit / validation: units and conversions, formatting, variant matrix, dynamic spec schemas, price windows/tiers, slug/code rules, permission helpers, safe DTO projection.

Supabase integration / SQL: all 28 core entities, FK/cascade, category cycles, unique SKU/default variant, attribute type/value/option mismatch, publish validation, fiber total, non-overlapping prices and tiers, exact scoped grants/RLS, failed multi-table transaction rollback, atomic audit log, role revocation, document privacy.

Upload integration: one-time upload token requires admin permission; fake/foreign Cloudflare ID cannot attach; malformed file rejected; callback signature validated; retries/idempotency; failed image cleanup; no leaked token. Use safe provider mocks unless configured for real test account.

E2E Playwright: login; role restrictions; create product draft; assign category/brand; add multiple SKUs/variant attributes/pricing/tiers; upload image; assign primary; attach document; save; publish; edit; archive; restore; delete; public published projection contains permitted items only; invalid anonymous write blocked; mobile/tablet admin usability; expired session and errors.

Security: unauthenticated mutation, escalation, admin user impersonation, RLS bypass attempts, direct RPC access with `anon`, draft URLs, private document paths, SQL and XSS payloads, CSRF, unauthorized image deletion, concurrency conflicts.

Performance: representative query plans, fixture volume and measured latency, long lists, filters, image payload, bundle analysis, and at least one repeatable load script with recorded environment.

Definition of Done: no critical/high security findings, no test bypass, no TypeScript build errors, no broken navigation or CRUD pathways, all migrations repeatable on clean local Supabase, all roles validated, data appears correctly in database after save, real images saved to Cloudflare if live integration configured and URLs/IDs correctly persisted, and clean redeploy from repo documented. If a live Cloudflare/Supabase service isn't configured, explicitly label the affected integration unverified and deliver tested mocks/contracts plus exact verification steps.

# 17. PHASED BUILD ORDER — IMPLEMENT, DON'T STOP AT DOCUMENTATION

Phase 0 — Audit and implementation plan: inspect paths; create schema/UI audit, threat model baseline, ADRs, architecture diagram, implementation task checklist; identify blocked credentials and risks. Do not destroy existing code.

Phase 1 — Foundation: monorepo, Next.js 16 admin app, TypeScript, Tailwind/shadcn, responsive shell, Docker/Supabase local dev, configuration, lint/format/test tools, generated types, auth SSR setup.

Phase 2 — Database + security: complete 28-entity migrations, missing constraints, safe extensions, indexes, roles/grants/RLS, privileged function controls, seeding, SQL integration tests and role lifecycle.

Phase 3 — Admin masters: category tree, brands, units, attributes/options/mappings, industries/applications/certifications/fibers/equipment models. Finish real CRUD before proceeding.

Phase 4 — Product engine: product list/filter/search, draft creation, editor, variant matrix, typed specs, pricing windows/tiers, packaging, fiber composition, equipment compatibility, validation/publishing, audit and optimistic concurrency.

Phase 5 — Media and docs: Cloudflare direct upload + verified attach and lifecycle, Supabase Storage docs with privacy and linked relationships, responsive previews.

Phase 6 — Async + future catalog contract: queues, Cron/Edge consumer, reconciliation, cache invalidation protocol to separate future public app; secure read-only DTO contracts and tested RLS; do not build public UI.

Phase 7 — Hardening: Playwright, load/RLS tests, Sentry, security review, backups, CI/CD, Docker release verification, comprehensive README/operations docs, polished responsive UI and accessibility QA.

Complete each phase with executable code, test evidence, and a changelog. Do not skip unfinished critical work and announce production readiness.

# 18. ARTIFACTS YOU MUST PRODUCE

Create or update at minimum:
- Working `/apps/admin` with every required module and polished reference-consistent UI.
- Versioned Supabase migrations, policies/grants, RPC and SQL integration tests, generated TS types.
- Secured Cloudflare Images integration and Supabase document workflows.
- Queue/cron jobs and audit/cleanup where justified; functioning demo with mocks if external secrets absent.
- Shared DTO types/Zod validators/typed data clients.
- `docs/architecture/system-overview.md` with Mermaid sequence/dataflow diagrams, schema audit and entity map.
- `docs/architecture/cache-and-invalidation.md` including cross-app mechanism, cache matrix and recovery.
- `docs/security/threat-model.md`, `docs/security/rls-policy-matrix.md`, `docs/security/secrets-and-auth.md`.
- `docs/architecture/cloudflare-image-lifecycle.md`, `docs/architecture/worker-and-outbox.md`.
- `docs/operations/runbook.md`, backup/restore policy, deploy/rollback checklist.
- Environment setup example, Dockerfile/Compose, CI/CD, seed scripts, runnable tests, README.
- `docs/implementation-status.md` tracking done/partial/blocked items with specific files and evidence.

# 19. HOW TO REPORT AS YOU WORK

At the start, report (briefly) source files found, schema gaps, reference UI findings, risks, and the precise next implementation step. Then write code. At each milestone report:
1. Files created/changed and why.
2. Migrations applied, functions/policies implemented, and affected tables.
3. Tests and build commands executed, with actual pass/fail results (never fabricate).
4. Security/access assumptions, unresolved issues and required credentials.
5. Exact next step and any blocking access issue.

If the project is too large for one execution, finish the most foundational working vertical slice and persist a precise state/checklist. Do not replace implementation with generic advice, unnecessary follow-up questions, static UI images, or pretending integrations work without credentials. Any unverified dependency must be clearly labeled.

# 20. FIRST ACTION — EXECUTE NOW

1. Locate and read `D:\Project\ann traders\database-design.md` and the actual `D:\Project\ann traders\reference admin panel` contents. If this environment cannot access Windows files, say precisely which paths are missing and use the attached source text/repository files that are actually available; never invent file contents.
2. Inspect existing project files and package versions.
3. Audit all 28 entities and produce a prioritized, justified migration list (especially RLS/grants, attributes, pricing, publish validation and Cloudflare media model).
4. Define the monorepo boundaries, backend read/write/privileged paths and secure public read-only contract.
5. Create the monorepo foundation, Supabase local development configuration, app shell and first schema/security migrations; run typecheck and database tests.
6. Continue through the implementation plan toward a complete production-grade admin panel. Do not build the public customer frontend yet.

---

## OFFICIAL API / OPERATIONAL REFERENCES TO VERIFY AGAINST INSTALLED VERSIONS

- Next.js 16 caching: https://nextjs.org/docs/app/getting-started/revalidating
- Next.js 16 proxy: https://nextjs.org/docs/app/getting-started/proxy
- Supabase local CLI / Docker: https://supabase.com/docs/guides/local-development
- Supabase SSR Auth: https://supabase.com/docs/guides/auth/server-side
- Supabase RLS / grants: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase functions / privileges: https://supabase.com/docs/guides/database/functions
- Supabase Queues: https://supabase.com/docs/guides/queues
- Supabase Cron: https://supabase.com/docs/guides/cron
- Cloudflare Images direct creator upload: https://developers.cloudflare.com/images/storage/upload-images/direct-creator-upload/
- Cloudflare Images delivery URLs: https://developers.cloudflare.com/images/optimization/hosted-images/serve-uploaded-images/

End of master engineering prompt.
