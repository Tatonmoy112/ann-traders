// Retired: this helper formerly embedded a hosted database password, disabled
// TLS verification and applied an obsolete anonymous raw-table grant migration.
// It deliberately performs no network access or database writes.
console.error(
  'This legacy migration helper is retired. Review the ordered Supabase migrations and apply them through your normal migration workflow. See docs/verification/client-security-review.md.',
);
process.exitCode = 1;
