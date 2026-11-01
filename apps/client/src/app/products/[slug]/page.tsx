import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getProducts } from '@/lib/catalog';
import { parseCatalogFilters } from '@/lib/catalog-contract';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductVariants } from '@/components/product/product-variants';
import { ProductDocuments } from '@/components/product/product-documents';
import { ProductCard } from '@/components/catalog/product-card';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const data = await getProduct((await params).slug);
  if (!data) return { title: 'Product unavailable | ANN Traders', robots: { index: false } };
  return {
    title: `${data.product.seo_title || data.product.name} | ANN Traders`,
    description: data.product.seo_description || data.product.short_description || undefined,
    alternates: { canonical: `/products/${data.product.slug}` },
    openGraph: {
      title: data.product.name,
      images: data.product.image_url ? [data.product.image_url] : [],
    },
  };
}
export default async function ProductPage({ params }: Props) {
  await connection();
  const data = await getProduct((await params).slug);
  if (!data) notFound();
  const { product, variants, documents, gallery = [] } = data;
  const related = await getProducts(
    parseCatalogFilters(
      new URLSearchParams({
        category: product.category_slug,
        pageSize: '4',
      }),
    ),
  );
  const detail = product.image_variants?.find((image) => image.kind === 'detail');
  return (
    <div className="container-custom py-10 space-y-10">
      <nav className="text-sm">
        <Link href="/">Home</Link> / <Link href="/products">Products</Link> / {product.name}
      </nav>
      <div className="grid lg:grid-cols-2 gap-8">
        <ProductGallery
          primaryUrl={detail?.url || product.image_url}
          gallery={gallery}
          productName={product.name}
          isFeatured={product.is_featured}
          isNewArrival={product.is_new_arrival}
        />
        <div className="space-y-5">
          <p className="text-sm text-blue-700">
            {product.category_name} {product.brand_name}
          </p>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-sm text-slate-600">{product.product_code}</p>
          <p>{product.short_description}</p>
          {!!product.key_features?.length && (
            <ul className="list-disc pl-5 space-y-1">
              {product.key_features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          )}
          <ProductVariants product={product} variants={variants} />
          <Link
            href={`/contact?product=${encodeURIComponent(product.product_code)}`}
            className="inline-block rounded-lg bg-blue-700 text-white px-5 py-3"
          >
            Contact about this product
          </Link>
        </div>
      </div>
      <section className="bg-white border rounded-xl p-6">
        <h2 className="text-xl font-bold mb-3">Product description</h2>
        <p className="whitespace-pre-line text-slate-700">
          {product.description || product.short_description || 'Contact us for more information.'}
        </p>
      </section>
      <section>
        <h2 className="text-xl font-bold mb-4">Technical documents</h2>
        <ProductDocuments documents={documents} />
      </section>
      {!!related.products.filter((item) => item.id !== product.id).length && (
        <section>
          <h2 className="text-xl font-bold mb-6">More in {product.category_name}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.products
              .filter((item) => item.id !== product.id)
              .slice(0, 3)
              .map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
