# ANN Traders — Architecture and Performance Remediation Brief
**Prepared:** 31 October 2026\
**Project:** Two-deployment B2B textile, RMG and industrial supply product catalog, Bangladesh\
**Repository reviewed:** https://github.com/Tatonmoy112/ann-traders/\
**Scope:** Source-level audit and recommended fixes; no production URL, browser waterfall, or production Supabase query trace was provided. **Do not interpret this brief as a live performance benchmark.**

## 1. Executive decision
Retain separate `apps/admin` and `apps/client` deployments and a single Supabase Postgres source of truth. Convert the public catalog to server-rendered/cached product discovery with narrow public read projections. Do not introduce another general-purpose backend, queue, Elasticsearch, Redis or paid infrastructure solely for initial performance tuning. Supabase queries still power the customer website, but they should not force initial content to wait for browser hydration.

**Important repository documentation discrepancy:** The root README and `apps/client/README.md` describe a future customer catalog, but the current source repository includes a functioning `apps/client` Next.js app, including `/`, `/products`, `/products/[slug]` and `/api/catalog/*` routes. Update README to match the implementation.

## 2. Confirmed code findings (all require production testing)
| Finding | Source | Assessment / action |
|---|---|---|
| The homepage renders client-side catalog components using TanStack `useQuery`; visitors see spinners while categories, featured products and new arrivals load. | `apps/client/src/components/home/{category-showcase,featured-products,new-arrivals}.tsx` | High; move initial data to cached async server functions/components. |
| Product listing and detail pages are full `'use client'` pages that fetch initial catalog data after JavaScript initializes. | `apps/client/src/app/products/page.tsx`, `apps/client/src/app/products/[slug]/page.tsx` | High; server-load initial content, keep small interactive client islands. |
| Public list API selects long description and all product media/manifests and asks for exact count each request. | `apps/client/src/app/api/catalog/products/route.ts` | High; create compact listing projection, primary image only; measure exact-count costs. |
| Public product API performs dependent rounds: product -> media/variants/docs -> prices/specs -> tiers. | `apps/client/src/app/api/catalog/products/[slug]/route.ts` | Medium; create one bounded published-detail read model or benchmark a carefully designed RPC. |
| Public server client picks service-role credential if present. | `apps/client/src/lib/supabase.ts` | Security priority; do not bypass RLS for public display. |
| Core table access is supposedly denied to anonymous users while published-only public views already exist; current customer APIs query normalized core tables. | `docs/security/rls-policy-matrix.md` and public API routes | Security/architecture mismatch; use `public_catalog` views with publishable key and configured schema exposure. Preserve intentionally owner-evaluated limited views unless a security review changes their trust contract. |
| Category/brand lookup returns entire lists; category `?tree=true` request is ignored by current category route. | `apps/client/src/app/api/catalog/categories/route.ts` | Fix response shape/contract; cache categories. |
| Invalid category/brand slug fails lookup, then the public product API returns unfiltered products. | `apps/client/src/app/api/catalog/products/route.ts` | Correctness bug; return empty result, not full catalog. |
| Product list UI promises price discovery but cards currently show a generic “Volume Tier Pricing” label, not real unit prices. | `apps/client/src/components/catalog/product-card.tsx` | Business-critical: add public effective display-price summary. |
| RFQ form posts data into Supabase and returns success even if insertion fails. | `apps/client/src/app/api/catalog/inquiry/route.ts` | Conflicts with specified read-only customer portal. Remove RFQ persistence if strict read-only; otherwise obtain explicit scope approval and fix false-success handling. |
| Marketing strings include specific years, factory counts, guaranteed delivery and certification claims. | `apps/client/src/components/home/hero-banner.tsx` | For a newly launching business, replace unsupported metrics with verified facts, admin-managed copy or neutral capabilities. |
| HTML API routes lack explicit shared cache strategy. | `apps/client/src/app/api/catalog/products/route.ts`, categories route | Add Next.js data caching plus carefully designed revalidation, and test shared-cache behavior. |
| R2 thumbnail/card/detail WebP generation is already implemented on admin media path. | root `README.md` | Preserve existing image pipeline. Optimize public presentation and CDN configuration instead of redoing media architecture. |

