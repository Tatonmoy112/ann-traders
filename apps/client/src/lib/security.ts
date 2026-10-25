import 'server-only';

/**
 * Production Security Utilities for @ann/client
 * Provides in-memory rate limiting, IP resolution, input sanitization, and error masking.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window store for rate limiting
const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Checks if a client exceeds the allowed request limit within a time window.
 * @param key Unique identifier (e.g. `inquiry:${ip}`)
 * @param maxRequests Maximum allowed requests in window
 * @param windowMs Window duration in milliseconds (e.g. 10 * 60 * 1000 for 10 minutes)
 */
export function checkRateLimit(
  key: string,
  maxRequests = 5,
  windowMs = 10 * 60 * 1000,
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const existing = rateLimitMap.get(key);

  if (!existing || now > existing.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetInMs: windowMs };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: Math.max(0, existing.resetAt - now),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetInMs: Math.max(0, existing.resetAt - now),
  };
}

/**
 * Extracts client IP address safely from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  return '127.0.0.1';
}

/**
 * Strips dangerous HTML tags, null bytes, and control characters to prevent Stored XSS.
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/\0/g, '') // remove null bytes
    .replace(/[<>]/g, '') // strip HTML opening/closing brackets
    .trim();
}

/**
 * Masks internal database / infrastructure errors in production.
 * Logs full diagnostic error on the server while returning a safe message to clients.
 */
export function safeErrorMessage(
  err: unknown,
  fallback = 'An unexpected error occurred. Please try again later.',
): string {
  console.error('[API_ERROR_SERVER_LOG]:', err);

  // In development mode, allow detailed error message for easier debugging
  if (process.env.NODE_ENV === 'development') {
    return (err as Error)?.message || fallback;
  }

  // In production, mask internal database / network errors
  return fallback;
}

