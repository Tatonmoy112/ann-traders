import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { HttpError } from './auth';
import type { Database } from '@ann/database';
// Restricted to verified provider/file operations. Never import in ordinary CRUD.
export function integrationClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new HttpError(
      503,
      'Media integration is not configured. Ask your administrator to complete server configuration.',
    );
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
