# Grants and RLS matrix

| Object | Anonymous | Editor | Admin (AAL2) | Super admin (AAL2) |
|---|---|---|---|---|
| Core catalog tables | No grants | Read with current active profile | Read | Read |
| Dictionary tables | No grants | Read | Insert/update under RLS | Insert/update under RLS |
| Aggregate draft RPCs | No execute | Execute, draft/ownership/revision checked | Execute | Execute |
| Lifecycle RPC | No execute | Denied by current-role check | Execute | Execute |
| Profile table | No grants | Own row read | Own row read | Team reads |
| Profile mutation | No grants | No direct writes | No direct writes | Authorized Next.js route → narrow service-only RPC; self-target denied |
| Audit | No grants | No visible rows | Read | Read |
| public_catalog views | Read | Read | Read | Read |
| Verified provider attach | No execute | No execute | No execute | No execute; server service role only |
| Outbox | No access | No access | No access | No access; service worker RPC only |
| Storage objects | No policy | No direct policy | No direct policy | Authorized server creates private signed link |

All 28 normalized tables have RLS. Aggregate writes have no direct authenticated INSERT/UPDATE/DELETE grants. Dictionary hard deletion is withheld. Disabled users fail immediately on the next database operation even if the JWT is unexpired. Database role lookup reads profiles rather than trusting JWT role metadata. Elevated roles require `aal2` in both the application and database.

The owner-evaluated `public_catalog` views are a deliberate exception to security-invoker views: anonymous roles have no underlying grants. Each view has an explicit safe field list, security barrier and publication predicate. Treat projection edits as security-sensitive. The view owner must remain the migration owner, not an application role. Tests cover draft filtering and path exclusion; staging must also verify PostgREST exposed-schema configuration and Storage behavior.
