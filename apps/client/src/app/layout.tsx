import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/providers';
import { TopBar } from '@/components/layout/top-bar';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'),
  title: 'ANN Traders - Industrial RMG & Textile Raw Materials',
  description:
    'Browse textile, garment and industrial supply product specifications, variants and published price information in Bangladesh.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonces must be generated and applied to request-time HTML, including errors.
  await headers();
  return (
    <html lang="en">
      <head>
        {process.env.R2_PUBLIC_BASE_URL && (
          <link rel="preconnect" href={new URL(process.env.R2_PUBLIC_BASE_URL).origin} />
        )}
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <TopBar />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
