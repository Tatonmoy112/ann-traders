import { getBrands } from '@/lib/catalog';
import { catalogResponse, catalogFailure } from '@/lib/catalog-response';
export async function GET() {
  try {
    return catalogResponse(await getBrands());
  } catch {
    return catalogFailure();
  }
}
