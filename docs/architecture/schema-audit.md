# Source schema audit

Audited 2026-10-24 against `database-design.md` and the production master prompt. No existing application, migrations, or root Git repository was found. Both implementation directories are empty. Reference directories are independent source examples and will not be modified.

## Entity map and ownership

All core rows belong to ANN Traders. UUID primary keys default to `gen_random_uuid()`. Join tables retain their composite keys. No tenant or customer ownership is implied. Authenticated, active editors read catalog data and edit drafts; active admins manage dictionaries and lifecycle; only super admins manage other administrators. Anonymous access is limited to a safe published projection. Audit data is append-only through triggers.

| Supplied entity | Relationships / delete behavior | Keys and indexes / production gaps |
|---|---|---|
| categories | Recursive parent RESTRICT; products RESTRICT | Folded slug unique; parent FK index and explicit sort field; cycle/depth guard |
| brands | Products/equipment RESTRICT | Folded slug unique; add URL/country checks |
| units | All quantity and measurement references RESTRICT | Folded code unique; positive conversion factor; GSM measurement family |
| products | Primary category/brand RESTRICT; creator/updater RESTRICT | Folded code/slug unique; category/brand/status/update/search indexes; soft delete only |
| product_extra_categories | Product CASCADE; category RESTRICT | Composite PK; reverse FK index |
| product_variants | Product CASCADE; units RESTRICT | Folded SKU unique; product index; unique active default; positive quantities |
| attribute_definitions | Unit RESTRICT | Folded code unique; constrained type |
| attribute_options | Attribute RESTRICT | Attribute/value unique; composite option/attribute key |
| category_attributes | Category/attribute RESTRICT | Composite category/attribute/scope PK; required scope rules |
| product_attribute_values | Product CASCADE; attribute/option/unit RESTRICT | Owner/attribute indexes; exactly one typed field; option ownership and cardinality guard |
| variant_attribute_values | Variant CASCADE; attribute/option/unit RESTRICT | Same typed rules; typed filter indexes |
| variant_prices | Variant RESTRICT; unit RESTRICT | Numeric shape checks; active time exclusion by variant/currency/unit/term |
| price_tiers | Price CASCADE; unit RESTRICT | Quantity exclusion per price; positive price/quantity |
| variant_packaging | Variant CASCADE; unit RESTRICT | Positive packs; at most one default |
| product_media | Product CASCADE; optional variant same product | Add provider asset ID, verified state, metadata; primary uniqueness |
| product_documents | Product CASCADE; optional variant same product | Add private bucket, verified metadata; default private; no stored signed URLs |
| industries | Product links RESTRICT | Folded slug unique |
| product_industries | Product CASCADE; industry RESTRICT | Composite PK plus reverse FK index |
| applications | Product links RESTRICT | Folded slug unique |
| product_applications | Product CASCADE; application RESTRICT | Composite PK plus reverse FK index |
| certifications | Product links RESTRICT | Folded name unique |
| product_certifications | Product CASCADE; certification RESTRICT; document same product | UUID PK; expiry retained; deduplication by product/certification/number remains a refinement |
| fibers | Variant links RESTRICT | Folded code unique |
| variant_fiber_composition | Variant CASCADE; fiber RESTRICT | Composite PK; 0–100; required-category sum at publish |
| equipment_models | Brand RESTRICT | Brand/model unique |
| variant_equipment_compatibility | Variant CASCADE; equipment RESTRICT | Composite PK and reverse FK index |
| admin_profiles | Auth user RESTRICT | Auth UUID PK; constrained role; no implicit enrollment |
| audit_logs | Actor RESTRICT | Entity/time and actor/time indexes; immutable to app roles |

Supplied design declares RLS, timestamps, search, unique scalar attributes, non-overlapping tiers, and publication filtering as requirements, but supplies no executable policies, triggers, SQL, or migration history. These are implementation gaps, not evidence of a compromised existing database.

## Proposed changes

| Severity | New implementation / recommendation | Justification | Compatibility impact |
|---|---|---|---|
| Critical | Explicit grants, RLS, private role helper, guarded write functions | Prevent anonymous writes and stale-role access | Anonymous normalized-table reads intentionally removed |
| Critical | Transactional draft save and lifecycle RPC, row lock and revision | Atomic relationship edits and concurrency | Additive revision; drafts may omit category and variants |
| High | Publication validation plus draft-only child writes | Published invariants must survive later edits | Edit published products by unpublishing first |
| High | Typed attribute triggers and composite option FK | Prevent cross-attribute and malformed data | Invalid source-like values rejected |
| High | Price/time and tier/quantity exclusion constraints | Avoid ambiguous active quotes | Price corrections append history; deactivate superseded periods |
| High | Private document bucket and access-time authorization | Public buckets cannot retract documents on unpublish | `is_public` defaults false, intentional safer change |
| High | Cloudflare provider IDs, staging ownership and verified attach | URLs alone cannot establish ownership | Existing `external_url` retained for compatibility |
| High | Immutable audit trigger with sanitized payloads | Trace catalog/role changes | No app update/delete grants |
| Medium | Category depth 8 and cycle serialization | Defensible tree, concurrent reparent safety | Deeper hierarchies rejected |
| Medium | Explicit composition requirement on category | Sum only applicable fabric variants | Additive category flag |
| Medium | NUMERIC strings at API boundary | Avoid JS floating-point currency math | Forms transmit decimals as strings |
| Medium | Transactional outbox | Recover future invalidation and cleanup | Internal additional table, no anonymous grants |

Rollback: migrations target a new local/development schema only. For a disposable local database use `supabase db reset`; on an existing deployment take a backup and write forward corrective migrations. Never drop a live schema to roll back. Indexes add write overhead; no latency targets are claimed until measured. Product/variant names and historical pricing stay intact.

Assumptions: BDT/USD initially; unit conversions only within equal families; GSM belongs to areal-density, never sale quantity. Publishing requires a primary verified image and one current price (including on-request) per active variant. No live catalog records or competitor images/prices will be seeded. MFA and external integrations require configured test accounts; unfinished enforcement must be tracked explicitly.
