import { getFacets } from '@/lib/catalog';
import { catalogFailure, catalogResponse } from '@/lib/catalog-response';
export async function GET(request: Request) {
  try {
    return catalogResponse(
      await getFacets(new URL(request.url).searchParams.get('category') || ''),
    );
  } catch {
    return catalogFailure();
  }
}
