const mockOrigin = 'http://127.0.0.1:' + (process.env.ANN_E2E_SUPABASE_PORT || '54329');
// Local provider double for browser tests only. Never imported by application code.
import http from 'node:http';
import crypto from 'node:crypto';
const id = '10000000-0000-4000-8000-000000000001',
  cat = '10000000-0000-4000-8000-000000000004',
  unit = '10000000-0000-4000-8000-000000000005';
const now = () => new Date().toISOString();
const profile = {
  id,
  full_name: 'Catalog Manager',
  role: 'super_admin',
  is_active: true,
  created_at: now(),
  updated_at: now(),
};
const tables = {
  admin_profiles: [profile],
  categories: [
    {
      id: cat,
      name: 'Garments & CAD/CAM Accessories',
      slug: 'garments-cad-cam',
      parent_id: null,
      is_active: true,
      sort_order: 0,
      requires_composition: false,
      created_at: now(),
    },
    {
      id: crypto.randomUUID(),
      name: 'Fabrics & Textiles',
      slug: 'fabrics-textiles',
      is_active: true,
      sort_order: 1,
      created_at: now(),
    },
  ],
  units: [
    {
      id: unit,
      name: 'Kilogram',
      code: 'KG',
      symbol: 'kg',
      unit_family: 'mass',
      factor_to_base: 1,
      is_active: true,
      created_at: now(),
    },
  ],
  products: [],
  product_variants: [],
  variant_prices: [],
  product_media: [],
  product_documents: [],
  audit_logs: [],
  brands: [],
};
const user = {
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'admin@example.test',
  email_confirmed_at: now(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: now(),
  updated_at: now(),
};
const claims = {
  sub: id,
  aud: 'authenticated',
  role: 'authenticated',
  aal: 'aal2',
  email: user.email,
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  iss: mockOrigin + '/auth/v1',
};
const jwt =
  [{ alg: 'HS256', typ: 'JWT' }, claims]
    .map((x) => Buffer.from(JSON.stringify(x)).toString('base64url'))
    .join('.') + '.test-signature';
function reply(res, data, status = 200, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(data));
}
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, mockOrigin);
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      if (url.pathname === '/health') return reply(res, { ok: true });
      if (url.pathname === '/auth/v1/token') {
        if (body.email !== 'admin@example.test' || body.password !== 'test-password-12345')
          return reply(
            res,
            { error: 'invalid_grant', error_description: 'Invalid credentials' },
            400,
          );
        return reply(res, {
          access_token: jwt,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: claims.exp,
          refresh_token: 'test-refresh',
          user,
        });
      }
      if (url.pathname === '/auth/v1/user') return reply(res, user);
      if (url.pathname === '/auth/v1/logout') return reply(res, {});
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').at(-1);
        if (name === 'r2_create_upload') {
          const p = tables.products.find((p) => p.id === body.product);
          if (!p || p.status !== 'draft' || p.revision !== body.expected_revision)
            return reply(res, { code: '40001', message: 'Revision conflict' }, 409);
          const expires = new Date(Date.now() + 300000).toISOString();
          tables.product_media.push({
            id: body.media,
            product_id: body.product,
            uploaded_by: body.actor,
            provider: 'r2',
            provider_asset_id: `catalog/${body.product}/${body.media}`,
            staging_key: `staging/${body.product}/${body.media}`,
            delivery_origin: body.origin,
            staging_bucket: body.staging_bucket_name,
            public_bucket: body.public_bucket_name,
            content_type: body.mime,
            bytes: body.size_bytes,
            upload_status: 'pending',
            upload_expires_at: expires,
            retired_at: null,
            object_manifest: [],
            replaces_media_id: body.replacement ?? null,
            is_primary: false,
            sort_order: 0,
            created_at: now(),
          });
          return reply(res, { expires_at: expires });
        }
        if (name === 'r2_claim_upload') {
          const m = tables.product_media.find(
              (m) =>
                m.id === body.media &&
                m.product_id === body.product &&
                m.uploaded_by === body.actor,
            ),
            p = tables.products.find((p) => p.id === body.product);
          if (!m) return reply(res, { code: '42501', message: 'Ownership mismatch' }, 403);
          if (p.revision !== body.expected_revision)
            return reply(res, { code: '40001', message: 'Revision conflict' }, 409);
          if (m.upload_status === 'failed')
            return reply(res, { code: 'P0001', message: 'Failed session' }, 400);
          m.verification_token = crypto.randomUUID();
          m.upload_status = 'verifying';
          return reply(res, {
            token: m.verification_token,
            staging_key: m.staging_key,
            bytes: m.bytes,
            mime: m.content_type,
            origin: m.delivery_origin,
            staging_bucket: m.staging_bucket,
            public_bucket: m.public_bucket,
          });
        }
        if (name === 'r2_plan_promotion') {
          const m = tables.product_media.find((m) => m.id === body.media);
          Object.assign(m, {
            object_manifest: body.manifest,
            sha256: body.digest,
            width: body.image_width,
            height: body.image_height,
          });
          return reply(res, null);
        }
        if (name === 'r2_finish_upload') {
          const m = tables.product_media.find((m) => m.id === body.media),
            p = tables.products.find((p) => p.id === body.product);
          if (p.revision !== body.expected_revision)
            return reply(res, { code: '40001', message: 'Revision conflict' }, 409);
          const old = tables.product_media.find((row) => row.id === m.replaces_media_id);
          if (old) {
            m.is_primary = old.is_primary;
            m.sort_order = old.sort_order;
            m.alt_text = old.alt_text;
            old.is_primary = false;
            old.retired_at = now();
            old.upload_status = 'retired';
          } else
            m.is_primary = !tables.product_media.some(
              (row) => row.product_id === p.id && row.is_primary,
            );
          m.upload_status = 'ready';
          m.delivery_url = m.object_manifest.find((o) => o.kind === 'detail').url;
          return reply(res, ++p.revision);
        }
        if (name === 'r2_fail_upload') {
          const m = tables.product_media.find((m) => m.id === body.media);
          if (m) m.upload_status = 'failed';
          return reply(res, null);
        }
        if (name === 'create_product_draft') {
          const p = {
            id: crypto.randomUUID(),
            name: body.p_name,
            product_code: body.p_code,
            slug: body.p_slug,
            primary_category_id: null,
            brand_id: null,
            product_type: 'physical',
            short_description: null,
            description: null,
            country_of_origin: null,
            is_featured: false,
            is_new_arrival: false,
            status: 'draft',
            seo_title: null,
            seo_description: null,
            deleted_at: null,
            revision: 1,
            created_at: now(),
            updated_at: now(),
          };
          tables.products.push(p);
          return reply(res, p.id);
        }
        if (name === 'list_admin_products') {
          let rows = tables.products.filter((p) =>
            body.state === 'deleted' ? p.deleted_at : !p.deleted_at,
          );
          if (body.state && !['deleted', ''].includes(body.state))
            rows = rows.filter((p) => p.status === body.state);
          if (body.search)
            rows = rows.filter((p) =>
              (p.name + ' ' + p.product_code).toLowerCase().includes(body.search.toLowerCase()),
            );
          return reply(res, {
            rows: rows.slice(((body.page ?? 1) - 1) * 20, (body.page ?? 1) * 20),
            total: rows.length,
          });
        }
        if (name === 'save_product_draft') {
          const p = tables.products.find((p) => p.id === body.payload.id);
          if (p.revision !== body.payload.revision)
            return reply(res, { code: '40001', message: 'Revision conflict' }, 409);
          Object.assign(p, body.payload.product, { revision: p.revision + 1 });
          for (const key of ['variants', 'prices']) {
            const table = key === 'variants' ? 'product_variants' : 'variant_prices';
            for (const row of body.payload[key]) {
              const old = tables[table].find((r) => r.id === row.id);
              if (old) Object.assign(old, row);
              else tables[table].push({ ...row, product_id: p.id });
            }
          }
          return reply(res, p.revision);
        }
        if (name === 'product_publish_errors') {
          const p = tables.products.find((p) => p.id === body.product),
            v = tables.product_variants.filter((v) => v.product_id === body.product);
          return reply(res, [
            ...(!p.primary_category_id ? ['Basics: choose a primary category'] : []),
            ...(!v.length ? ['Variants: choose exactly one active default'] : []),
            'Images: attach a verified primary image',
          ]);
        }
        if (name === 'product_lifecycle') {
          const p = tables.products.find((p) => p.id === body.product);
          p.revision++;
          p.status =
            body.operation === 'restore' || body.operation === 'unpublish'
              ? 'draft'
              : body.operation === 'publish'
                ? 'published'
                : 'archived';
          if (body.operation === 'delete') p.deleted_at = now();
          if (body.operation === 'restore') p.deleted_at = null;
          return reply(res, p.revision);
        }
        if (name === 'save_product_relation') {
          tables[body.relation] = body.rows;
          const p = tables.products.find((p) => p.id === body.product);
          return reply(res, ++p.revision);
        }
        return reply(res, null);
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.split('/').at(-1);
        tables[table] ??= [];
        let rows = [...tables[table]];
        for (const [key, value] of url.searchParams) {
          if (value.startsWith('eq.')) rows = rows.filter((r) => String(r[key]) === value.slice(3));
          if (value === 'is.null') rows = rows.filter((r) => r[key] == null);
          if (value.startsWith('in.(')) {
            const ids = value.slice(4, -1).split(',');
            rows = rows.filter((r) => ids.includes(String(r[key])));
          }
        }
        if (req.method === 'POST') {
          const row = { id: crypto.randomUUID(), ...body, created_at: now(), updated_at: now() };
          tables[table].push(row);
          rows = [row];
        }
        if (req.method === 'PATCH') {
          rows.forEach((row) => Object.assign(row, body));
        }
        const total = rows.length,
          offset = Number(url.searchParams.get('offset') ?? 0),
          limit = Number(url.searchParams.get('limit') ?? 1000);
        rows = rows.slice(offset, offset + limit);
        const headers = {
          'Content-Range': `${offset}-${Math.max(offset, offset + rows.length - 1)}/${total}`,
        };
        const single = req.headers.accept?.includes('vnd.pgrst.object');
        if (single && !rows.length)
          return reply(res, { code: 'PGRST116', message: 'No row' }, 406, headers);
        return reply(res, single ? rows[0] : rows, 200, headers);
      }
      reply(res, { error: 'Unknown test endpoint' }, 404);
    } catch (e) {
      console.error(e.message);
      reply(res, { error: 'Test provider failed' }, 500);
    }
  })
  .listen(Number(process.env.ANN_E2E_SUPABASE_PORT || 54329), '127.0.0.1', () =>
    console.log('Local Supabase provider double listening on 54329'),
  );
