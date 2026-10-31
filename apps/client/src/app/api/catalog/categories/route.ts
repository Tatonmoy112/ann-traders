import { getCategories } from '@/lib/catalog';
import { catalogResponse, catalogFailure } from '@/lib/catalog-response';
export async function GET(request: Request) {
  try {
    return catalogResponse(
      await getCategories(new URL(request.url).searchParams.get('tree') === 'true'),
    );
  } catch {
    return catalogFailure();
  }
}
