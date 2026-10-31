import pg from 'pg';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { seedPublicCatalog } from '../tests/fixtures/public-catalog-data.mjs';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['127.0.0.1', 'localhost'].includes(new URL(connection).hostname))
  throw new Error('An isolated local TEST_DATABASE_URL is required');
const db = new pg.Client({ connectionString: connection });
await db.connect();
const report = {
  date: new Date().toISOString(),
  transport:
    'Local PostgreSQL TCP; single client; warm SQL only, not production/API/browser timings',
  results: [],
};
try {
  for (const count of [50, 500, 5000, 20000]) {
    await db.query('begin');
    try {
      await db.query("set local statement_timeout='120s'");
      await seedPublicCatalog(db, count);
      await db.query("set local statement_timeout='30s'");
      await db.query(
        'analyze public.products; analyze public.product_variants; analyze public.variant_prices; analyze public.price_tiers; analyze public.product_media; analyze public.variant_attribute_values; analyze public.product_documents',
      );
      await db.query('set local role anon');
      const queries = {
        cards:
          'select id,slug,name,product_code,short_description,image_url,display_price from public_catalog.list_product_cards()',
        filtered:
          "select id,slug,name,image_url,display_price from public_catalog.list_product_cards('synthetic-paper','','0001',false,false,1,12,'name',true)",
        detail:
          "select product,variants,documents,gallery from public_catalog.product_details where slug='synthetic-paper-1'",
      };
      const result = {
        publishedProducts: count,
        variants: count * 2,
        prices: count * 2,
        tiers: count * 4,
        media: count * 3,
        queries: {},
      };
      for (const [name, sql] of Object.entries(queries)) {
        const samples = [];
        for (let i = 0; i < 5; i++) {
          const start = performance.now();
          await db.query(sql);
          samples.push(performance.now() - start);
        }
        samples.sort((a, b) => a - b);
        result.queries[name] = {
          samples: 5,
          p50ms: +samples[2].toFixed(2),
          maxMs: +samples[4].toFixed(2),
          explain: (await db.query('explain (analyze,buffers,format json) ' + sql)).rows[0][
            'QUERY PLAN'
          ],
        };
      }
      report.results.push(result);
      fs.writeFileSync(
        'docs/verification/public-catalog-performance.json',
        JSON.stringify(report, null, 2) + '\n',
      );
      console.log(
        JSON.stringify({
          publishedProducts: count,
          ...Object.fromEntries(Object.entries(result.queries).map(([name, q]) => [name, q.p50ms])),
        }),
      );
    } finally {
      await db.query('rollback');
    }
  }
  fs.writeFileSync(
    'docs/verification/public-catalog-performance.json',
    JSON.stringify(report, null, 2) + '\n',
  );
} finally {
  await db.end();
}
