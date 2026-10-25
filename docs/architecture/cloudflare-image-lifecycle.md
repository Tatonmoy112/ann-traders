# Image lifecycle

**Superseded for new uploads:** the current implementation is documented in [R2 image lifecycle](r2-image-lifecycle.md). The description below records the original Images implementation; legacy ready URLs and cleanup remain compatible, but its stage/attach capabilities are revoked by migration 012.

Only JPEG, PNG and WebP up to 10 MB are accepted. Browser checks dimensions; the protected server creates an expiring direct-upload capability after checking role, draft state, revision and quota. Stage records bind the provider ID to actor and product. Browser bytes go directly to Cloudflare with real XHR progress.

Completion reads the stage from the authenticated database, then gets the image from Cloudflare using a server token. The returned ID, metadata owner/product, ready state and approved `detail` URL must match. Only the service-role-only attachment RPC may mark the stage ready. An attacker cannot attach a client-supplied URL or arbitrary provider ID through ordinary authenticated RPC access.

First ready image becomes primary. Primary changes, alt text and detach require the current draft revision. Detach removes the reference and writes a cleanup event in the same transaction. Cleanup checks all asset references and tolerates provider 404 for retry safety. Failed direct uploads remain pending and are not projected publicly.

Limits: provider credentials, live upload verification, dimension/content checks and orphan reconciliation must be tested in a configured staging account. Original bytes are fetched server-side from Cloudflare's authenticated blob endpoint, bounded before decoding, matched against declared size/MIME, and checked with Sharp for supported still-image dimensions. This implementation is not yet provider-verified. Category/brand images and image reordering are not yet wired into the UI. Pending-stage reconciliation is an operator task until the scheduled reconciliation workflow is completed. Configure Cloudflare named variants `thumbnail`, `card`, `detail`; current UI uses the verified `detail` variant with explicit dimensions. Provider deletion is pending until the Edge consumer is scheduled.
