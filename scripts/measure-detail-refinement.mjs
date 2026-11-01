import pg from 'pg';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { seedPublicCatalog } from '../tests/fixtures/public-catalog-data.mjs';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['127.0.0.1', 'localhost'].includes(new URL(connection).hostname))
  throw new Error('Use an isolated local database');
const db = new pg.Client({ connectionString: connection });
await db.connect();
try {
  await db.query('begin');
  await seedPublicCatalog(db, 5000, 'DETAIL-PLAN', { mixed: true });
  await db.query(
    'analyze public.products; analyze public.product_variants; analyze public.product_documents; analyze public.product_media',
  );
  const measure = async () => {
    await db.query('set local role anon');
    const sql =
      "select product,variants,documents,gallery from public_catalog.product_details where slug='synthetic-paper-1'";
    const samples = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      await db.query(sql);
      samples.push(performance.now() - start);
    }
    const plan = (await db.query('explain (analyze,buffers,verbose,format json) ' + sql)).rows[0][
      'QUERY PLAN'
    ];
    await db.query('reset role');
    samples.sort((a, b) => a - b);
    return { p50ms: +samples[7].toFixed(2), p95ms: +samples[14].toFixed(2), plan };
  };
  const before = await measure();
  const source = fs.readFileSync(
    'supabase/migrations/20261101000900_detail_visibility_plan.sql',
    'utf8',
  );
  const begin = source.indexOf('create or replace view');
  await db.query(source.slice(begin, source.indexOf('notify pgrst', begin)));
  const after = await measure();
  fs.writeFileSync(
    'docs/production-refinement/detail-plan-comparison.json',
    JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        products: 5000,
        environment:
          'Same transaction/fixture, local anonymous PostgreSQL, 15 warm samples. Both fixture rows and experimental view definition roll back.',
        before,
        after,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ beforeP95ms: before.p95ms, afterP95ms: after.p95ms }));
} finally {
  await db.query('rollback');
  await db.end();
}
