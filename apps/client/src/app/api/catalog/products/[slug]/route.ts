import { getProduct } from '@/lib/catalog';
import { catalogResponse, catalogFailure } from '@/lib/catalog-response';
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9_-]{1,280}$/i.test(slug)) return catalogResponse({ error: 'Invalid slug' }, 400);
  try {
    const product = await getProduct(slug);
    return product
      ? catalogResponse(product)
      : catalogResponse({ error: 'Product not found' }, 404);
  } catch {
    return catalogFailure();
  }
}
