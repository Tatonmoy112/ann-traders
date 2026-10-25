import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';
import { safeErrorMessage } from '@/lib/security';
import type { CatalogDocument } from '@/lib/types';

interface DocumentWithProduct {
  id: string;
  product_id: string;
  variant_id: string | null;
  title: string;
  document_type: string;
  file_extension: string | null;
  bytes: number | null;
  created_at: string;
  products: {
    name: string;
    product_code: string;
    slug: string;
    status: string;
    deleted_at: string | null;
  } | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get('type')?.trim().slice(0, 40);
    const type = rawType ? rawType.replace(/[^a-zA-Z0-9_-]/g, '') : null;
    const rawSearch = searchParams.get('q')?.trim().slice(0, 80);
    const search = rawSearch ? rawSearch.replace(/[,%()]/g, ' ').trim() : null;
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 20)));

    const db = serverSupabase();

    let query = db
      .from('product_documents')
      .select(
        `
        id,
        product_id,
        variant_id,
        title,
        document_type,
        file_extension,
        bytes,
        created_at,
        products:product_id (name, product_code, slug, status, deleted_at)
      `,
        { count: 'exact' },
      )
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (type && type !== 'all') {
      query = query.ilike('document_type', type);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching public documents:', error);
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to fetch compliance documents') },
        { status: 500 },
      );
    }

    const rawRows = (data as unknown as DocumentWithProduct[]) || [];

    // Filter to only include documents whose parent product is published
    const documents = rawRows
      .filter((row) => row.products?.status === 'published' && row.products?.deleted_at === null)
      .map((row) => ({
        id: row.id,
        product_id: row.product_id,
        variant_id: row.variant_id,
        title: row.title,
        document_type: row.document_type,
        file_extension: row.file_extension || 'pdf',
        bytes: row.bytes,
        product_name: row.products?.name || 'Textile Raw Material',
        product_code: row.products?.product_code || '',
        product_slug: row.products?.slug || '',
        download_url: `/api/catalog/documents/${row.id}`,
      }));

    return NextResponse.json({
      documents,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (err) {
    const message = safeErrorMessage(err, 'Failed to fetch compliance documents');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

