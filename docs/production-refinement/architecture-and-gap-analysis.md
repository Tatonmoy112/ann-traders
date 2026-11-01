# Existing architecture and gap analysis

Review date: 2026-11-01, Asia/Dhaka. This is a source/local-database assessment, not a certification of the hosted project.

## Sources and scope

The supplied pack contains seven files: README, database blueprint, implementation brief, Mermaid ERD and three SQL audit/index proposals. All were read. Its references to `reference/attribute_matrix.csv` and `03_CLAUDE_IMPLEMENTATION_BRIEF.md` do not match supplied files: the matrix is absent and the actual brief is `03_AIDLC_IMPLEMENTATION_BRIEF.md`. No business dictionary was invented or applied to an existing catalog.

The repository initially contained **18 migrations**, including public catalog and legacy inquiry migrations beyond the pack's reported 001–014 baseline. The eleven new migrations follow the existing timestamp convention. Original migrations remain unchanged. Existing architecture/security/operations/verification documents were treated as historical evidence and checked against source. Earlier verification counts and statements that there is no customer UI are stale.

## Retained architecture

| Layer        | Implementation                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployments  | Independent Next.js 16.4.3 admin/client apps; pnpm/Turborepo shared workspace                                                                                   |
| Domain       | 28 normalized catalog/admin/audit entities; existing private outbox; legacy private inquiries retained                                                          |
| Authoring    | Supabase SSR identity, active profile lookup, editor/admin/super-admin permissions, elevated-role AAL2                                                          |
| Transactions | Guarded aggregate/relation/lifecycle RPCs, product revision locks, immutable price amounts, audit triggers                                                      |
| Images       | R2 conditional staging PUT, Sharp verification/re-encoding, immutable manifests, leases and durable cleanup; existing Images assets retained                    |
| Documents    | Private `catalog-documents` bucket, verified administrator PDF uploads, short-lived private admin links                                                         |
| Public reads | Anonymous key, owner-evaluated security-barrier projections, bounded card selection, server rendering, 30-second rotating cache keys and live visibility checks |
| Operations   | Versioned SQL, CI application/Supabase jobs, Docker configuration, worker source and staging/runbook tooling                                                    |

## Verified discrepancies and repairs

| Finding in actual source                                                                                                            | Change                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Public SKU/model/MPN search absent                                                                                                  | Bounded discovery searches active variant identifiers and ranks exact codes/SKUs first                       |
| Category matching was direct-only                                                                                                   | Active descendants and additional category placements participate; unknown slugs still return zero           |
| Product-level specs absent from detail                                                                                              | Safe typed product specs, composition and equipment information reach the public UI                          |
| Technical filters absent from active catalog page                                                                                   | Configured numeric/option/boolean/text filters; multiple variant filters must match one SKU                  |
| Attribute units/applicability incomplete                                                                                            | Typed, active, scoped, inherited-rule and unit-family validation; canonical axis duplicate review            |
| Missing/null revisions could bypass SQL comparisons                                                                                 | Explicit direct-RPC shape checks and `IS DISTINCT FROM` revision checks                                      |
| Replacement price depended on JSON array order                                                                                      | Validate all history, deactivate superseded rows, then append replacements atomically                        |
| Price dates lost microseconds through JS Date serialization                                                                         | Preserve source timestamps; normalize only the UTC input's visual presentation                               |
| Document delete removed binary before DB validation                                                                                 | Audited draft/revision-checked metadata/retirement RPC; source files and history retained                    |
| Duplicate route used many independent privileged writes, ignored some errors and copied foreign certificate links                   | One authenticated atomic duplication RPC with fresh identities and independent evidence review               |
| Multipart origins accepted localhost substrings/preview suffixes; master upload lacked bounded parsing and passed SVG bytes through | Exact origins, bounded streams and decoded/re-encoded raster uploads                                         |
| Admin worker acknowledged catalog events without delivery                                                                           | Delegate to the authoritative Edge consumer; failures retain retry state; signed public cache receiver added |
| Initial lint failed                                                                                                                 | Fixed unused imports, effect-driven state resets, stale fetch handling and raw image elements                |
| Original pgTAP core count included the legacy inquiry table                                                                         | Count the 28 core entities explicitly; add refinement privilege checks                                       |
| Windows reserved the default browser double ports                                                                                   | Optional test-port overrides; no OS networking configuration changed                                         |

## Change impact and compatibility

No category-specific tables, customer identities, cart/order/payment modules or public inquiry writes were added. The sole new stored column is nullable `product_documents.retired_at`. Existing RPC signatures and the nine-argument card RPC remain available. New read/write functions have explicit grants. Old source files, identifiers, price amounts/windows, audit and media references survive the upgrade rehearsal unchanged.

Inherited rules can reveal missing specifications in existing drafts or prevent their next publication. Existing values are not deleted, converted or backfilled. Use the quality review before rollout and correct records through the guarded editor. Duplication intentionally starts a new draft with current/future active prices, specifications and classification; media, files and certification evidence require independent attachment/review.

## External and business gaps

Hosted migration ledger/schema, real Auth/MFA/email, Storage policies, R2/CDN configuration, worker scheduling and backup restoration still need approved staging evidence. The supplied dictionary matrix, approved category content, tax/quotation policy, RPO/RTO and production latency thresholds remain business/operator inputs. These are release gates, not tests claimed to have passed locally.

The public root layout also now renders an absent media preconnect as null. An empty environment value previously introduced a head text node, hydration failure and broken soft navigation; production-browser checks explicitly reject runtime/hydration errors.
