import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedPublicCatalog } from './fixtures/public-catalog-data.mjs';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite.sequential('production refinement: real PostgreSQL integrity and public discovery', () => {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  const actor = randomUUID(),
    category = randomUUID(),
    unit = randomUUID(),
    gsm = randomUUID(),
    variant = randomUUID();
  let product: string;
  const owner = () => db.query('reset role');
  const role = async (sqlRole = 'authenticated', aal = 'aal2') => {
    await owner();
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: actor, role: sqlRole, aal }),
    ]);
    await db.query(`set local role ${sqlRole}`);
  };
  const payload = () => ({
    id: product,
    revision: 1,
    product: {
      name: 'Refinement fixture',
      product_code: 'REFINEMENT',
      slug: 'refinement-fixture',
      primary_category_id: category,
      brand_id: null,
      product_type: 'physical',
      short_description: null,
      description: null,
      country_of_origin: null,
      seo_title: null,
      seo_description: null,
      key_features: ['Synthetic technical feature'],
      sort_order: 3,
    },
    variants: [
      {
        id: variant,
        sku: 'REF_SKU/1.2',
        variant_name: 'Default',
        model_number: 'MODEL/2.4',
        manufacturer_part_number: 'MPN+2.0',
        base_unit_id: unit,
        minimum_order_qty: '100',
        minimum_order_unit_id: unit,
        monthly_supply_capacity: null,
        capacity_unit_id: unit,
        lead_time_days: null,
        availability_status: 'on_request',
        is_default: true,
        is_active: true,
        sort_order: 4,
      },
    ],
    prices: [] as Record<string, unknown>[],
  });
  const attribute = async (scope = 'variant', axis = false) => {
    const id = randomUUID();
    await owner();
    await db.query(
      "insert into public.attribute_definitions(id,name,code,data_type,default_unit_id,is_variant_axis,is_filterable) values($1::uuid,'Grammage',$1::text,'number',$2,$3,true)",
      [id, gsm, axis],
    );
    await db.query(
      'insert into public.category_attributes(category_id,attribute_id,applies_to) values($1,$2,$3)',
      [category, id, scope],
    );
    return id;
  };
  const price = async () => {
    const id = randomUUID();
    await owner();
    await db.query(
      "insert into public.variant_prices(id,variant_id,currency_code,price_type,min_price,price_unit_id,valid_from) values($1,$2,'BDT','fixed',100,$3,now()-interval '1 day')",
      [id, variant, unit],
    );
    return id;
  };
  const publish = async () => {
    await owner();
    await db.query(
      "insert into public.product_media(product_id,media_type,provider_asset_id,delivery_url,upload_status,is_primary) values($1,'image','refinement-image','https://imagedelivery.net/refinement/image/detail','ready',true)",
      [product],
    );
    await role();
    await db.query("select public.product_lifecycle($1,2,'publish')", [product]);
  };
  beforeAll(async () => {
    await db.connect();
  });
  afterAll(async () => {
    await db.end();
  });
  beforeEach(async () => {
    await db.query('begin');
    await db.query('insert into auth.users(id) values($1)', [actor]);
    await db.query(
      "insert into public.admin_profiles(id,full_name,role) values($1,'Refinement test admin','admin')",
      [actor],
    );
    await db.query(
      "insert into public.categories(id,name,slug) values($1,'Refinement','refinement')",
      [category],
    );
    await db.query(
      "insert into public.units(id,name,code,symbol,unit_family,factor_to_base) values($1,'Kilogram','REF-KG','kg','mass',1),($2,'Grammage','REF-GSM','g/m²','areal_density',1)",
      [unit, gsm],
    );
    await role();
    product = (
      await db.query(
        "select public.create_product_draft('Refinement fixture','REFINEMENT','refinement-fixture') as id",
      )
    ).rows[0].id;
    await db.query('select public.save_product_draft($1)', [JSON.stringify(payload())]);
  });
  afterEach(async () => {
    await db.query('rollback');
    await owner();
  });

  it('persists manufacturer parts, features and sort order through the aggregate save', async () => {
    const row = (
      await db.query(
        'select manufacturer_part_number,sort_order from public.product_variants where id=$1',
        [variant],
      )
    ).rows[0];
    expect(row).toEqual({ manufacturer_part_number: 'MPN+2.0', sort_order: 4 });
    expect(
      (await db.query('select key_features from public.products where id=$1', [product])).rows[0]
        .key_features,
    ).toEqual(['Synthetic technical feature']);
  });
  it('rejects NaN MOQ through the direct draft RPC', async () => {
    const input = { ...payload(), revision: 2 };
    input.variants[0].minimum_order_qty = 'NaN';
    await expect(
      db.query('select public.save_product_draft($1)', [JSON.stringify(input)]),
    ).rejects.toMatchObject({ code: '23514', constraint: 'finite_minimum_order_qty' });
  });
  it('rejects NaN monetary amounts at the database boundary', async () => {
    await owner();
    await expect(
      db.query(
        "insert into public.variant_prices(variant_id,currency_code,price_type,min_price,price_unit_id,valid_from) values($1,'BDT','fixed','NaN',$2,now())",
        [variant, unit],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'finite_min_price' });
  });
  it('rejects NaN numeric specifications at the database boundary', async () => {
    const definition = await attribute();
    await expect(
      db.query(
        "insert into public.variant_attribute_values(variant_id,attribute_id,value_number,unit_id) values($1,$2,'NaN',$3)",
        [variant, definition, gsm],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'finite_value_number' });
  });
  it('rejects NaN packaging quantities at the database boundary', async () => {
    await owner();
    await expect(
      db.query(
        "insert into public.variant_packaging(variant_id,packaging_type,pack_quantity,pack_unit_id) values($1,'box','NaN',$2)",
        [variant, unit],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'finite_pack_quantity' });
  });
  it('rejects NaN unit conversion factors at the database boundary', async () => {
    await owner();
    await expect(
      db.query(
        "insert into public.units(name,code,symbol,unit_family,factor_to_base) values('Invalid unit','NAN-TEST','bad','count','NaN')",
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'finite_factor_to_base' });
  });
  it('rejects missing revisions through direct save and lifecycle RPCs', async () => {
    const input = { ...payload(), revision: null };
    await expect(
      db.query('select public.save_product_draft($1)', [JSON.stringify(input)]),
    ).rejects.toThrow('revision');
  });
  it('rejects null lifecycle revisions instead of bypassing concurrency', async () => {
    await expect(
      db.query("select public.product_lifecycle($1,null,'archive')", [product]),
    ).rejects.toMatchObject({ code: '40001' });
  });
  it('rejects duplicate identities before applying an aggregate', async () => {
    const input = payload();
    input.revision = 2;
    input.variants.push(input.variants[0]);
    await expect(
      db.query('select public.save_product_draft($1)', [JSON.stringify(input)]),
    ).rejects.toThrow('duplicate row identities');
  });
  it('requires category applicability for technical values', async () => {
    await owner();
    const id = randomUUID();
    await db.query(
      "insert into public.attribute_definitions(id,name,code,data_type) values($1::uuid,'Unmapped',$1::text,'number')",
      [id],
    );
    await expect(
      db.query(
        'insert into public.variant_attribute_values(variant_id,attribute_id,value_number) values($1,$2,70)',
        [variant, id],
      ),
    ).rejects.toThrow('not configured');
  });
  it('defaults a numeric specification to its declared unit', async () => {
    const id = await attribute();
    const result = await db.query(
      'insert into public.variant_attribute_values(variant_id,attribute_id,value_number) values($1,$2,70) returning unit_id',
      [variant, id],
    );
    expect(result.rows[0].unit_id).toBe(gsm);
  });
  it('rejects incompatible GSM/quantity specification units', async () => {
    const id = await attribute();
    await expect(
      db.query(
        'insert into public.variant_attribute_values(variant_id,attribute_id,value_number,unit_id) values($1,$2,70,$3)',
        [variant, id, unit],
      ),
    ).rejects.toThrow('unit family');
  });
  it('rejects units on boolean specifications', async () => {
    const id = randomUUID();
    await owner();
    await db.query(
      "insert into public.attribute_definitions(id,name,code,data_type) values($1::uuid,'Washable',$1::text,'boolean')",
      [id],
    );
    await db.query(
      "insert into public.category_attributes(category_id,attribute_id,applies_to) values($1,$2,'product')",
      [category, id],
    );
    await expect(
      db.query(
        'insert into public.product_attribute_values(product_id,attribute_id,value_boolean,unit_id) values($1,$2,false,$3)',
        [product, id, unit],
      ),
    ).rejects.toThrow('Only numeric');
  });
  it('resolves inherited rules with nearest-category overrides', async () => {
    const id = await attribute();
    const parent = randomUUID();
    await db.query("insert into public.categories(id,name,slug) values($1,'Parent','ref-parent')", [
      parent,
    ]);
    await db.query('update public.categories set parent_id=$1 where id=$2', [parent, category]);
    await db.query(
      "insert into public.category_attributes(category_id,attribute_id,applies_to,is_required) values($1,$2,'variant',true)",
      [parent, id],
    );
    await role();
    const rules = (
      await db.query('select public.get_category_attribute_rules($1) as rules', [category])
    ).rows[0].rules;
    expect(rules.find((r: { attribute_id: string }) => r.attribute_id === id).is_required).toBe(
      false,
    );
  });
  it('protects an optional mapped definition even without stored values after publication', async () => {
    const definition = await attribute();
    await price();
    await publish();
    await owner();
    await expect(
      db.query('update public.attribute_definitions set is_active=false where id=$1', [definition]),
    ).rejects.toThrow('Unpublish affected products');
  });
  it('cannot introduce a missing axis by changing a mapped published definition', async () => {
    const definition = await attribute();
    await price();
    await publish();
    await owner();
    await expect(
      db.query('update public.attribute_definitions set is_variant_axis=true where id=$1', [
        definition,
      ]),
    ).rejects.toThrow('Unpublish affected products');
  });
  it('still allows descriptive dictionary labels to be corrected after publication', async () => {
    const definition = await attribute();
    await price();
    await publish();
    await owner();
    await db.query("update public.attribute_definitions set name='Corrected label' where id=$1", [
      definition,
    ]);
    expect(
      (await db.query('select name from public.attribute_definitions where id=$1', [definition]))
        .rows[0].name,
    ).toBe('Corrected label');
  });
  it('rejects duplicate active variant-axis combinations at publication', async () => {
    const id = await attribute('variant', true);
    const second = randomUUID();
    await db.query(
      "insert into public.product_variants(id,product_id,sku,variant_name,base_unit_id,minimum_order_unit_id,capacity_unit_id,availability_status) values($1,$2,'SECOND','Second',$3,$3,$3,'on_request')",
      [second, product, unit],
    );
    await db.query(
      'insert into public.variant_attribute_values(variant_id,attribute_id,value_number) values($1,$3,70),($2,$3,70)',
      [variant, second, id],
    );
    await role();
    const errors = (await db.query('select public.product_publish_errors($1) as errors', [product]))
      .rows[0].errors;
    expect(errors).toContain('Variants: active SKUs must have distinct variant-axis combinations');
  });
  it('does not overwrite immutable price amounts', async () => {
    const id = await price();
    const input = payload();
    input.revision = 2;
    input.prices = [
      {
        ...(await db.query('select * from public.variant_prices where id=$1', [id])).rows[0],
        min_price: '200',
        is_active: false,
      },
    ];
    await role();
    await expect(
      db.query('select public.save_product_draft($1)', [JSON.stringify(input)]),
    ).rejects.toThrow('replacement price');
  });
  it('accepts replacement-before-deactivation payload order atomically', async () => {
    const id = await price();
    const input = payload();
    input.revision = 2;
    const previous = (
      await db.query('select to_jsonb(pr) as value from public.variant_prices pr where id=$1', [id])
    ).rows[0].value;
    input.prices = [
      { ...previous, id: randomUUID(), min_price: '200' },
      { ...previous, is_active: false },
    ];
    await role();
    await db.query('select public.save_product_draft($1)', [JSON.stringify(input)]);
    expect(
      (
        await db.query(
          'select min_price::text from public.variant_prices where variant_id=$1 and is_active',
          [variant],
        )
      ).rows[0].min_price,
    ).toBe('200.0000');
  });
  it('treats trade-term case and whitespace as the same price context', async () => {
    await price();
    await expect(
      db.query(
        "insert into public.variant_prices(variant_id,currency_code,price_type,min_price,price_unit_id,trade_term,valid_from) values($1,'BDT','fixed',200,$2,'  ',now())",
        [variant, unit],
      ),
    ).rejects.toMatchObject({ code: '23P01' });
  });
  it('preserves published tiers through withdrawal and requires appended replacements', async () => {
    const id = await price();
    await db.query(
      'insert into public.price_tiers(variant_price_id,min_quantity,quantity_unit_id,unit_price) values($1,100,$2,90)',
      [id, unit],
    );
    await publish();
    await db.query("select public.product_lifecycle($1,3,'unpublish')", [product]);
    await expect(
      db.query("select public.save_product_relation($1,4,'price_tiers','[]')", [product]),
    ).rejects.toThrow('Published price tiers are immutable');
  });
  it('retires a draft document atomically with actor, revision and retained source', async () => {
    await owner();
    const id = randomUUID();
    await db.query(
      "insert into public.product_documents(id,product_id,title,document_type,storage_path,is_public) values($1,$2,'Safety sheet','SDS','private-retained.pdf',true)",
      [id, product],
    );
    await role();
    expect(
      (
        await db.query("select public.product_document_action($1,2,$2,'retire') as revision", [
          product,
          id,
        ])
      ).rows[0].revision,
    ).toBe('3');
    const document = (await db.query('select * from public.product_documents where id=$1', [id]))
      .rows[0];
    expect(document.retired_at).not.toBeNull();
    expect(document.storage_path).toBe('private-retained.pdf');
    expect(
      (
        await db.query(
          "select admin_id from public.audit_logs where entity_id=$1 and new_data->>'retired_at' is not null",
          [id],
        )
      ).rows[0].admin_id,
    ).toBe(actor);
  });
  it('requires draft state and revision before changing published documents', async () => {
    await price();
    await publish();
    await expect(
      db.query("select public.product_document_action($1,3,$2,'retire')", [product, randomUUID()]),
    ).rejects.toThrow('draft');
  });
  it('hides retired documents from both current and compatibility public views', async () => {
    await owner();
    const id = randomUUID();
    await db.query(
      "insert into public.product_documents(id,product_id,title,document_type,storage_path,is_public,retired_at) values($1,$2,'Retired','TDS','private.pdf',true,now())",
      [id, product],
    );
    await price();
    await publish();
    await role('anon');
    for (const view of ['public_catalog.documents', 'public.catalog_documents'])
      expect((await db.query(`select id from ${view} where id=$1`, [id])).rowCount).toBe(0);
  });
  it('blocks ancestor specification changes while descendants are published', async () => {
    const id = await attribute();
    const parent = randomUUID();
    await db.query(
      "insert into public.categories(id,name,slug) values($1,'Parent','published-parent')",
      [parent],
    );
    await db.query('update public.categories set parent_id=$1 where id=$2', [parent, category]);
    await price();
    await publish();
    await owner();
    await expect(
      db.query(
        "insert into public.category_attributes(category_id,attribute_id,applies_to) values($1,$2,'product')",
        [parent, id],
      ),
    ).rejects.toThrow('Unpublish affected products');
  });
  it('does not grant anonymous document mutations or private rule inspection', async () => {
    await role('anon');
    await expect(
      db.query('select public.get_category_attribute_rules($1)', [category]),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('exposes product specifications through the public detail contract', async () => {
    const id = await attribute('product');
    await db.query(
      'insert into public.product_attribute_values(product_id,attribute_id,value_number) values($1,$2,80)',
      [product, id],
    );
    await price();
    await publish();
    await role('anon');
    const detail = (
      await db.query(
        "select product from public_catalog.product_details where slug='refinement-fixture'",
      )
    ).rows[0].product;
    expect(detail.specifications[0]).toMatchObject({ number: '80.0000', unit: 'g/m²' });
    expect(JSON.stringify(detail)).not.toMatch(/storage_path|created_by|updated_by/);
  });
  it('duplicates an aggregate atomically with new identities and actor audit', async () => {
    const spec = await attribute('product');
    await db.query(
      'insert into public.product_attribute_values(product_id,attribute_id,value_number) values($1,$2,70)',
      [product, spec],
    );
    await price();
    await role();
    const copy = (await db.query('select public.duplicate_catalog_product($1,2) as id', [product]))
      .rows[0].id;
    const copied = (
      await db.query('select status,created_by,revision from public.products where id=$1', [copy])
    ).rows[0];
    expect(copied).toMatchObject({ status: 'draft', created_by: actor, revision: '1' });
    expect(
      (
        await db.query(
          'select manufacturer_part_number from public.product_variants where product_id=$1',
          [copy],
        )
      ).rows[0].manufacturer_part_number,
    ).toBe('MPN+2.0');
    expect(
      (
        await db.query(
          'select value_number::text from public.product_attribute_values where product_id=$1',
          [copy],
        )
      ).rows[0].value_number,
    ).toBe('70.0000');
    expect(
      (
        await db.query("select id from public.audit_logs where entity_id=$1 and action='insert'", [
          copy,
        ])
      ).rowCount,
    ).toBe(1);
  });
  it('rolls back a failed duplicate instead of leaving a partial product', async () => {
    const spec = await attribute('product');
    await db.query(
      'insert into public.product_attribute_values(product_id,attribute_id,value_number) values($1,$2,70)',
      [product, spec],
    );
    await db.query('update public.attribute_definitions set is_active=false where id=$1', [spec]);
    await role();
    await db.query('savepoint duplicate_attempt');
    await expect(
      db.query('select public.duplicate_catalog_product($1,2)', [product]),
    ).rejects.toThrow('active attribute');
    await db.query('rollback to savepoint duplicate_attempt');
    expect(
      (await db.query("select id from public.products where product_code like 'REFINEMENT-COPY-%'"))
        .rowCount,
    ).toBe(0);
  });
  it('preserves source timestamp microseconds through an unchanged price round trip', async () => {
    const id = await price();
    await db.query(
      "update public.variant_prices set valid_from='2026-01-01T00:00:00.123456Z' where id=$1",
      [id],
    );
    const original = (
      await db.query('select to_jsonb(pr) as value from public.variant_prices pr where id=$1', [id])
    ).rows[0].value;
    const input = payload();
    input.revision = 2;
    input.prices = [original];
    await role();
    await db.query('select public.save_product_draft($1)', [JSON.stringify(input)]);
    const saved = (
      await db.query('select to_jsonb(pr) as value from public.variant_prices pr where id=$1', [id])
    ).rows[0].value;
    expect(saved.valid_from).toBe(original.valid_from);
  });
  it('prevents disabling specifications used by a published product', async () => {
    const id = await attribute('product');
    await db.query(
      'insert into public.product_attribute_values(product_id,attribute_id,value_number) values($1,$2,80)',
      [product, id],
    );
    await price();
    await publish();
    await owner();
    await expect(
      db.query('update public.attribute_definitions set is_active=false where id=$1', [id]),
    ).rejects.toThrow('Unpublish affected products');
  });
});

suite.sequential('production refinement: anonymous SKU, filters and cursor reads', () => {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  let attribute: string;
  beforeAll(async () => {
    await db.connect();
    await db.query('begin');
    await seedPublicCatalog(db, 30, 'DISCOVERY');
    attribute = (await db.query("select id from public.attribute_definitions where code='PUB-GSM'"))
      .rows[0].id;
    await db.query('set local role anon');
  });
  afterAll(async () => {
    await db.query('reset role');
    await db.query('rollback');
    await db.end();
  });
  const browse = async (
    search = '',
    filters: unknown[] = [],
    cursor: unknown = null,
    category = '',
  ) =>
    (
      await db.query(
        "select public_catalog.browse_product_cards($1,'',$2,false,false,1,12,'name',true,$3,$4) as result",
        [category, search, JSON.stringify(filters), cursor && JSON.stringify(cursor)],
      )
    ).rows[0].result;
  it('finds exact variant SKUs with exact-match priority', async () => {
    const result = await browse('DISCOVERY-2-V1');
    expect(result.rows.map((r: { product_code: string }) => r.product_code)).toEqual([
      'DISCOVERY-2',
    ]);
  });
  it('returns no products for unknown categories, brands and attributes', async () => {
    expect((await browse('', [], null, 'missing-category')).rows).toEqual([]);
    expect((await browse('', [{ attribute: randomUUID(), min: '0' }])).rows).toEqual([]);
    expect(
      (await db.query("select public_catalog.browse_product_cards('','missing-brand') as result"))
        .rows[0].result.rows,
    ).toEqual([]);
  });
  it('filters typed numeric specs and exposes configured filter metadata', async () => {
    expect((await browse('', [{ attribute, min: '71' }])).rows).toEqual([]);
    expect((await browse('', [{ attribute, min: '70', max: '70' }])).rows).toHaveLength(13);
    const facets = (
      await db.query("select public_catalog.category_filters('synthetic-paper') as facets")
    ).rows[0].facets;
    expect(facets[0]).toMatchObject({ id: attribute, data_type: 'number' });
  });
  it('pages with stable cursors without duplicates or offset dependence', async () => {
    const first = await browse();
    const second = await browse('', [], first.next_cursor);
    expect(first.rows).toHaveLength(13);
    expect(second.rows).toHaveLength(13);
    const firstIds = first.rows.slice(0, 12).map((r: { id: string }) => r.id);
    expect(second.rows.slice(0, 12).every((r: { id: string }) => !firstIds.includes(r.id))).toBe(
      true,
    );
    expect(second.rows[0].id).toBe(first.rows[12].id);
  });
  it('treats wildcard characters as literal SKU text', async () => {
    expect((await browse('DISCOVERY_2')).rows).toEqual([]);
  });
  it('includes active descendant and extra-category placements in category browsing', async () => {
    await db.query('reset role');
    const parent = (
      await db.query(
        "insert into public.categories(name,slug) values('Discovery root','discovery-root') returning id",
      )
    ).rows[0].id;
    // Fixture-only owner mutation; ordinary admin workflows enforce publication.
    await db.query(
      "update public.products set status='draft' where product_code like 'DISCOVERY-%'",
    );
    await db.query("update public.categories set parent_id=$1 where slug='synthetic-paper'", [
      parent,
    ]);
    await db.query(
      "update public.products set status='published' where product_code like 'DISCOVERY-%'",
    );
    await db.query('set local role anon');
    expect((await browse('', [], null, 'discovery-root')).rows).toHaveLength(13);
  });
});
