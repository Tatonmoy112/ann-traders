import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { TopBar } from '@/components/layout/top-bar';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'ANN Traders - Industrial RMG & Textile Raw Materials',
  description:
    'Leading Bangladesh importer, indentor, and supplier of spinning yarns, CAD marker paper, reactive dyes, chemicals, and machinery spare parts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://pub-fbd4e8d632d144688a922a2fbc830b3f.r2.dev" />
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
