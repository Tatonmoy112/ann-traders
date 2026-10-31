import { getProducts } from '@/lib/catalog';
import { parseCatalogFilters } from '@/lib/catalog-contract';
import { catalogResponse, catalogFailure } from '@/lib/catalog-response';
export async function GET(request: Request) {
  try {
    return catalogResponse(
      await getProducts(parseCatalogFilters(new URL(request.url).searchParams)),
    );
  } catch {
    return catalogFailure();
  }
}