**Existing local benchmark:** `docs/verification/performance.json` reports admin SQL list p95 of 10.2 ms (500 products), 23.3 ms (5,000), 72.6 ms (20,000). These are single-client warm local SQL query timings, NOT production network/API/browser timings.

## 3. Target architecture
```
Admin.example.com (private Next.js admin)
  -> Supabase Auth (MFA / roles / guarded admin operations)
  -> normalized Postgres catalog + transactional product publication
  -> image upload processing to Cloudflare R2
  -> audited publication / withdrawal event
                             |
                             v
                   single Supabase database
                     published-safe views
                             |
                             v
www.example.com (public Next.js catalog)
  -> cached Server Components (home, categories, listing, detail)
  -> publishable key with restricted SELECT on published-only projections
  -> R2 CDN immutable small/medium/large images
  -> small client islands only for search controls, variant selector and gallery
```
A public read-only catalog can still use Next.js server rendering because the website only READS from Supabase and sends HTML to users. Avoid fetching initial products in a mount-time `useEffect` / `useQuery` unless hydrated with prefetched data.

## 4. Implementation work packages (execute in order)

### P0 — Secure the public boundary before adding caches
1. Audit grants, RLS and views in the deployed Supabase project; check exposed schemas in PostgREST.
2. Modify `apps/client/src/lib/supabase.ts` to require ONLY the public publishable key, never fall back to the service-role key. Remove public service-role environment configuration. Keep any privileged operations outside this public catalog app.
3. Replace `.from('products')`, `.from('categories')`, `.from('brands')`, `.from('product_media')`, etc. in public read handlers with appropriately shaped **published-only read projections**. Existing `public_catalog.products`, `public_catalog.variants`, `public_catalog.documents` are a starting point; extend via reviewed migrations as necessary, rather than granting anonymous SELECT on normalized admin tables.
4. Confirm anonymous visitors cannot read a draft, retired item, private image path, customer details, audit, admin profiles, or unpublished price.
5. Be careful: the repo intentionally uses owner-evaluated restricted public views because anonymous users cannot read core tables. Do not mechanically switch existing views to `security_invoker` without reworking their grants and verifying behavior.

### P1 — Fast first paint (highest perceived speed gain)
1. Turn `apps/client/src/app/page.tsx` into an async Server Component with `Promise.all` for the catalog's initially visible data.
2. Move initial category, featured and new-arrival data queries from their client widgets to server-only cached functions. Render product cards from server-provided props.
3. Turn `apps/client/src/app/products/page.tsx` into a server wrapper receiving `searchParams`, loading the first 12 cards on the server and passing filter state to a small client component.
4. Turn `apps/client/src/app/products/[slug]/page.tsx` into a server-loaded product detail. Leave variant selection, gallery and interactive controls as client components.
5. Use Next.js 16 `cacheComponents: true` + `use cache` + `cacheLife`/`cacheTag`, or another consciously benchmarked caching arrangement. Follow official Next.js 16 semantics: https://nextjs.org/docs/app/api-reference/directives/use-cache
6. Remove unnecessary page-level spinner states for already prefetched initial data; retain skeletons for navigation/filter transitions. Add standard metadata and canonical URLs per published product.

