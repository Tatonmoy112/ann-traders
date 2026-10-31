// Match Next's image allowlist before rendering. Unsupported database URLs
// become placeholders instead of throwing during server rendering.
export function publicImageUrl(
  value: string | null | undefined,
  deliveryBase?: string,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      return null;
    if (url.origin === 'https://imagedelivery.net') return url.href;
    if (!deliveryBase) return null;
    const base = new URL(deliveryBase);
    const prefix = base.pathname.replace(/\/$/, '');
    return url.origin === base.origin && (!prefix || url.pathname.startsWith(prefix + '/'))
      ? url.href
      : null;
  } catch {
    return null;
  }
}
