# ADR 0003 — Replace hosted Images with R2

Accepted at the user's explicit request. Use a separate private staging bucket and custom-domain public bucket, AWS SDK v3, conditional expiring PUTs, server decoding/re-encoding and three generated WebP sizes. Keep all 28 public core entities and Supabase PDF storage. Extend product_media with upload lease, manifest, pinned buckets/origin, hashes, verification/retirement and replacement linkage. No historical migration or remote database is reset.

Retain existing Cloudflare Images rows/URLs and legacy cleanup while issuing R2 uploads exclusively. Disable old service-role stage/attach pathways so they cannot bypass the new verification boundary. Do not copy or delete legacy assets automatically. Append safe responsive metadata to the public view without changing its existing fields.

Store media history through retirement. Record promotion plans before writes; use the existing outbox for orphan recovery rather than adding another queue system. A five-minute verification lease and delayed staging cleanup protect races and signed URL replay. Worker batch size is one to keep bounded external operations within the 120-second job lease. Repeated operations remain idempotent; no exactly-once claim is made.

Generated images eliminate dependency on hosted Images variants and unrestricted transformations. Immutable keys plus exact-file Cloudflare purge define cache behavior. Already downloaded public bytes cannot be revoked. PDF authorization/visibility is unchanged.
