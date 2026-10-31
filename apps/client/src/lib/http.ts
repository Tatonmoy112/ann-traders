// Browser-only, same-origin reads. Server Components use catalog.ts directly.
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export async function get<T>(
  path: string,
  options: { headers?: Record<string, string> } = {},
): Promise<T> {
  if (typeof window === 'undefined')
    throw new ApiError('Use server catalog queries for server reads');
  if (!path.startsWith('/api/catalog/') || path.includes('\\') || path.includes('#'))
    throw new ApiError('Invalid catalog API path', 400);
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/catalog/'))
    throw new ApiError('Invalid catalog API origin', 400);
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: { ...options.headers, Accept: 'application/json' },
    });
    if (!response.ok)
      throw new ApiError(
        response.status === 429
          ? 'Too many requests. Please try again shortly.'
          : 'Catalog request failed. Please try again.',
        response.status,
      );
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Unable to reach the catalog. Please try again.', 503);
  }
}
const api = { get };
export default api;
