import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { serveCatalogDocument } from './handler.ts';

Deno.serve(async (request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const anonymousKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonymousKey || !serviceKey)
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const anonymous = createClient(url, anonymousKey, options).schema('public_catalog');
  const privileged = createClient(url, serviceKey, options);
  return serveCatalogDocument(request, {
    visible: async (id) => {
      const { data, error } = await anonymous
        .from('documents')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error('Visibility unavailable');
      return Boolean(data);
    },
    source: async (id) => {
      const { data, error } = await privileged
        .from('product_documents')
        .select('bucket_id,storage_path')
        .eq('id', id)
        .eq('is_public', true)
        .is('retired_at', null)
        .maybeSingle();
      if (error) throw new Error('Document unavailable');
      return data ? { bucket: data.bucket_id, path: data.storage_path } : null;
    },
    download: async (source) => {
      const { data, error } = await privileged.storage.from(source.bucket).download(source.path);
      if (error || !data) throw new Error('Storage unavailable');
      return data;
    },
  });
});
