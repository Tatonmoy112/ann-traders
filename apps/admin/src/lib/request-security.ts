// Match the configured origin exactly. Hostname substrings and preview-domain
// suffixes cannot establish trust for cookie-authenticated mutations.
export function trustedMutationOrigin(headers: Headers, configured = process.env.APP_ORIGIN) {
  const expected = configured || 'http://localhost:3000';
  return headers.get('origin') === expected && headers.get('sec-fetch-site') !== 'cross-site';
}
