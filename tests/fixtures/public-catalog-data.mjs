// Synthetic data for isolated local databases only. Caller owns transaction/rollback.
export async function seedPublicCatalog(db, count, prefix = 'PUBLIC-BENCH', options = {}) {
  const actor = (await db.query('insert into auth.users default values returning id')).rows[0].id;
  await db.query(
    "insert into public.admin_profiles(id,full_name,role) values($1,'Synthetic public test','admin')",
    [actor],
  );
  const category = (
    await db.query(
      "insert into public.categories(name,slug) values('Synthetic paper','synthetic-paper') returning id",
    )
  ).rows[0].id;
  const brand = (
    await db.query(
      "insert into public.brands(name,slug) values('Synthetic brand','synthetic-brand') returning id",
    )
  ).rows[0].id;
  const unit = (
    await db.query(
      "insert into public.units(name,code,symbol,unit_family) values('Test kilogram','PUB-KG','kg','mass') returning id",
    )
  ).rows[0].id;
  const attribute = (
    await db.query(
      "insert into public.attribute_definitions(name,code,data_type,is_filterable) values('Grammage','PUB-GSM','number',true) returning id",
    )
  ).rows[0].id;
  await db.query(
    "insert into public.category_attributes(category_id,attribute_id,applies_to) values($1,$2,'variant')",
    [category, attribute],
  );
  await db.query(
    `insert into public.products(name,slug,product_code,primary_category_id,brand_id,product_type,status,created_by,updated_by,
    short_description,description,is_featured,is_new_arrival,published_at)
    select 'Synthetic Paper '||lpad(g::text,5,'0'),'synthetic-paper-'||g,$2||'-'||g,$3,$4,'physical','draft',$5,$5,
    'Synthetic public product for validation only',repeat('Detailed application notes. ',100),g%2=0,g%3=0,now()
    from generate_series(1,$1) g`,
    [count, prefix, category, brand, actor],
  );
  await db.query(
    `insert into public.product_variants(product_id,sku,variant_name,base_unit_id,minimum_order_unit_id,capacity_unit_id,
    availability_status,is_default,minimum_order_qty,monthly_supply_capacity,sort_order)
    select p.id,p.product_code||'-V'||g,'Paper variant '||g,$2,$2,$2,'in_stock',g=1,100,2000,g
    from public.products p cross join generate_series(1,2) g where p.product_code like $1`,
    [prefix + '-%', unit],
  );
  if (options.mixed) {
    const families = [
      'fabric',
      'yarn',
      'cad-paper',
      'plotter-supplies',
      'machines',
      'spare-parts',
      'chemicals',
      'printing',
      'safety-signs',
      'software',
      'services',
    ];
    const categoryIds = [category];
    for (const family of families)
      categoryIds.push(
        (
          await db.query(
            'insert into public.categories(name,slug,parent_id) values($1,$2,$3) returning id',
            ['Synthetic ' + family, 'synthetic-' + family, category],
          )
        ).rows[0].id,
      );
    const pcs = (
      await db.query(
        "insert into public.units(name,code,symbol,unit_family) values('Synthetic piece/license','PUB-PC','pc','count') returning id",
      )
    ).rows[0].id;
    const hour = (
      await db.query(
        "insert into public.units(name,code,symbol,unit_family) values('Synthetic service hour','PUB-HR','hr','time') returning id",
      )
    ).rows[0].id;
    await db.query(
      `update public.products set primary_category_id=($2::uuid[])[1+substring(product_code from '[0-9]+$')::integer%12]
      where product_code like $1`,
      [prefix + '-%', categoryIds],
    );
    await db.query(
      `update public.products p set product_type=case when c.slug='synthetic-software' then 'software'
      when c.slug='synthetic-services' then 'service' else 'physical' end from public.categories c
      where c.id=p.primary_category_id and p.product_code like $1`,
      [prefix + '-%'],
    );
    await db.query(
      `update public.product_variants v set variant_name='Synthetic variant '||v.sort_order,
      base_unit_id=case when p.product_type='service' then $3::uuid when c.slug in ('synthetic-paper','synthetic-fabric','synthetic-yarn','synthetic-cad-paper','synthetic-chemicals') then $4::uuid else $2::uuid end,
      minimum_order_unit_id=case when p.product_type='service' then $3::uuid when c.slug in ('synthetic-paper','synthetic-fabric','synthetic-yarn','synthetic-cad-paper','synthetic-chemicals') then $4::uuid else $2::uuid end,
      capacity_unit_id=case when p.product_type='service' then $3::uuid when c.slug in ('synthetic-paper','synthetic-fabric','synthetic-yarn','synthetic-cad-paper','synthetic-chemicals') then $4::uuid else $2::uuid end
      from public.products p join public.categories c on c.id=p.primary_category_id where v.product_id=p.id and p.product_code like $1`,
      [prefix + '-%', pcs, hour, unit],
    );
    await db.query(
      "update public.attribute_definitions set name='Synthetic technical rating' where id=$1",
      [attribute],
    );
  }
  await db.query(
    `insert into public.variant_prices(variant_id,currency_code,price_type,min_price,max_price,price_unit_id,valid_from,valid_until)
    select v.id,'BDT',case when v.is_default then 'fixed' else 'range' end,
      case when v.is_default then 100 else 120 end,case when v.is_default then null else 140 end,v.base_unit_id,now()-interval '1 day',now()+interval '7 days'
    from public.product_variants v where v.sku like $1`,
    [prefix + '-%'],
  );
  await db.query(
    `insert into public.price_tiers(variant_price_id,min_quantity,max_quantity,quantity_unit_id,unit_price,sort_order)
    select pr.id,case when g=1 then 100 else 500 end,case when g=1 then 500 else null end,pr.price_unit_id,
      case when g=1 then 95 else 90 end,g
    from public.variant_prices pr join public.product_variants v on v.id=pr.variant_id cross join generate_series(1,2) g where v.sku like $1`,
    [prefix + '-%'],
  );
  // Avoid repeatedly replanning duplicate checks against stale empty-table
  // statistics during bulk fixture generation. Read benchmarks use defaults.
  await db.query('set local enable_seqscan=off');
  await db.query(
    `insert into public.variant_attribute_values(variant_id,attribute_id,value_number)
    select id,$2,70 from public.product_variants where sku like $1`,
    [prefix + '-%', attribute],
  );
  await db.query('set local enable_seqscan=on');
  await db.query(
    `insert into public.variant_packaging(variant_id,packaging_type,pack_quantity,pack_unit_id)
    select id,'Synthetic pack',25,base_unit_id from public.product_variants where sku like $1`,
    [prefix + '-%'],
  );
  await db.query(
    `insert into public.product_media(product_id,media_type,provider_asset_id,delivery_url,upload_status,is_primary,sort_order,object_manifest)
    select p.id,'image','synthetic-'||p.id||'-'||g,'https://imagedelivery.net/synthetic/'||p.id||'-'||g||'/detail','ready',g=1,g,
      (select jsonb_agg(jsonb_build_object('kind',kind,'url','https://imagedelivery.net/synthetic/'||p.id||'-'||g||'/'||kind,
        'key','public/'||p.id||'/'||g||'/'||kind||'.webp','width',width,'height',width))
        from (values('thumbnail',320),('card',768),('detail',2000)) sizes(kind,width))
    from public.products p cross join generate_series(1,3) g where p.product_code like $1`,
    [prefix + '-%'],
  );
  await db.query(
    `insert into public.product_documents(product_id,title,document_type,storage_path,is_public,file_extension)
    select id,'Synthetic technical sheet','TDS','private/'||id||'.pdf',true,'pdf'
    from public.products where product_code like $1`,
    [prefix + '-%'],
  );
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: actor, role: 'authenticated', aal: 'aal2' }),
  ]);
  // Publication executes correlated integrity checks. Give the planner actual
  // fixture statistics before validating thousands of rows in this transaction.
  await db.query(
    'analyze public.products; analyze public.product_variants; analyze public.variant_prices; analyze public.product_media; analyze public.product_attribute_values; analyze public.variant_attribute_values; analyze public.variant_fiber_composition; analyze public.product_extra_categories',
  );
  await db.query("update public.products set status='published' where product_code like $1", [
    prefix + '-%',
  ]);
  return { actor, category, brand, unit };
}
