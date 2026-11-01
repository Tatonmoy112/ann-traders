// Classify known server failures without echoing query text, credentials or rows.
export function catalogQueryError(
  error: unknown,
  development = process.env.NODE_ENV === 'development',
) {
  const generic = 'Catalog data is temporarily unavailable';
  if (!development) return new Error(generic);
  const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
  const code = typeof rawCode === 'string' ? rawCode : '';
  if (code === 'PGRST106') {
    return new Error(`${generic} [PGRST106]: expose public_catalog in Supabase Data API settings.`);
  }
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(code)) {
    return new Error(
      `${generic} [${code}]: Supabase cannot find the required public catalog views or listing function. Check migrations 20261031000100 and 20261031000200; advanced discovery requires 20261101000400. Reload the PostgREST schema cache after an authorized migration.`,
    );
  }
  if (code === '42501') {
    return new Error(
      `${generic} [42501]: the anonymous role lacks required public_catalog schema, SELECT or read-only function permissions. Review the public catalog migration grants.`,
    );
  }
  return new Error(generic);
}
