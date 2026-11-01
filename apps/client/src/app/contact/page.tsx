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
  const demo = process.env.CATALOG_DEMO_CONTACTS === 'true';
  const whatsapp = process.env.CATALOG_WHATSAPP_NUMBER?.replace(/[^0-9]/g, '');
  const subject = `Product inquiry${product ? `: ${product}` : ''}`;
  const emailIsValid =
    !demo && email && /^[a-z0-9.!#$%&'*+/=^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email);
  const whatsappIsValid = !demo && whatsapp && /^[1-9][0-9]{7,14}$/.test(whatsapp);
  return (
    <div className="container-custom py-16 space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">Contact ANN Traders</h1>
      {product && <p className="font-semibold">Regarding: {product}</p>}
      <p>
        Share the product code, specifications, quantity and required unit to discuss availability
        and a quotation.
      </p>
      {demo && (
        <section
          className="rounded-2xl border border-blue-200 bg-blue-50 p-6 space-y-4"
          aria-label="Demo contact information"
        >
          <h2 className="text-xl font-semibold">Demo contact information</h2>
          <p className="text-sm text-slate-600">
            Preview details only. Replace these with verified business contacts before publishing.
          </p>
          <dl className="space-y-3">
            <div>
              <dt className="font-semibold">Email</dt>
              <dd>{email || 'demo@example.com'}</dd>
            </div>
            <div>
              <dt className="font-semibold">WhatsApp</dt>
              <dd>{process.env.CATALOG_WHATSAPP_NUMBER?.trim() || '+880 1XX-XXXXXXX'}</dd>
            </div>
            <div>
              <dt className="font-semibold">Location</dt>
              <dd>Dhaka, Bangladesh (demo)</dd>
            </div>
          </dl>
        </section>
      )}
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
      {!demo && !emailIsValid && !whatsappIsValid && (
        <p>Contact details will be available here once confirmed.</p>
      )}
    </div>
  );
}
