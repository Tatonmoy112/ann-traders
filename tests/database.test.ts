import { Client } from 'pg';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe : describe.skip;
suite.sequential('PostgreSQL constraints, transactions, grants and RLS', () => {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  const editor = '10000000-0000-4000-8000-000000000001',
    admin = '10000000-0000-4000-8000-000000000002',
    inactive = '10000000-0000-4000-8000-000000000003',
    cat = '10000000-0000-4000-8000-000000000004',
    unit = '10000000-0000-4000-8000-000000000005',
    variant = '10000000-0000-4000-8000-000000000006';
  let product: string;
  const role = async (id: string, aal = 'aal2', sqlRole = 'authenticated') => {
    await db.query('reset role');
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id, role: sqlRole, aal }),
    ]);
    await db.query(`set local role ${sqlRole}`);
  };
  const owner = () => db.query('reset role');
  const r2Stage = async (media: string, replacement: string | null = null, revision = 1) => {
    await owner();
    await db.query(
      "select public.r2_create_upload($1,$2,$3,$4,'image/png',1024,'https://images.example.com','private-stage','public-images',$5)",
      [editor, product, revision, media, replacement],
    );
  };
  const r2Claim = async (media: string, revision = 1) => {
    const r = await db.query('select public.r2_claim_upload($1,$2,$3,$4) as session', [
      editor,
      product,
      revision,
      media,
    ]);
    return r.rows[0].session;
  };
  const r2Plan = async (media: string, token: string) => {
    const manifest = ['thumbnail', 'card', 'detail'].map((kind) => ({
      kind,
      key: `catalog/${product}/${media}/${token}/${kind}.webp`,
      url: `https://images.example.com/catalog/${product}/${media}/${token}/${kind}.webp`,
      width: 100,
      height: 100,
      bytes: 300,
      sha256: 'a'.repeat(64),
    }));
    await db.query('select public.r2_plan_promotion($1,$2,$3,$4,$5,100,100)', [
      editor,
      media,
      token,
      JSON.stringify(manifest),
      'b'.repeat(64),
    ]);
    return manifest;
  };
  const payload = () => ({
    id: product,
    revision: 1,
    product: {
      name: 'Test marker paper',
      product_code: 'TEST-MP',
      slug: 'test-marker-paper',
      primary_category_id: cat,
      brand_id: null,
      product_type: 'physical',
      short_description: 'Synthetic test fixture',
      description: null,
      country_of_origin: 'BD',
      is_featured: false,
      is_new_arrival: false,
      seo_title: null,
      seo_description: null,
    },
    variants: [
      {
        id: variant,
        sku: 'TEST-SKU',
        variant_name: '70 GSM / 72 inch',
        model_number: null,
        base_unit_id: unit,
        minimum_order_qty: '1',
        minimum_order_unit_id: unit,
        monthly_supply_capacity: null,
        capacity_unit_id: unit,
        lead_time_days: 2,
        availability_status: 'on_request',
        is_default: true,
        is_active: true,
      },
    ],
    prices: [],
  });
  beforeAll(async () => {
    await db.connect();
    await db.query('begin');
    await db.query('insert into auth.users(id) values($1),($2),($3)', [editor, admin, inactive]);
    await db.query(
      "insert into public.admin_profiles(id,full_name,role,is_active) values($1,'Test Editor','editor',true),($2,'Test Admin','admin',true),($3,'Disabled Editor','editor',false)",
      [editor, admin, inactive],
    );
    await db.query(
      "insert into public.categories(id,name,slug) values($1,'Test category','test-category')",
      [cat],
    );
    await db.query(
      "insert into public.units(id,name,code,symbol,unit_family,factor_to_base) values($1,'Test KG','TEST-KG','kg','mass',1)",
      [unit],
    );
    await role(editor);
    const result = await db.query(
      "select public.create_product_draft('Test marker paper','TEST-MP','test-marker-paper') as id",
    );
    product = result.rows[0].id;
  });
  afterAll(async () => {
    await owner();
    await db.query('rollback');
    await db.end();
  });
  beforeEach(async () => {
    await db.query('savepoint each_test');
    await role(editor);
  });
  afterEach(async () => {
    await db.query('rollback to savepoint each_test');
  });
  it('creates every original entity', async () => {
    await owner();
    const r = await db.query(
      "select count(*)::int as count from pg_tables where schemaname='public' and tablename<>'inquiries'",
    );
    expect(r.rows[0].count).toBe(28);
  });
  it('enables RLS on every public table including legacy inquiries', async () => {
    await owner();
    const r = await db.query(
      "select count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    );
    expect(r.rows[0].count).toBe(0);
  });
  it('lets editors create and atomically save drafts', async () => {
    const r = await db.query('select public.save_product_draft($1::jsonb) as revision', [
      JSON.stringify(payload()),
    ]);
    expect(r.rows[0].revision).toBe('2');
    const v = await db.query('select sku from public.product_variants where product_id=$1', [
      product,
    ]);
    expect(v.rows[0].sku).toBe('TEST-SKU');
  });
  it('records the actor in immutable audit history', async () => {
    await role(admin);
    const r = await db.query(
      "select admin_id from public.audit_logs where entity_id=$1 and action='insert'",
      [product],
    );
    expect(r.rows[0].admin_id).toBe(editor);
    await expect(db.query('delete from public.audit_logs')).rejects.toMatchObject({
      code: '42501',
    });
  });
  it('blocks anonymous normalized reads', async () => {
    await role(editor, 'aal1', 'anon');
    await expect(db.query('select * from public.products')).rejects.toMatchObject({
      code: '42501',
    });
  });
  it('blocks anonymous draft RPC', async () => {
    await role(editor, 'aal1', 'anon');
    await expect(
      db.query("select public.create_product_draft('Attack','ATTACK','attack')"),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('excludes drafts from anonymous public projection', async () => {
    await role(editor, 'aal1', 'anon');
    const r = await db.query('select * from public_catalog.products where id=$1', [product]);
    expect(r.rowCount).toBe(0);
  });
  it('rejects editor publishing', async () => {
    await expect(
      db.query("select public.product_lifecycle($1,1,'publish')", [product]),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('rejects editor master-data writes', async () => {
    await expect(
      db.query("insert into public.categories(name,slug) values('Attack','attack')"),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('blocks role escalation', async () => {
    await expect(
      db.query("update public.admin_profiles set role='super_admin' where id=$1", [editor]),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('rejects inactive users despite a valid identity claim', async () => {
    await role(inactive);
    await expect(
      db.query("select public.create_product_draft('Attack','ATTACK','attack')"),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('requires aal2 for elevated roles at the DB boundary', async () => {
    await role(admin, 'aal1');
    await expect(
      db.query("select public.create_product_draft('Attack','ATTACK','attack')"),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('rejects stale revisions', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await expect(
      db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]),
    ).rejects.toMatchObject({ code: '40001' });
  });
  it('rolls back every part of a failed aggregate save', async () => {
    const p = payload();
    p.variants[0].minimum_order_qty = '-1';
    await db.query('savepoint failing_save');
    await expect(
      db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(p)]),
    ).rejects.toMatchObject({ code: '23514' });
    await db.query('rollback to savepoint failing_save');
    const r = await db.query('select revision from public.products where id=$1', [product]);
    expect(r.rows[0].revision).toBe('1');
  });
  it('returns field-specific publication errors', async () => {
    const r = await db.query('select public.product_publish_errors($1) as errors', [product]);
    expect(r.rows[0].errors).toContain('Basics: choose a primary category');
    expect(r.rows[0].errors).toContain('Images: attach a verified primary image');
  });
  it('rejects category cycles', async () => {
    await role(admin);
    await db.query(
      "insert into public.categories(id,parent_id,name,slug) values('20000000-0000-4000-8000-000000000001',$1,'Child','test-child')",
      [cat],
    );
    await expect(
      db.query(
        "update public.categories set parent_id='20000000-0000-4000-8000-000000000001' where id=$1",
        [cat],
      ),
    ).rejects.toThrow('cycle');
  });
  it('rejects case-folded duplicate codes', async () => {
    await expect(
      db.query("select public.create_product_draft('Duplicate','test-mp','different-slug')"),
    ).rejects.toMatchObject({ code: '23505' });
  });
  it('rejects null fixed-price amounts at the database', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await owner();
    await expect(
      db.query(
        "insert into public.variant_prices(variant_id,currency_code,price_type,price_unit_id,valid_from) values($1,'BDT','fixed',$2,now())",
        [variant, unit],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('rejects overlapping active price windows', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await owner();
    await db.query(
      "insert into public.variant_prices(variant_id,currency_code,price_type,price_unit_id,valid_from) values($1,'BDT','on_request',$2,'2026-01-01')",
      [variant, unit],
    );
    await expect(
      db.query(
        "insert into public.variant_prices(variant_id,currency_code,price_type,price_unit_id,valid_from) values($1,'BDT','on_request',$2,'2026-02-01')",
        [variant, unit],
      ),
    ).rejects.toMatchObject({ code: '23P01' });
  });
  it('rejects foreign variant relationship ownership', async () => {
    await expect(
      db.query('select public.save_product_relation($1,1,$2,$3::jsonb)', [
        product,
        'variant_fiber_composition',
        JSON.stringify([{ variant_id: variant, fiber_id: unit, percentage: '100' }]),
      ]),
    ).rejects.toThrow('Foreign variant');
  });
  it('denies verified-media attachment to ordinary authenticated users', async () => {
    await expect(
      db.query(
        "select public.attach_verified_image($1,$2,1,$3,'https://imagedelivery.net/h/i/detail')",
        [editor, product, variant],
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('does not grant anonymous access to audit, profiles, staging or documents', async () => {
    const r = await db.query(
      "select bool_and(not has_table_privilege('anon',t,'SELECT')) as safe from unnest(array['public.admin_profiles','public.audit_logs','public.product_media','public.product_documents']) t",
    );
    expect(r.rows[0].safe).toBe(true);
  });
  it('audits composite category mappings without a synthetic row ID', async () => {
    await role(admin);
    await db.query(
      "insert into public.attribute_definitions(id,name,code,data_type) values($1,'GSM','TEST-GSM','number')",
      [variant],
    );
    await db.query(
      "insert into public.category_attributes(category_id,attribute_id,applies_to) values($1,$2,'variant')",
      [cat, variant],
    );
    const r = await db.query(
      "select entity_id from public.audit_logs where entity_name='category_attributes'",
    );
    expect(r.rows[0].entity_id).toBe(cat);
  });
  it('rejects scalar attribute duplication', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await owner();
    await db.query(
      "insert into public.attribute_definitions(id,name,code,data_type) values($1,'GSM','TEST-GSM','number')",
      [unit],
    );
    await db.query(
      'insert into public.variant_attribute_values(variant_id,attribute_id,value_number) values($1,$2,70)',
      [variant, unit],
    );
    await expect(
      db.query(
        'insert into public.variant_attribute_values(variant_id,attribute_id,value_number) values($1,$2,80)',
        [variant, unit],
      ),
    ).rejects.toThrow('Duplicate value');
  });
  it('rejects mistyped attribute values', async () => {
    await owner();
    await db.query(
      "insert into public.attribute_definitions(id,name,code,data_type) values($1,'GSM','TEST-GSM','number')",
      [unit],
    );
    await expect(
      db.query(
        "insert into public.product_attribute_values(product_id,attribute_id,value_text) values($1,$2,'seventy')",
        [product, unit],
      ),
    ).rejects.toThrow('requires number');
  });
  it('rejects options belonging to another attribute', async () => {
    await owner();
    await db.query(
      "insert into public.attribute_definitions(id,name,code,data_type) values($1,'Color','TEST-COLOR','select'),($2,'Finish','TEST-FINISH','select')",
      [unit, variant],
    );
    await db.query(
      "insert into public.attribute_options(id,attribute_id,value,label) values($1,$2,'red','Red')",
      [cat, unit],
    );
    await expect(
      db.query(
        'insert into public.product_attribute_values(product_id,attribute_id,option_id) values($1,$2,$3)',
        [product, variant, cat],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });
  it('rejects GSM as a sale quantity unit', async () => {
    await owner();
    await db.query(
      "insert into public.units(id,name,code,symbol,unit_family) values($1,'GSM','TEST-GSM','g/m2','areal_density')",
      [variant],
    );
    await role(editor);
    const p = payload();
    p.variants[0].base_unit_id = variant;
    await expect(
      db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(p)]),
    ).rejects.toThrow('not GSM');
  });
  it('enforces exactly one active default during publication', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [
      JSON.stringify({ ...payload(), variants: [{ ...payload().variants[0], is_default: false }] }),
    ]);
    const r = await db.query('select public.product_publish_errors($1) as errors', [product]);
    expect(r.rows[0].errors).toContain('Variants: choose exactly one active default');
  });
  it('reports a missing required category attribute', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await owner();
    await db.query(
      "insert into public.attribute_definitions(id,name,code,data_type) values($1,'GSM','TEST-GSM','number')",
      [unit],
    );
    await db.query(
      "insert into public.category_attributes(category_id,attribute_id,applies_to,is_required) values($1,$2,'variant',true)",
      [cat, unit],
    );
    await role(editor);
    const r = await db.query('select public.product_publish_errors($1) as errors', [product]);
    expect(r.rows[0].errors).toContain('TEST-SKU: required GSM');
  });
  it('requires 100% fiber composition only for applicable categories', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await role(admin);
    await db.query('update public.categories set requires_composition=true where id=$1', [cat]);
    await role(editor);
    const r = await db.query('select public.product_publish_errors($1) as errors', [product]);
    expect(r.rows[0].errors).toContain('TEST-SKU: fiber composition must total 100%');
  });
  it('rejects price-tier overlap', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await owner();
    const price = await db.query(
      "insert into public.variant_prices(variant_id,currency_code,price_type,min_price,price_unit_id,valid_from) values($1,'BDT','fixed',85,$2,now()) returning id",
      [variant, unit],
    );
    await db.query(
      'insert into public.price_tiers(variant_price_id,min_quantity,max_quantity,quantity_unit_id,unit_price) values($1,1,100,$2,85)',
      [price.rows[0].id, unit],
    );
    await expect(
      db.query(
        'insert into public.price_tiers(variant_price_id,min_quantity,max_quantity,quantity_unit_id,unit_price) values($1,50,200,$2,80)',
        [price.rows[0].id, unit],
      ),
    ).rejects.toMatchObject({ code: '23P01' });
  });
  it('does not leak private document paths through the public view', async () => {
    await role(editor, 'aal1', 'anon');
    const r = await db.query(
      "select column_name from information_schema.columns where table_schema='public_catalog' and table_name='documents'",
    );
    expect(r.rows.map((x) => x.column_name)).not.toContain('storage_path');
  });
  it('publishes, projects, unpublishes and creates durable invalidation events', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await owner();
    await db.query(
      "insert into public.variant_prices(variant_id,currency_code,price_type,price_unit_id,valid_from) values($1,'BDT','on_request',$2,now())",
      [variant, unit],
    );
    await db.query(
      "insert into public.product_media(product_id,media_type,provider_asset_id,delivery_url,upload_status,is_primary) values($1,'image','synthetic-test-image','https://imagedelivery.net/test/synthetic/detail','ready',true)",
      [product],
    );
    await role(admin);
    await db.query("select public.product_lifecycle($1,2,'publish')", [product]);
    await role(editor, 'aal1', 'anon');
    expect(
      (await db.query('select id from public_catalog.products where id=$1', [product])).rowCount,
    ).toBe(1);
    expect(
      (await db.query('select id from public_catalog.variants where product_id=$1', [product]))
        .rowCount,
    ).toBe(1);
    await role(admin);
    await db.query("select public.product_lifecycle($1,3,'unpublish')", [product]);
    await role(editor, 'aal1', 'anon');
    expect(
      (await db.query('select id from public_catalog.products where id=$1', [product])).rowCount,
    ).toBe(0);
    await owner();
    expect(
      (await db.query('select * from private.outbox_events where entity_id=$1', [product]))
        .rowCount,
    ).toBe(2);
  });
  it('denies ordinary users worker claims and role management RPCs', async () => {
    const r = await db.query(
      "select has_function_privilege('authenticated','public.claim_catalog_jobs(integer)','EXECUTE') as claim,has_function_privilege('authenticated','public.manage_admin(uuid,uuid,text,text,boolean)','EXECUTE') as manage",
    );
    expect(r.rows[0]).toEqual({ claim: false, manage: false });
  });
  async function publishedPublicFixture(extraPrices = '') {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await owner();
    await db.query(
      "insert into public.variant_prices(variant_id,currency_code,price_type,min_price,price_unit_id,valid_from) values($1,'BDT','fixed',100,$2,now())",
      [variant, unit],
    );
    if (extraPrices) await db.query(extraPrices, [variant, unit]);
    await db.query(
      "insert into public.product_media(product_id,media_type,provider_asset_id,delivery_url,upload_status,is_primary) values($1,'image','public-fixture','https://imagedelivery.net/test/public-fixture/detail','ready',true)",
      [product],
    );
    await role(admin);
    await db.query("select public.product_lifecycle($1,2,'publish')", [product]);
    await role(editor, 'aal1', 'anon');
  }
  it('keeps all public views read-only and denies anonymous raw dictionary and inquiry access', async () => {
    await owner();
    const views = await db.query(
      "select table_name from information_schema.views where table_schema='public_catalog'",
    );
    for (const view of views.rows) {
      const result = await db.query(
        "select has_table_privilege('anon',$1,'INSERT,UPDATE,DELETE') as allowed",
        ['public_catalog.' + view.table_name],
      );
      expect(result.rows[0].allowed).toBe(false);
    }
    for (const name of [
      'products',
      'categories',
      'brands',
      'inquiries',
      'admin_profiles',
      'audit_logs',
      'product_media',
      'product_documents',
      'variant_prices',
    ]) {
      const result = await db.query(
        "select has_table_privilege('anon',$1,'SELECT,INSERT,UPDATE,DELETE') as allowed",
        ['public.' + name],
      );
      expect(result.rows[0].allowed).toBe(false);
    }
    const policy = await db.query(
      "select roles::text[] as roles from pg_policies where tablename='inquiries' and policyname='inquiries_service_all'",
    );
    expect(policy.rows[0].roles).toEqual(['service_role']);
  });
  it('excludes drafts from cards, details and visibility checks', async () => {
    await role(editor, 'aal1', 'anon');
    expect(
      (await db.query('select id from public_catalog.product_cards where id=$1', [product]))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await db.query('select slug from public_catalog.product_details where slug=$1', [
          'test-marker-paper',
        ])
      ).rowCount,
    ).toBe(0);
    expect(
      (await db.query('select id from public_catalog.visibility where id=$1', [product])).rowCount,
    ).toBe(0);
  });
  it('delivers compact, unit-correct cards and one public detail projection', async () => {
    await publishedPublicFixture();
    const row = (
      await db.query('select * from public_catalog.product_cards where id=$1', [product])
    ).rows[0];
    expect(row.display_price).toMatchObject({
      type: 'fixed',
      min: '100.0000',
      max: '100.0000',
      currency: 'BDT',
      unit: 'kg',
    });
    expect(row).not.toHaveProperty('description');
    expect(row).not.toHaveProperty('image_variants');
    expect(row).not.toHaveProperty('object_manifest');
    const detail = (
      await db.query('select * from public_catalog.product_details where slug=$1', [
        'test-marker-paper',
      ])
    ).rows[0];
    expect(detail.variants[0].prices[0]).toMatchObject({
      currency: 'BDT',
      min: '100.0000',
      unit: 'kg',
    });
    expect(detail.gallery).toHaveLength(1);
    expect(JSON.stringify(detail)).not.toMatch(/storage_path|staging_key|uploaded_by|created_by/);
  });
  it('excludes future and expired prices from both cards and details', async () => {
    await publishedPublicFixture(
      "insert into public.variant_prices(variant_id,currency_code,price_type,min_price,price_unit_id,valid_from,valid_until) values($1,'BDT','fixed',1,$2,now()-interval '2 days',now()-interval '1 day'),($1,'USD','fixed',2,$2,now()+interval '1 day',null)",
    );
    const row = (
      await db.query('select display_price from public_catalog.product_cards where id=$1', [
        product,
      ])
    ).rows[0];
    expect(row.display_price.min).toBe('100.0000');
    const detail = (
      await db.query('select variants from public_catalog.product_details where slug=$1', [
        'test-marker-paper',
      ])
    ).rows[0];
    expect(detail.variants[0].prices).toHaveLength(1);
  });
  it('does not combine incompatible currencies into a numeric public range', async () => {
    await publishedPublicFixture(
      "insert into public.variant_prices(variant_id,currency_code,price_type,min_price,price_unit_id,valid_from) values($1,'USD','fixed',2,$2,now())",
    );
    const row = (
      await db.query('select display_price from public_catalog.product_cards where id=$1', [
        product,
      ])
    ).rows[0];
    expect(row.display_price).toEqual({ type: 'on_request' });
  });
  it('removes withdrawn products from all reads and the uncached visibility gate', async () => {
    await publishedPublicFixture();
    await role(admin);
    await db.query("select public.product_lifecycle($1,3,'archive')", [product]);
    await role(editor, 'aal1', 'anon');
    for (const view of ['visibility', 'product_cards', 'products'])
      expect(
        (await db.query(`select id from public_catalog.${view} where id=$1`, [product])).rowCount,
      ).toBe(0);
    expect(
      (
        await db.query('select slug from public_catalog.product_details where slug=$1', [
          'test-marker-paper',
        ])
      ).rowCount,
    ).toBe(0);
  });
  it('unknown exact category/brand slugs yield zero published cards', async () => {
    await publishedPublicFixture();
    expect(
      (
        await db.query(
          "select id from public_catalog.product_cards where category_slug='does-not-exist'",
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await db.query(
          "select id from public_catalog.product_cards where brand_slug='does-not-exist'",
        )
      ).rowCount,
    ).toBe(0);
  });
  it('bounds anonymous listing RPCs and allowlists sort identifiers', async () => {
    await publishedPublicFixture();
    const result = await db.query(
      "select id from public_catalog.list_product_cards('','','',false,false,null,100000,'name; drop table products',true)",
    );
    expect(result.rows.map((row) => row.id)).toEqual([product]);
    expect(
      (await db.query("select id from public_catalog.list_product_cards('unknown')")).rowCount,
    ).toBe(0);
    const result2 = await db.query(
      "select id from public_catalog.list_product_cards('','','',false,false,2,1)",
    );
    expect(result2.rowCount).toBe(0);
  });
  it('keeps R2 control RPCs server-only and disables legacy attachment capabilities', async () => {
    const r = await db.query(
      "select has_function_privilege('authenticated','public.r2_claim_upload(uuid,uuid,bigint,uuid)','EXECUTE') as claim,has_function_privilege('anon','public.r2_prepare_cleanup(uuid)','EXECUTE') as cleanup,has_function_privilege('service_role','public.attach_verified_image(uuid,uuid,bigint,uuid,text)','EXECUTE') as legacy",
    );
    expect(r.rows[0]).toEqual({ claim: false, cleanup: false, legacy: false });
  });
  it('creates owned private staging sessions with durable delayed recovery', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    const r = await db.query(
      'select provider,staging_key,delivery_url,upload_status from public.product_media where id=$1',
      [media],
    );
    expect(r.rows[0]).toEqual({
      provider: 'r2',
      staging_key: `staging/${product}/${media}`,
      delivery_url: null,
      upload_status: 'pending',
    });
    const events = await db.query(
      'select event_type,available_at>now() as delayed from private.outbox_events where entity_id=$1',
      [media],
    );
    expect(events.rows[0]).toEqual({ event_type: 'r2.cleanup', delayed: true });
  });
  it('rejects foreign actors, expired sessions and simultaneous verifiers', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    await expect(
      db.query('select public.r2_claim_upload($1,$2,1,$3)', [admin, product, media]),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('fences a concurrent verifier with a lease', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    await r2Claim(media);
    await expect(r2Claim(media)).rejects.toMatchObject({ code: '40001' });
  });
  it('does not verify an expired upload capability', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    await db.query(
      "update public.product_media set upload_expires_at=now()-interval '1 second' where id=$1",
      [media],
    );
    await expect(r2Claim(media)).rejects.toThrow('expired');
  });
  it('does not attach pending objects or client-selected public keys', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    const session = await r2Claim(media);
    await expect(
      db.query('select public.r2_finish_upload($1,$2,1,$3,$4)', [
        editor,
        product,
        media,
        session.token,
      ]),
    ).rejects.toMatchObject({ code: '40001' });
  });
  it('rejects foreign promotion manifests', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    const session = await r2Claim(media);
    const bad = ['thumbnail', 'card', 'detail'].map((kind) => ({
      kind,
      key: `catalog/${product}/${media}/${session.token}/${kind}.webp`,
      url: 'https://evil.test/a',
      width: 100,
      height: 100,
      bytes: 100,
      sha256: 'a'.repeat(64),
    }));
    await expect(
      db.query('select public.r2_plan_promotion($1,$2,$3,$4,$5,100,100)', [
        editor,
        media,
        session.token,
        JSON.stringify(bad),
        'b'.repeat(64),
      ]),
    ).rejects.toThrow('manifest');
  });
  it('commits verified metadata and attaches idempotently under a pure service session', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    const session = await r2Claim(media);
    await r2Plan(media, session.token);
    await db.query('select set_config(\'request.jwt.claims\',\'{"role":"service_role"}\',true)');
    await db.query('set local role service_role');
    const first = await db.query('select public.r2_finish_upload($1,$2,1,$3,$4) as revision', [
      editor,
      product,
      media,
      session.token,
    ]);
    const again = await db.query('select public.r2_finish_upload($1,$2,1,$3,$4) as revision', [
      editor,
      product,
      media,
      session.token,
    ]);
    expect(first.rows[0].revision).toBe('2');
    expect(again.rows[0].revision).toBe('2');
    await owner();
    const r = await db.query(
      'select upload_status,is_primary,width,sha256 from public.product_media where id=$1',
      [media],
    );
    expect(r.rows[0]).toMatchObject({
      upload_status: 'ready',
      is_primary: true,
      width: 100,
      sha256: 'b'.repeat(64),
    });
  });
  it('preserves legacy rows and atomically replaces placement only after verification', async () => {
    const old = crypto.randomUUID(),
      media = crypto.randomUUID();
    await owner();
    await db.query(
      "insert into public.product_media(id,product_id,media_type,provider_asset_id,delivery_url,upload_status,is_primary,sort_order,alt_text) values($1,$2,'image','legacy-id','https://imagedelivery.net/hash/legacy-id/detail','ready',true,7,'Keep this alt')",
      [old, product],
    );
    await r2Stage(media, old);
    const session = await r2Claim(media);
    await r2Plan(media, session.token);
    await db.query('select public.r2_finish_upload($1,$2,1,$3,$4)', [
      editor,
      product,
      media,
      session.token,
    ]);
    const r = await db.query(
      'select id,upload_status,is_primary,sort_order,alt_text,retired_at from public.product_media where product_id=$1 order by id',
      [product],
    );
    expect(r.rows.find((x) => x.id === old)).toMatchObject({
      upload_status: 'retired',
      is_primary: false,
    });
    expect(r.rows.find((x) => x.id === old).retired_at).not.toBeNull();
    expect(r.rows.find((x) => x.id === media)).toMatchObject({
      upload_status: 'ready',
      is_primary: true,
      sort_order: 7,
      alt_text: 'Keep this alt',
    });
  });
  it('keeps active verified public assets when reconciling their staging copy', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    const session = await r2Claim(media);
    await r2Plan(media, session.token);
    await db.query('select public.r2_finish_upload($1,$2,1,$3,$4)', [
      editor,
      product,
      media,
      session.token,
    ]);
    await db.query(
      "update public.product_media set upload_expires_at=now()-interval '11 minutes' where id=$1",
      [media],
    );
    const r = await db.query('select public.r2_prepare_cleanup($1) as plan', [media]);
    expect(r.rows[0].plan.objects).toEqual([]);
  });
  it('retains failed promotion manifests and fences attachment before cleanup', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    const session = await r2Claim(media);
    await r2Plan(media, session.token);
    await db.query('select public.r2_fail_upload($1,$2,$3)', [editor, media, session.token]);
    await db.query(
      "update public.product_media set upload_expires_at=now()-interval '11 minutes' where id=$1",
      [media],
    );
    const r = await db.query('select public.r2_prepare_cleanup($1) as plan', [media]);
    expect(r.rows[0].plan.objects).toHaveLength(3);
    await expect(
      db.query('select public.r2_finish_upload($1,$2,1,$3,$4)', [
        editor,
        product,
        media,
        session.token,
      ]),
    ).rejects.toMatchObject({ code: '40001' });
  });
  it('exposes only verified public object keys so delivery origins can change without copying objects', async () => {
    await db.query('select public.save_product_draft($1::jsonb)', [JSON.stringify(payload())]);
    await owner();
    await db.query(
      "insert into public.variant_prices(variant_id,currency_code,price_type,price_unit_id,valid_from) values($1,'BDT','on_request',$2,now())",
      [variant, unit],
    );
    const media = crypto.randomUUID();
    await r2Stage(media, null, 2);
    const session = await r2Claim(media, 2);
    const manifest = await r2Plan(media, session.token);
    await db.query('select public.r2_finish_upload($1,$2,2,$3,$4)', [
      editor,
      product,
      media,
      session.token,
    ]);
    await role(admin);
    await db.query("select public.product_lifecycle($1,3,'publish')", [product]);
    await role(editor, 'aal1', 'anon');
    const row = (
      await db.query('select image_key,image_variants from public_catalog.products where id=$1', [
        product,
      ])
    ).rows[0];
    expect(row.image_key).toBe(manifest.find((m) => m.kind === 'detail')?.key);
    expect(row.image_variants.map((m: { key: string }) => m.key).sort()).toEqual(
      manifest.map((m) => m.key).sort(),
    );
    expect(JSON.stringify(row)).not.toContain('staging/');
  });
  it('retains an object referenced through a changed delivery domain', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    const session = await r2Claim(media);
    const manifest = await r2Plan(media, session.token);
    await db.query('select public.r2_fail_upload($1,$2,$3)', [editor, media, session.token]);
    const detail = manifest.find((m) => m.kind === 'detail')!;
    await db.query('update public.categories set image_path=$1 where id=$2', [
      'https://new-images.example.com/' + detail.key,
      cat,
    ]);
    await db.query(
      "update public.product_media set upload_expires_at=now()-interval '11 minutes' where id=$1",
      [media],
    );
    const plan = (await db.query('select public.r2_prepare_cleanup($1) as plan', [media])).rows[0]
      .plan;
    expect(plan.objects).toHaveLength(2);
    expect(plan.objects.map((m: { key: string }) => m.key)).not.toContain(detail.key);
  });
  it('returns pinned bucket names required by the cleanup worker', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    await db.query(
      "update public.product_media set upload_expires_at=now()-interval '11 minutes' where id=$1",
      [media],
    );
    const r = await db.query('select public.r2_prepare_cleanup($1) as plan', [media]);
    expect(r.rows[0].plan).toMatchObject({
      staging_key: `staging/${product}/${media}`,
      staging_bucket: 'private-stage',
      public_bucket: 'public-images',
      origin: 'https://images.example.com',
      objects: [],
    });
  });
  it('refuses cleanup while a signed PUT can still be used', async () => {
    const media = crypto.randomUUID();
    await r2Stage(media);
    await expect(db.query('select public.r2_prepare_cleanup($1)', [media])).rejects.toThrow(
      'still active',
    );
  });
});
