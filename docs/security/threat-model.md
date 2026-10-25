# Threat model baseline

Assets: private drafts/documents, privileged identities, accurate prices, Cloudflare credentials and immutable audit history. Threats: anonymous visitors, compromised editor accounts, stale elevated tokens, cross-site requests, malicious file payloads and concurrent edits.

Browser → Next: validate cookies with claims and current profile; authorize every endpoint; require exact origin on mutations; schema validate and bound payloads; private/no-store responses. React escapes plain text. Never log credentials.

Next → Postgres: RLS and grants backstop application checks; functions lock aggregate rows and require revision; current role is read from the database, not copied JWT metadata. No public signup. Role changes must not target the actor. Application roles cannot rewrite audit history.

Next → providers: Cloudflare token remains server-only; verify asset identity against staged owner and provider response. Documents use private bucket and generated paths, bounded PDF bytes and magic signature checks. URL downloads never fetch arbitrary client URLs.

Concrete acceptance tests: anonymous normalized SELECT/INSERT denied; editor cannot publish or change dictionaries; disabled profile rejected with an otherwise valid JWT; cross-product media/document links fail; wrong attribute option fails; overlapping prices fail; failed draft save rolls back; revision conflict fails without mutation; draft excluded from public projection. Run SQL tests locally before declaring these verified.

Remaining production gates are recorded in `docs/implementation-status.md`; this baseline is not a security certification.