### P2 — Lean and correct public data contracts
1. Introduce `public_catalog.product_cards` (or equivalent bounded published view) containing only product id, slug, name, code, primary category, brand, concise summary, card image URL, display pricing data, and flags.
2. Keep detail-heavy descriptions, gallery, variants, quantity-break pricing, packaging, TDS/SDS/certification references in a separate detail read.
3. Use selective columns, exact sort tie-breakers, bounded pagination (12–24), and proper category/brand filter behavior. An unknown slug must yield zero results rather than unfiltered products.
4. Compute effective public prices by considering `is_active`, `valid_from`, `valid_until`, variant and quantity unit, currency and whether the price is fixed/range/on-request. Hide expired prices and do not publish an incorrect numeric price.
5. Avoid exact `count` on every visit unless needed for UX. Compare an estimated count, separate cached total, or `pageSize+1` lookahead under appropriate pagination UX. Measure EXPLAIN ANALYZE before adding indexes.
6. Reduce dependent database roundtrips on detail reads using a reviewed joined projection / bounded SQL function where it improves measured latency.
7. Add category and brand response caching and make `tree` query parameter behavior match the documented response schema.

### P3 — Media / CDN
1. Keep admin generation of 320px, 768px and 2000px WebP assets. Verify content hashing, card/detail selection and long-lived caching with immutable URLs.
2. Configure production R2 custom domain with CDN; do not treat `r2.dev` as production CDN. Verify CORS/security and rollout in staging.
3. Set explicit dimensions, responsive `sizes`, and a priority/eager image only for the visual LCP element. Keep below-fold media lazy.
4. Audit product cards for broken images and test slow 4G/mobile; measure image transfer size, not only source dimensions.

### P4 — Publication and cache invalidation
1. Admin publishing should update Supabase transactionally and emit the existing durable outbox event.
2. Implement authenticated/signed delivery to a public-app invalidation endpoint; verify HMAC signature, replay protection and event revision before applying `revalidateTag` for normal catalog edits.
3. Archived/withdrawn products require a stricter visibility/TTL strategy than ordinary stale-while-revalidate. Never allow unauthorized private records to be cached.
4. As an MVP, start with a documented short public revalidation TTL and manual emergency cache purge; add signed event-based invalidation as part of production acceptance.

### P5 — Align functional scope
1. The user requested a strictly read-only customer app. Remove the public `/api/catalog/inquiry` POST and in-app RFQ submission, or get explicit business approval to change scope. A WhatsApp/email link can preserve contact without writing to the application's Supabase database.
2. If RFQ is later approved, store submissions through a separately protected and rate-limited workflow, return errors when inserts fail, and use a durable distributed rate limiter instead of memory-only limiting on serverless infrastructure.
3. Replace unsupported claims of years in business, client counts, certifications, MOQ discounts and dispatch times before showing the site to buyers.

## 5. Business/product data model for Bangladesh's B2B supply market
A single flat SKU/price is inadequate across textiles and apparel industrial supply. The existing 28-entity normalized schema is a strong foundation. Keep category-specific attributes and price units.

| Category | Example attributes / variants | Quote units |
|---|---|---|
| Woven, knit, denim and other fabrics | Composition, GSM, width, weave/knit construction, finish, color/shade, origin, MOQ | meter, yard, kg |
| Marker/plotter/pattern paper | GSM, roll width, roll length, core size, color, perforation, machine compatibility | roll, kg, ream |
| Yarn | Fiber blend, count (Ne/Nm/denier), ply, combed/card, color, cone/lot, origin | kg, MT, cone |
| Dyes and textile chemicals | Chemical family, application, manufacturer, pack size, batch, TDS/SDS, storage/safety data | kg, liter, drum |
| CAD/CAM, machinery and spares | Brand, model number, compatible machine, dimensions, power, warranty, origin | piece, set, machine |
| Labels, trims and packaging | Material, width/size, thickness, color, finish, printing, pack quantity | piece, roll, carton |
| Industrial safety and testing | Standard, use case, size, part number, certification and expiry where applicable | piece, box, set |

Price policy: BDT/USD per stated unit, fixed/range/on-request, MOQ and quantity breaks, quotation validity, tax and transport inclusion, trade terms where applicable. Never infer price by multiplying incompatible units or advertise a quote as a guaranteed checkout price.

