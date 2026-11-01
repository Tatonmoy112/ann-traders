# Database refinement and entity documentation

## Existing entity map

| Concern          | Retained tables                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Taxonomy         | `categories`, `brands`, `units`                                                              |
| Product/SKU      | `products`, `product_extra_categories`, `product_variants`                                   |
| Typed dictionary | `attribute_definitions`, `attribute_options`, `category_attributes`                          |
| Typed values     | `product_attribute_values`, `variant_attribute_values`                                       |
| Commercial       | `variant_prices`, `price_tiers`, `variant_packaging`                                         |
| Assets           | `product_media`, `product_documents`                                                         |
| Usage            | `industries`, `product_industries`, `applications`, `product_applications`                   |
| Evidence         | `certifications`, `product_certifications`                                                   |
| Textile/fit      | `fibers`, `variant_fiber_composition`, `equipment_models`, `variant_equipment_compatibility` |
| Administration   | `admin_profiles`, `audit_logs`                                                               |

`private.outbox_events` is an operational ledger. `public.inquiries` is an existing private legacy module, not a new customer submission feature. The original pack ERD remains a useful domain map. The generated [schema inventory](schema-inventory.json) contains actual local columns, constraints, indexes, grants, view/function definitions, owners and RLS.

## Additive migration map

| Suffix                                                  | Purpose                                                                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `20261101000100_catalog_integrity`                      | Closest-category rule resolution, typed units/applicability, axis signatures, publication/dictionary checks, legacy MFA policy alignment |
| `20261101000200_atomic_authoring`                       | Null-safe revisions, bounded RPC inputs, row identity checks, MPN/features/order persistence, order-independent price replacement        |
| `20261101000300_document_lifecycle`                     | Nullable retirement timestamp and audited metadata/retirement transaction; safe public document predicates                               |
| `20261101000400_public_catalog_discovery`               | Descendants, additional placements, SKU/model/part search, typed filters, cursors, facet metadata, safe detail specs/composition/fit     |
| `20261101000500_commercial_history`                     | More measurement families, canonical trade contexts, publication-frozen tiers                                                            |
| `20261101000600_atomic_duplication`                     | All-or-nothing authenticated catalog copying with new IDs and original audit behavior                                                    |
| `20261101000700_asset_assignment_and_dictionary_guards` | SKU image assignment and protection of referenced option/specification semantics                                                         |
| `20261101000800_measured_catalog_name_index`            | Measured partial `(name,id)` index; bounded lock/statement budgets                                                                       |
| `20261101000900_detail_visibility_plan`                 | Remove a measured redundant catalog-wide visibility join from unique-slug reads; retain the identical publication predicate              |
| `20261101001000_finite_catalog_numbers`                 | Validate finite values in all existing public NUMERIC columns; reject NaN and infinities without rewriting data                          |
| `20261101001100_publication_dictionary_serialization`   | Serialize publication with definition/choice edits and protect mapped optional semantics even without stored values                      |

## Catalog rules

Products represent marketed families. Active variants represent actual SKUs, including a default SKU for ordinary software/service listings. Folded code/SKU uniqueness and existing archival identity protection remain. Publication requires an active default, current price/request quote, active primary category, ready public-eligible primary image and required technical values. Declared fiber mixtures must total exactly 100%; GSM is never a sale/MOQ/price unit.

Technical rules resolve **primary category → ancestors**, depth at most eight. The closest `(attribute, product-or-variant scope)` mapping overrides its ancestor's requiredness/order. Extra categories affect discovery only. A required ancestor rule can therefore be explicitly overridden by a child mapping. Axis values are required for configured variant axes; duplicate active axis signatures are rejected at publication, including safely convertible numeric units. Text signatures trim/fold case; controlled choices use IDs. Products without configured axes can have manually named distinct SKUs.

The final publication trigger locks ancestors, then referenced choices, then mapped/referenced definitions before rechecking. Choices come before their parent definitions to match the option editor's lock order. A concurrent deactivation therefore commits before validation or waits until publication and is rejected. Optional mappings without stored values also block incompatible semantic changes after publication; descriptive label corrections remain allowed.

Exactly one typed representation is retained per scalar value; multi-select uses separate distinct option rows. Units belong only to numeric attributes, default to the declared unit and must match its active family. A unitless numeric definition requires a unitless value. Select choices must belong to the definition and be active. Existing nonconforming rows remain available to operators for correction and block publication rather than being silently transformed.

Mass, length, volume, count, area, areal density, power, electric potential, frequency, time, temperature and ratio remain separate families. No roll-to-metre, roll-to-kg, box-to-piece or affine temperature conversion is inferred. Only declared linear factors support numerical normalization; temperature conversion is rejected by the quantity conversion helper.

Migration `20261101001000_finite_catalog_numbers` adds validated finite-number constraints to every existing public NUMERIC base-table column. PostgreSQL NaN can satisfy ordinary positive checks; NaN and infinities are explicitly rejected for quantities, prices, factors and specifications. Existing invalid data causes the migration to fail atomically for operator review; no value is rewritten.

## Prices and history

Amounts stay PostgreSQL NUMERIC and API strings. Fixed/range amounts must be positive, ranges ordered, quote-only amounts null, windows `[from,until)`, and tier quantities `[minimum,maximum)`. Tiers use exactly the price unit. Existing currency/trade/unit/time exclusion constraints remain; a serialized canonical-context guard also handles trade-term case/whitespace.

Saved amounts/windows are immutable. Corrections deactivate and append; array ordering cannot cause replacement overlap. Tiers belonging to prices at or before the retained publication timestamp are frozen, even after withdrawal. The same rows can be resubmitted without changing their timestamps. Prices introduced afterward can receive tiers before their next publication. A draft intentionally given a historic `published_at` by an operator must be reviewed as history, not treated as a new price editor.

Cards combine only effective numeric prices with one coherent currency, price unit and trade term, covering all active variants. Mixed contexts, missing effective prices and request-only variants produce “Price on request.” Numeric minima across kg/roll or BDT/USD are never invented. VAT inclusion is not assumed; the public UI asks buyers to confirm taxes, transport and quotation terms.

## Public and document contracts

Raw normalized tables remain unavailable to anonymous callers. Existing public views retain their intentional migration-owner evaluation and security barriers. Discovery returns at most 25 card rows (24 plus a look-ahead), whitelisted sorts and a stable UUID tie-breaker. Cursors retain ranking/sort/direction/value/ID; the legacy bounded offset contract remains compatible. Technical filters are limited to eight and variant predicates must be satisfied by the same active SKU. Facet configuration is capped at 32 definitions and 100 choices per definition; the UI presents up to eight controls.

Details return at most 100 variants, 100 document references and 100 images. Product/variant specifications and relationships follow the editor's 500-row limits. No storage path, source object manifest, actor, role, audit payload or outbox data enters these public DTOs. Public image keys are canonical generated delivery keys, not private staging keys.

Documents retire under a parent product lock and expected revision. Referenced certificate evidence must be unlinked before retirement. Files remain private and retained. Optional public download uses a dedicated read-only Edge function: it checks anonymous document visibility, reads the private file server-side, verifies bounded PDF bytes and rechecks visibility before delivery. The public Next app holds only the anonymous key and receives bytes, never private paths or signed URLs. Enable this only after real Storage/Edge staging verification.
