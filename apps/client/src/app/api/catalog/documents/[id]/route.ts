import { catalogResponse } from '@/lib/catalog-response';
// The catalog is anonymous/read-only. Private Storage is never signed here.
export async function GET() {
  return catalogResponse({ error: 'Please contact ANN Traders to request this document.' }, 404);
}
