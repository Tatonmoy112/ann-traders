import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './auth';
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      { error: error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('\n') },
      422,
    );
  console.error(
    JSON.stringify({
      event: 'request_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  return json({ error: 'Unable to complete the request. Please retry.' }, 500);
}
export function databaseError(error: { code?: string; message: string }): never {
  if (error.code === '23505')
    throw new HttpError(409, 'This product code, slug, or SKU is already in use.');
  if (error.code === '40001')
    throw new HttpError(409, 'Another administrator changed this product. Reload before saving.');
  if (error.code === '42501')
    throw new HttpError(403, 'You do not have permission for this action.');
  if (['P0001', '23514', '23P01'].includes(error.code ?? ''))
    throw new HttpError(
      422,
      error.code === '23P01' ? 'Active price periods or quantity tiers overlap.' : error.message,
    );
  throw new Error(`Database operation failed (${error.code ?? 'unknown'})`);
}
export async function body(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== (process.env.APP_ORIGIN ?? 'http://localhost:3000'))
    throw new HttpError(403, 'Request origin is not allowed.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'Expected JSON');
  if (Number(request.headers.get('content-length') ?? 0) > 524288)
    throw new HttpError(413, 'Request is too large');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing request body');
  let bytes = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 524288) {
      await reader.cancel();
      throw new HttpError(413, 'Request is too large');
    }
    parts.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}
