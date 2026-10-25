import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';
import { safeErrorMessage } from '@/lib/security';
import type { CatalogCategory } from '@/lib/types';

export async function GET() {
  try {
    const supabase = serverSupabase();
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name, slug, description, parent_id, image_path, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to fetch categories') },
        { status: 500 },
      );
    }

    return NextResponse.json((categories as CatalogCategory[]) || []);
  } catch (err) {
    const message = safeErrorMessage(err, 'Failed to fetch categories');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

