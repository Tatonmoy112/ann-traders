import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { seedPublicCatalog } from '../tests/fixtures/public-catalog-data.mjs';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['127.0.0.1', 'localhost'].includes(new URL(connection).hostname))
  throw new Error('Only an isolated local TEST_DATABASE_URL is supported');
const counts = (process.env.BENCH_COUNTS || '500,5000,20000,50000').split(',').map(Number);
if (counts.some((n) => ![500, 5000, 20000, 50000].includes(n)))
  throw new Error('Unsupported fixture count');
const db = new pg.Client({ connectionString: connection });
await db.connect();
const report = {
  executedAt: new Date().toISOString(),
  postgres: (await db.query('select version()')).rows[0].version,
  cpu: os.cpus()[0]?.model,
  memoryGiB: +(os.totalmem() / 1024 ** 3).toFixed(1),
  methodology:
    'Synthetic mixed catalog, 12 categories, physical/software/services, two variants/specs/prices, four tiers, three images and one PDF per parent. Warm loopback SQL, one client, 15 measured samples. All fixtures roll back. Excludes network/API/rendering and production claims.',
  results: [],
};
const output = process.env.BENCH_OUTPUT || 'docs/production-refinement/performance.json';
fs.mkdirSync('docs/production-refinement', { recursive: true });
try {
  for (const count of counts) {
    await db.query('begin');
    try {
      await db.query("set local statement_timeout='600s'");
      const seedStart = performance.now();
      const fixture = await seedPublicCatalog(db, count, 'REF-BENCH', { mixed: true });
      console.log(
        JSON.stringify({
          products: count,
          seededSeconds: +((performance.now() - seedStart) / 1000).toFixed(2),
        }),
      );
      await db.query(
        'analyze public.products; analyze public.product_variants; analyze public.variant_prices; analyze public.price_tiers; analyze public.product_media; analyze public.product_attribute_values; analyze public.variant_attribute_values; analyze public.product_documents; analyze public.categories',
      );
      if (process.env.BENCH_CANDIDATE_INDEX === 'true') {
        // Experimental, transaction-scoped DDL only. Compare saved plans before
        // deciding whether a production migration is justified.
        await db.query(
          "create index refinement_candidate_name on public.products(name,id) where status='published' and deleted_at is null",
        );
        report.candidateIndex = 'products(name,id) WHERE published AND not deleted';
      }
      const attribute = (
        await db.query("select id from public.attribute_definitions where code='PUB-GSM'")
      ).rows[0].id;
      if (process.env.BENCH_COMPARE_INDEX === 'true') {
        const source = fs.readFileSync(
          'supabase/migrations/20261101000400_public_catalog_discovery.sql',
          'utf8',
        );
        const inner = source
          .match(/format\(\$query\$([\s\S]*?)\$query\$/)[1]
          .replaceAll('%1$I', 'name')
          .replaceAll('%2$s', 'asc')
          .replaceAll('%3$s', '>')
          .replaceAll('%4$s', 'text')
          .replaceAll('%5$L', "'name'")
          .replaceAll('%6$L', "'asc'")
          .replaceAll('%7$s', '0::integer')
          .replaceAll('%%', '%');
        const technical = JSON.stringify([{ attribute, min: '70', max: '70' }]);
        const params = ['', '', '', false, false, 13, 0, technical, null, '', null, null];
        const measure = async () => {
          await db.query('set local role anon');
          const samples = [];
          for (let i = 0; i < 15; i++) {
            const start = performance.now();
            await db.query(
              "select public_catalog.browse_product_cards('','','',false,false,1,12,'name',true,$1)",
              [technical],
            );
            samples.push(performance.now() - start);
          }
          await db.query('reset role');
          samples.sort((a, b) => a - b);
          return {
            p50ms: +samples[7].toFixed(2),
            p95ms: +samples[14].toFixed(2),
            innerPlan: (
              await db.query('explain (analyze,buffers,verbose,format json) ' + inner, params)
            ).rows[0]['QUERY PLAN'],
          };
        };
        const before = await measure();
        await db.query(
          "create index refinement_candidate_name on public.products(name,id) where status='published' and deleted_at is null",
        );
        report.indexComparison = {
          fixtureProducts: count,
          before,
          after: await measure(),
          candidate:
            'products(name,id) WHERE published AND not deleted; created and rolled back inside this fixture transaction',
        };
      }
      await db.query("set local statement_timeout='30s'");
      const queries = {
        cards: { sql: 'select public_catalog.browse_product_cards()', params: [] },
        category: {
          sql: "select public_catalog.browse_product_cards('synthetic-fabric','','',false,false,1,12,'name',true)",
          params: [],
        },
        brand: {
          sql: "select public_catalog.browse_product_cards('','synthetic-brand')",
          params: [],
        },
        technical: {
          sql: "select public_catalog.browse_product_cards('','','',false,false,1,12,'name',true,$1)",
          params: [JSON.stringify([{ attribute, min: '70', max: '70' }])],
        },
        search: {
          sql: "select public_catalog.browse_product_cards('','','REF-BENCH-2-V1')",
          params: [],
        },
        detail: {
          sql: "select product,variants,documents,gallery from public_catalog.product_details where slug='synthetic-paper-1'",
          params: [],
        },
        facets: { sql: "select public_catalog.category_filters('synthetic-fabric')", params: [] },
        admin: {
          sql: "select public.list_admin_products('','',''::uuid, null,1,20)",
          params: [],
          role: 'authenticated',
        },
      };
      queries.admin.sql = "select public.list_admin_products('','',null,null,1,20)";
      const result = {
        products: count,
        variants: count * 2,
        prices: count * 2,
        tiers: count * 4,
        media: count * 3,
        seedSeconds: +((performance.now() - seedStart) / 1000).toFixed(2),
        queries: {},
      };
      for (const [name, query] of Object.entries(queries)) {
        await db.query('set local role ' + (query.role || 'anon'));
        await db.query(query.sql, query.params);
        const samples = [];
        let bytes = 0;
        for (let i = 0; i < 15; i++) {
          const start = performance.now();
          const response = await db.query(query.sql, query.params);
          samples.push(performance.now() - start);
          bytes = Buffer.byteLength(JSON.stringify(response.rows));
        }
        samples.sort((a, b) => a - b);
        const percentile = (p) => +samples[Math.ceil(p * samples.length) - 1].toFixed(2);
        result.queries[name] = {
          samples: 15,
          p50ms: percentile(0.5),
          p95ms: percentile(0.95),
          p99ms: percentile(0.99),
          payloadBytes: bytes,
          explain: (
            await db.query(
              'explain (analyze,buffers,verbose,format json) ' + query.sql,
              query.params,
            )
          ).rows[0]['QUERY PLAN'],
        };
        await db.query('reset role');
      }
      // PL/pgSQL wrappers obscure their inner plan. Explain the actual bound SQL
      // separately as owner; public-role timings above remain the acceptance evidence.
      const source = fs.readFileSync(
        'supabase/migrations/20261101000400_public_catalog_discovery.sql',
        'utf8',
      );
      const inner = source
        .match(/format\(\$query\$([\s\S]*?)\$query\$/)[1]
        .replaceAll('%1$I', 'updated_at')
        .replaceAll('%2$s', 'desc')
        .replaceAll('%3$s', '<')
        .replaceAll('%4$s', 'timestamptz')
        .replaceAll('%5$L', "'updated_at'")
        .replaceAll('%6$L', "'desc'")
        .replaceAll('%7$s', '0::integer')
        .replaceAll('%%', '%');
      result.innerCardsPlan = (
        await db.query('explain (analyze,buffers,verbose,format json) ' + inner, [
          '',
          '',
          '',
          false,
          false,
          13,
          0,
          '[]',
          null,
          '',
          null,
          null,
        ])
      ).rows[0]['QUERY PLAN'];
      report.results.push(result);
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      console.log(
        JSON.stringify({
          products: count,
          queries: Object.fromEntries(
            Object.entries(result.queries).map(([name, value]) => [name, value.p95ms]),
          ),
        }),
      );
      void fixture;
    } finally {
      await db.query('rollback');
    }
  }
} finally {
  await db.end();
}
