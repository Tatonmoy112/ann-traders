import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['127.0.0.1', 'localhost'].includes(new URL(connection).hostname))
  throw new Error('Set TEST_DATABASE_URL to an isolated local database');
const db = new pg.Client({ connectionString: connection });
await db.connect();
const report = {
  date: new Date().toISOString(),
  postgres: (await db.query('select version()')).rows[0].version,
  hardware: {
    platform: process.platform,
    cpu: os.cpus()[0].model,
    logicalCpus: os.cpus().length,
    memoryGB: Math.round(os.totalmem() / 1024 ** 3),
  },
  transport: 'Loopback TCP, single client, warm cache, no concurrent load',
  results: [],
};
for (const count of [500, 5000, 20000]) {
  await db.query('begin');
  try {
    await db.query("insert into auth.users(id) values('50000000-0000-4000-8000-000000000001')");
    await db.query(
      "insert into public.admin_profiles(id,full_name,role) values('50000000-0000-4000-8000-000000000001','Synthetic benchmark editor','editor')",
    );
    const {
      rows: [category],
    } = await db.query(
      "insert into public.categories(name,slug) values('Synthetic benchmark category','synthetic-benchmark-category') returning id",
    );
    const {
      rows: [unit],
    } = await db.query(
      "insert into public.units(name,code,symbol,unit_family) values('Synthetic kilogram','BENCH-KG','kg','mass') returning id",
    );
    const {
      rows: [attribute],
    } = await db.query(
      "insert into public.attribute_definitions(name,code,data_type) values('Synthetic GSM','BENCH-GSM','number') returning id",
    );
    await db.query(
      "insert into public.products(name,product_code,slug,primary_category_id,product_type,status,created_by,updated_by) select 'Synthetic Marker Paper '||g,'BENCH-'||g,'synthetic-marker-paper-'||g,$2,'physical','draft','50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001' from generate_series(1,$1) g",
      [count, category.id],
    );
    await db.query(
      "insert into public.product_variants(product_id,sku,variant_name,base_unit_id,minimum_order_unit_id,capacity_unit_id,availability_status,is_default) select p.id,p.product_code||'-'||g,'Synthetic variant '||g,$1,$1,$1,'on_request',g=1 from public.products p cross join generate_series(1,2) g where p.product_code like 'BENCH-%'",
      [unit.id],
    );
    await db.query(
      "insert into public.variant_prices(variant_id,currency_code,price_type,price_unit_id,valid_from) select id,'BDT','on_request',$1,now() from public.product_variants where sku like 'BENCH-%'",
      [unit.id],
    );
    await db.query(
      "insert into public.variant_attribute_values(variant_id,attribute_id,value_number) select id,$1,70 from public.product_variants where sku like 'BENCH-%'",
      [attribute.id],
    );
    await db.query(
      "insert into public.product_media(product_id,media_type,provider_asset_id,delivery_url,upload_status,is_primary) select id,'image','synthetic-'||id,'https://imagedelivery.net/synthetic/'||id||'/detail','ready',true from public.products where product_code like 'BENCH-%'",
    );
    await db.query(
      'analyze public.products; analyze public.product_variants; analyze public.variant_prices; analyze public.variant_attribute_values;',
    );
    await db.query(
      'select set_config(\'request.jwt.claims\',\'{"sub":"50000000-0000-4000-8000-000000000001","aal":"aal1"}\',true)',
    );
    await db.query('set local role authenticated');
    const samples = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      await db.query("select public.list_admin_products($1,'',null,null,1,20,'updated_at',false)", [
        i % 2 ? 'BENCH-249' : 'Marker',
      ]);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const plan = await db.query(
      "explain (analyze,buffers,format json) select id from public.products where product_code ilike '%BENCH-249%' order by updated_at desc,id limit 20",
    );
    report.results.push({
      products: count,
      variants: count * 2,
      specifications: count * 2,
      prices: count * 2,
      images: count,
      samples: 15,
      p50ms: Math.round(samples[7] * 10) / 10,
      p95ms: Math.round(samples[14] * 10) / 10,
      indexedFilterPlan: plan.rows[0]['QUERY PLAN'],
    });
  } finally {
    await db.query('rollback');
  }
}
fs.mkdirSync('docs/verification', { recursive: true });
fs.writeFileSync('docs/verification/performance.json', JSON.stringify(report, null, 2));
await db.end();
console.log(
  JSON.stringify(
    report.results.map(({ indexedFilterPlan, ...rest }) => rest),
    null,
    2,
  ),
);
