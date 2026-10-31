import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Contact | ANN Traders' };
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  const rawProduct = (await searchParams).product;
  const product = (typeof rawProduct === 'string' ? rawProduct : rawProduct?.[0] || '').slice(
    0,
    180,
  );
  const email = process.env.CATALOG_CONTACT_EMAIL?.trim();
  const whatsapp = process.env.CATALOG_WHATSAPP_NUMBER?.replace(/[^0-9]/g, '');
  const subject = `Product inquiry${product ? `: ${product}` : ''}`;
  const emailIsValid =
    email && /^[a-z0-9.!#$%&'*+/=^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email);
  const whatsappIsValid = whatsapp && /^[1-9][0-9]{7,14}$/.test(whatsapp);
  return (
    <div className="container-custom py-16 space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">Contact ANN Traders</h1>
      {product && <p className="font-semibold">Regarding: {product}</p>}
      <p>
        Share the product code, specifications, quantity and required unit to discuss availability
        and a quotation.
      </p>
      <div className="flex flex-wrap gap-4">
        {emailIsValid && (
          <a
            className="bg-blue-700 text-white rounded-xl px-5 py-3"
            href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`}
          >
            Email {email}
          </a>
        )}
        {whatsappIsValid && (
          <a
            className="bg-emerald-700 text-white rounded-xl px-5 py-3"
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(subject)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact on WhatsApp
          </a>
        )}
      </div>
      {!emailIsValid && !whatsappIsValid && (
        <p>Contact details will be available here once confirmed.</p>
      )}
    </div>
  );
}
