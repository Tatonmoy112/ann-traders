# Secrets and authentication

Copy `.env.example` to `apps/admin/.env.local`. Only URL and publishable key are public configuration. The service-role key, Cloudflare token, signing secrets and monitoring keys stay server-only. `env.md` is a user-supplied secret-bearing file and is ignored by root Git/Docker rules; no values were copied into source or reports.

R2 keys are bucket-restricted server/Edge secrets. Account ID, presigned endpoint and public CDN origin are not credentials; only the signed PUT URL is a temporary bearer capability and must not be logged or permanently stored. The adapter signs one private key/type/length/conditional-write operation. All upload/verify/attach/detach operations still require current Supabase role checks; service-only RPCs cannot be called by browser roles. The Edge worker uses its independent high-entropy secret after disabling the gateway user-JWT check for that function only. See the R2 lifecycle and infra runbook for CORS and token scope.

Auth uses Supabase SSR cookies with Next 16 proxy refresh, `getClaims()` verification and a fresh active-profile lookup on every protected operation. Proxy alone does not authorize. Elevated accounts enroll/challenge a TOTP authenticator at `/security`; AAL2 is required by database policies/functions and protected server routes. Invitations and role changes require a fresh authoritative Auth lookup and super-admin session. No public signup UI exists and local Auth signup is disabled.

First operator bootstrap: create an Auth user through local Studio or Supabase admin tooling, then insert an explicit super-admin profile in SQL as the database operator. No signup trigger grants admin rights. Subsequent users are invited through Administrators after server service-role configuration. Auth confirmation supports PKCE code or invite/recovery token hash; use the supplied `/auth/confirm` allowlist and redirect settings.

Password recovery uses uniform success messaging; new passwords require 12 characters in the UI. Configure the same or stronger password rules, email delivery, Auth rate limits, CAPTCHA and MFA recovery procedures in Supabase before staging sign-off. Keep reset/invite URLs out of logs. Auth sessions are never stored in localStorage by this app.

Recovery: another verified super admin can deactivate the affected account. MFA factor recovery must go through an operator identity-verification procedure using Supabase admin tooling. Do not add a browser-accessible bypass. Lost sole-super-admin access is a break-glass operator action, logged in the incident record.
