import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'ANN Traders · Admin', template: '%s · ANN Traders' },
  description: 'Private product catalog administration',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-BD">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
