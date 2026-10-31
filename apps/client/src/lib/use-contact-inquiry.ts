'use client';
import { useRouter } from 'next/navigation';
export function useContactInquiry() {
  const router = useRouter();
  return {
    openInquiry(product?: { id?: string; name?: string; sku?: string; unit?: string }) {
      const reference = product?.sku || product?.name;
      router.push(reference ? `/contact?product=${encodeURIComponent(reference)}` : '/contact');
    },
  };
}
