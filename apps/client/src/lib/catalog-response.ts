import { NextResponse } from 'next/server';
export function catalogResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function catalogFailure() {
  return catalogResponse({ error: 'Catalog temporarily unavailable. Please try again.' }, 503);
}
