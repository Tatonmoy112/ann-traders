import { z } from 'zod';
import { notFound } from 'next/navigation';
import { isConfigured } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { ProductEditor } from '@/components/product-editor';
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  if (!isConfigured()) return null;
  const { profile } = await requireAdmin();
  return <ProductEditor id={id} canPublish={profile.role !== 'editor'} />;
}
