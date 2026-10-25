# Future public catalog contract only

No customer UI or runtime is included in Phase 1. Read `public_catalog.products` only with the publishable anonymous key. Never read normalized admin tables. Filter `slug` for detail and use bounded range pagination for lists. Public fields exclude actors, revision, private files and staging assets. The eventual deployment must recheck publication for sensitive document downloads and implement authenticated outbox invalidation before enabling shared HTML caching.
