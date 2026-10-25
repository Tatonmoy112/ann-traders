import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';
import { safeErrorMessage } from '@/lib/security';
import type { CatalogBrand } from '@/lib/types';

export async function GET() {
  try {
    const supabase = serverSupabase();
    const { data: brands, error } = await supabase
      .from('brands')
      .select('id, name, slug, country_code, logo_path')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching brands:', error);
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to fetch brands') },
        { status: 500 },
      );
    }

    return NextResponse.json((brands as CatalogBrand[]) || []);
  } catch (err) {
    const message = safeErrorMessage(err, 'Failed to fetch brands');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

