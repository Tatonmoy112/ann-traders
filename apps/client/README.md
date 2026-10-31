# Public ANN Traders catalog

The independent Next.js client serves `/`, `/products`, `/products/[slug]`, `/documents`, `/contact` and read APIs under `/api/catalog`. Initial category/product content is server-rendered; only filters, variant selection, navigation and image galleries need client interactivity.

## Local setup

From the workspace root:

```powershell
corepack pnpm install --frozen-lockfile
Copy-Item apps/client/.env.example apps/client/.env.local
# Fill in the local/staging publishable key and URL, verified contact details,
# and the public media delivery origin. Never copy admin secrets here.
corepack pnpm --filter @ann/client dev
```

Use `pnpm.cmd` when pnpm is installed directly on Windows. The app listens on port 3001. Build/start with `pnpm --filter @ann/client build` and `pnpm --filter @ann/client start`.

Review and apply migrations `20261031000100_public_catalog_read_models.sql` and `20261031000200_bounded_public_listing.sql` after the earlier migration chain. Never reset a hosted database. PostgREST must expose `public_catalog` (local configuration already does). Anonymous users get SELECT on restricted views and EXECUTE on a read-only, security-invoker listing function; they receive no normalized table access.

## Environment

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public connection only. Missing keys fail closed; secret keys/service-role JWTs in the public field are rejected.
- `NEXT_PUBLIC_SITE_URL`: canonical public HTTPS origin in production.
- `R2_PUBLIC_BASE_URL`: server/build-time public image origin, used for Next image allowlists, CSP and preconnect. Production requires a custom HTTPS domain. Use `R2_ENVIRONMENT=production` at launch; explicit development mode allows local r2.dev testing. Existing imagedelivery.net assets remain supported.
- `CATALOG_CONTACT_EMAIL`, `CATALOG_WHATSAPP_NUMBER`: verified business contact details. Unconfigured contacts are not invented.
- `INTERNAL_CATALOG_REVALIDATE_SECRET`: at least 32 characters; operator-only manual purge secret. Never prefix this with NEXT_PUBLIC.

No service-role, R2 API, Cloudflare purge or database-owner credential belongs in this deployment.

## Security and Vercel deployment

See the [client security review](../../docs/verification/client-security-review.md) and [Vercel firewall setup](../../docs/operations/vercel-client-security.md). The client enforces a request-specific script nonce, read-only methods/database transport, bounded inputs, request timeouts, trusted proxy identities and per-process burst limits. Configure the Vercel firewall rule for shared enforcement before launch; an in-memory limiter is not a shared quota. `CLIENT_TRUSTED_PROXY=auto` recognizes an actual Vercel deployment via its system environment variable. Never set `VERCEL=1` on an untrusted direct origin.

Production on Vercel requires HTTPS Supabase and a custom HTTPS media delivery domain. A development media flag cannot enable r2.dev in Vercel production. Private Storage paths and privileged credentials remain outside the client.

## Data and scope

Cards expose concise summaries, one card image and a conservative effective price with a currency and exact unit. Numeric ranges combine only compatible currencies, price units and trade terms, and require current prices for every active variant. Ambiguous/missing pricing is on request. Detail includes gallery, active variants, current price tiers, specifications, packaging and public document metadata.

Product listing returns `{products, page, pageSize, hasMore, total:null, totalPages:null}`. Page size is bounded to 24 (UI uses 12); one extra row determines the next link. Both legacy API sort/asc parameters and UI sort keys are normalized. Unknown category/brand slugs produce no matches. Categories support a flat list or `?tree=true`; dictionary responses are bounded to 500 entries.

The client does not store inquiries. Contact links open email/WhatsApp outside the application. The former RFQ POST/form/client SDK method are removed. Existing inquiry records are preserved privately. Technical documents are listed as references and requested through contact; the private Storage bucket is never signed or exposed by this app. Automated public PDF delivery requires a separate reviewed delivery design.

## Cache and verification

See the [cache contract](../../docs/architecture/cache-and-invalidation.md) and [implementation evidence/rollout](../../docs/verification/public-catalog-remediation.md). The MVP uses a hard 30-second data-cache key window, live publication checks, no shared HTML/API cache, and authenticated manual purge. The worker's signed event receiver with durable replay/revision handling remains a production acceptance task.

`pnpm --filter @ann/client lint`, `typecheck` and `build` validate the application. `pnpm test` includes public contract/key-boundary tests; database tests additionally require an isolated local `TEST_DATABASE_URL`. The local SQL benchmark, production HTTP checks and browser workflow are documented with their fixture requirements in the verification report.
