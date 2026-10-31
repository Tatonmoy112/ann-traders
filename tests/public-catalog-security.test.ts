import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { serverSupabase } from '../apps/client/src/lib/supabase';

describe('anonymous public Supabase boundary', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'must-never-be-used');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it('fails closed when the public key is missing even if a service key exists', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    expect(serverSupabase).toThrow('configuration is missing');
  });
  it('rejects secret keys and privileged legacy JWTs pasted into the public field', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_test');
    expect(serverSupabase).toThrow('publishable key');
    const claims = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'header.' + claims + '.signature');
    expect(serverSupabase).toThrow('anonymous');
  });
  it('sends only the public key and restricted schema with uncached transport', async () => {
    const mockFetch = vi.fn(
      async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', mockFetch);
    await serverSupabase().from('product_cards').select('id');
    const args = mockFetch.mock.calls[0] as unknown as [RequestInfo, RequestInit];
    const headers = new Headers(args[1].headers);
    expect(headers.get('apikey')).toBe('test-publishable-key');
    expect(headers.get('accept-profile')).toBe('public_catalog');
    expect(args[1].cache).toBe('no-store');
    expect(args[1].redirect).toBe('error');
    expect(args[1].signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(args)).not.toContain('must-never-be-used');
  });
  it('refuses database mutations before making any network request', async () => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    const result = await serverSupabase().from('products').insert({ name: 'forbidden' });
    expect(result.error?.message).toContain('read-only');
    expect(mock).not.toHaveBeenCalled();
  });
  it('rejects remote cleartext endpoints and embedded credentials', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://example.supabase.co');
    expect(serverSupabase).toThrow('HTTPS');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://user:password@example.supabase.co');
    expect(serverSupabase).toThrow('HTTPS');
  });
  it('rejects a development endpoint inside Vercel production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    expect(serverSupabase).toThrow('HTTPS');
  });
  it('does not amplify transient database errors with automatic retries', async () => {
    const mock = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 'PGRST002', message: 'temporary' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
        }),
    );
    vi.stubGlobal('fetch', mock);
    const result = await serverSupabase().from('product_cards').select('id');
    expect(result.error).not.toBeNull();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