## 6. Reference market sites: patterns worth borrowing
- **Fabrix**: woven/knit/denim category presentation. https://fabrix.com.bd/
- **Odyssey**: deep CAD/CAM paper/consumable taxonomy. https://www.odyssey-bd.com/
- **Rukon Marker Paper**: simple, understandable product discovery for marker paper and cutting supplies. https://rukonmarkerpaper.com/
- **Paramount**: machinery model and subcategory organization. https://paramountbdm.com/
- **Smart Tech**: machinery segment/division navigation. https://www.smarttechbd.net/
- **Digifab**: printing processes and material/specification communication. https://digifab-bd.com/
- **Dysin**: dyes, textile chemicals and technical documentation catalog strategy. https://dysin.com/
- **Creative Safety Solution**: category/filter/price presentation (commerce functionality not required). https://creativesafetysolution.com/
- **Pridesys**: B2B product navigation and enterprise trust content, less relevant as a raw-material catalog. https://pridesys.com/

## 7. QA and benchmarks (do not fabricate before/after metrics)
- Use production build, never `next dev`, for speed measurements.
- Record WebPageTest/Chrome DevTools (Network+Performance), Lighthouse mobile and actual p75 field Core Web Vitals where possible.
- Target p75 **LCP <= 2.5 seconds, INP <= 200ms, CLS <= 0.1**, on defined representative connections/devices. Targets are not guarantees.
- Record time to first server HTML, Next.js/RSC payload size, browser JS, number/size of API requests, first visible product render, image bytes, and Supabase query durations.
- Repeat cold/hot cache and Bangladesh-mobile-network tests for `/`, `/products`, filtered `/products`, `/products/[slug]` and mobile navigation.
- Test 50, 500, 5,000 and 20,000 synthetic **published** products separately with realistic variants, media manifests and price tiers, not just synthetic admin records. Isolate tests from production and verify plans/index choices.
- Security tests: anonymous drafts inaccessible; unpublished media, private documents, admin profiles and normalized product tables inaccessible; public API cannot mutate product, variant, price or media rows; cache cannot reveal archived items beyond agreed emergency visibility window.
- Regression: all page links, category filters, search, sorting, pagination, variants, unit labels, active pricing and image fallbacks.

## 8. Implementation acceptance checklist
- [ ] Public app uses only publishable/anonymous Supabase reads and published-safe projections; no privileged credentials configured.
- [ ] Strict no-write customer requirement implemented; RFQ POST removed or explicitly re-scoped.
- [ ] `/` includes product/category data in server-rendered output without browser-side product fetch waterfall.
- [ ] `/products` and `/products/[slug]` render real initial product data server-side.
- [ ] Public product cards show real, effective, unit-correct price/range/on-request values.
- [ ] Product list API avoids all-media manifests and full descriptions.
- [ ] DB filter/search queries and relationship fetches benchmarked with production-shaped data.
- [ ] R2 images are optimized, responsive, cached and delivered via production domain.
- [ ] Admin changes propagate to public site according to documented TTL/withdrawal rules.
- [ ] Real Lighthouse/DevTools results attached; no performance improvement claimed without evidence.
- [ ] Marketing/certification/delivery claims fact-checked by client.
- [ ] Documentation corrected to reflect current `apps/client` implementation.

## 9. Primary references
- Code: https://github.com/Tatonmoy112/ann-traders/
- Existing performance report: https://raw.githubusercontent.com/Tatonmoy112/ann-traders/main/docs/verification/performance.json
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Next.js 16 Cache Components: https://nextjs.org/docs/app/api-reference/directives/use-cache
- Next.js cache revalidation: https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- Supabase image transformations: https://supabase.com/docs/guides/storage/serving/image-transformations
- Core Web Vitals: https://web.dev/articles/defining-core-web-vitals-thresholds

**Execution caution:** The repository contains irreversible migrations, private supplier/user data paths and staging/production safeguards. Implement through tested incremental commits, never reset hosted Supabase, and do not blindly run SQL or change view ownership without schema/grants review.
