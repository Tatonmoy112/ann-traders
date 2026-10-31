import { getDocuments } from '@/lib/catalog';
import { catalogResponse, catalogFailure } from '@/lib/catalog-response';
export async function GET(request: Request) {
  try {
    return catalogResponse(await getDocuments(new URL(request.url).searchParams));
  } catch {
    return catalogFailure();
  }
}
