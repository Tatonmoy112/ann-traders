export function contentSecurityPolicy(
  nonce: string,
  development: boolean,
  imageOrigin?: string,
  httpsSite = false,
) {
  if (!/^[A-Za-z0-9+/=_-]{16,128}$/.test(nonce)) throw new Error('Invalid CSP nonce');
  const images = ["'self'", 'data:', 'blob:', 'https://imagedelivery.net'];
  if (imageOrigin) images.push(new URL(imageOrigin).origin);
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images.join(' ')}`,
    `connect-src 'self'${development ? ' ws: wss:' : ''}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!development && httpsSite ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}
