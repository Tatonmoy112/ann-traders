// Creates new, retained, isolated local databases. Never resets an existing DB.
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { seedPublicCatalog } from '../tests/fixtures/public-catalog-data.mjs';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['127.0.0.1', 'localhost'].includes(new URL(connection).hostname))
  throw new Error('Only an isolated local database is supported');
const bootstrap = fs.readFileSync('scripts/local-postgres-bootstrap.sql', 'utf8');
const migrations = fs
  .readdirSync('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort();
const owner = new pg.Client({ connectionString: connection });
await owner.connect();
const report = {
  executedAt: new Date().toISOString(),
  scope: 'Local PostgreSQL with test Auth/Storage substitutes; no remote operations',
  checks: [],
  databases: [],
};
const record = (check) => {
  report.checks.push({ check, result: 'PASS' });
  console.log('PASS ' + check);
};
async function createDatabase(kind) {
  const name = `ann_refinement_${kind}_${Date.now()}`;
  assert.match(name, /^ann_refinement_[a-z]+_[0-9]+$/);
  await owner.query('create database ' + name);
  report.databases.push(name);
  const url = new URL(connection);
  url.pathname = '/' + name;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await db.query(bootstrap);
  return { db, url: url.toString() };
}
const upgraded = await createDatabase('upgrade');
const db = upgraded.db;
const apply = async (target, files) => {
  for (const file of files)
    await target.query(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
};
async function snapshot() {
  const tables = (
    await db.query("select tablename from pg_tables where schemaname='public' order by tablename")
  ).rows;
  const result = {};
  for (const { tablename } of tables) {
    assert.match(tablename, /^[a-z_]+$/);
    result[tablename] = (
      await db.query(`select coalesce(jsonb_agg(data order by data::text),'[]'::jsonb) as rows
      from (select to_jsonb(t)-'retired_at' as data from public.${tablename} t) s`)
    ).rows[0].rows;
  }
  return result;
}
async function asAdmin(client, actor, sqlRole = 'authenticated') {
  await client.query('begin');
  await client.query("set local statement_timeout='8s'");
  await client.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: actor, role: 'authenticated', aal: 'aal2' }),
  ]);
  if (sqlRole === 'authenticated') await client.query('set local role authenticated');
}
async function waiting(client) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = (
      await db.query('select wait_event_type from pg_stat_activity where pid=$1', [
        client.processID,
      ])
    ).rows[0];
    if (state?.wait_event_type === 'Lock') return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}
let a, b;
try {
  await apply(
    db,
    migrations.filter((file) => file < '20261101'),
  );
  await db.query('begin');
  const fixture = await seedPublicCatalog(db, 12, 'UPGRADE');
  await db.query('commit');
  const before = await snapshot();
  await apply(
    db,
    migrations.filter((file) => file >= '20261101'),
  );
  assert.deepEqual(await snapshot(), before);
  record(
    'All original table values, identifiers, price/media/document rows and audit records survive the additive upgrade',
  );

  const item = (
    await db.query("select id,revision from public.products where product_code='UPGRADE-1'")
  ).rows[0];
  a = new pg.Client({ connectionString: upgraded.url });
  b = new pg.Client({ connectionString: upgraded.url });
  await a.connect();
  await b.connect();
  await asAdmin(a, fixture.actor);
  await asAdmin(b, fixture.actor);
  await a.query("select public.product_lifecycle($1,$2,'unpublish')", [item.id, item.revision]);
  const competingSave = b
    .query("select public.product_lifecycle($1,$2,'unpublish')", [item.id, item.revision])
    .then(
      () => 'unexpected-success',
      (error) => error.code,
    );
  assert.equal(await waiting(b), true);
  await a.query('commit');
  assert.equal(await competingSave, '40001');
  await b.query('rollback');
  record('Two real admin connections serialize on the aggregate; the stale writer receives 40001');

  const variant = (
    await db.query('select id from public.product_variants where product_id=$1 and is_default', [
      item.id,
    ])
  ).rows[0].id;
  await asAdmin(a, fixture.actor, 'owner');
  await asAdmin(b, fixture.actor, 'owner');
  const insertPrice =
    "insert into public.variant_prices(id,variant_id,currency_code,price_type,min_price,price_unit_id,trade_term,valid_from) values($1,$2,'BDT','fixed',200,$3,'FOB',now())";
  await a.query(insertPrice, [randomUUID(), variant, fixture.unit]);
  const competingPrice = b.query(insertPrice, [randomUUID(), variant, fixture.unit]).then(
    () => 'unexpected-success',
    (error) => error.code,
  );
  assert.equal(await waiting(b), true);
  await a.query('commit');
  assert.equal(await competingPrice, '23P01');
  await b.query('rollback');
  record(
    'Overlapping commercial prices cannot commit concurrently, including canonical trade-term checks',
  );

  const category = randomUUID(),
    attribute = randomUUID(),
    product = randomUUID(),
    sku = randomUUID();
  await db.query(
    "insert into public.categories(id,name,slug) values($1,'Race fixture','race-fixture')",
    [category],
  );
  await db.query(
    "insert into public.attribute_definitions(id,name,code,data_type) values($1,'Required race specification','RACE-SPEC','text')",
    [attribute],
  );
  await db.query(
    "insert into public.category_attributes(category_id,attribute_id,applies_to) values($1,$2,'variant')",
    [category, attribute],
  );
  await db.query(
    "insert into public.products(id,name,product_code,slug,product_type,status,primary_category_id,created_by,updated_by) values($1,'Race product','RACE-PRODUCT','race-product','physical','draft',$2,$3,$3)",
    [product, category, fixture.actor],
  );
  await db.query(
    "insert into public.product_variants(id,product_id,sku,variant_name,base_unit_id,minimum_order_unit_id,capacity_unit_id,availability_status,is_default) values($1,$2,'RACE-SKU','Default',$3,$3,$3,'on_request',true)",
    [sku, product, fixture.unit],
  );
  await db.query(
    "insert into public.variant_prices(variant_id,currency_code,price_type,price_unit_id,valid_from) values($1,'BDT','on_request',$2,now())",
    [sku, fixture.unit],
  );
  await db.query(
    "insert into public.product_media(product_id,media_type,provider_asset_id,delivery_url,upload_status,is_primary) values($1,'image','race-image','https://imagedelivery.net/race/image/detail','ready',true)",
    [product],
  );
  await asAdmin(a, fixture.actor);
  await asAdmin(b, fixture.actor);
  await a.query('update public.category_attributes set is_required=true where category_id=$1', [
    category,
  ]);
  const competingPublish = b
    .query("select public.product_lifecycle($1,1,'publish')", [product])
    .then(
      () => 'unexpected-success',
      (error) => error.code,
    );
  assert.equal(await waiting(b), true);
  await a.query('commit');
  assert.equal(await competingPublish, '23514');
  await b.query('rollback');
  assert.equal(
    (await db.query('select status from public.products where id=$1', [product])).rows[0].status,
    'draft',
  );
  record(
    'Publication waits for a concurrent category-rule change and validates the committed requirement',
  );

  await db.query(
    'insert into public.variant_attribute_values(variant_id,attribute_id,value_text) values($1,$2,$3)',
    [sku, attribute, 'Compliant'],
  );
  await asAdmin(a, fixture.actor, 'owner');
  await asAdmin(b, fixture.actor);
  await a.query('update public.attribute_definitions set is_active=false where id=$1', [attribute]);
  const blockedDefinitionPublish = b
    .query("select public.product_lifecycle($1,1,'publish')", [product])
    .then(
      () => 'unexpected-success',
      (error) => error.code,
    );
  assert.equal(await waiting(b), true);
  await a.query('commit');
  assert.equal(await blockedDefinitionPublish, '23514');
  await b.query('rollback');
  await db.query('update public.attribute_definitions set is_active=true where id=$1', [attribute]);
  record(
    'Publication waits for a concurrent definition deactivation and rejects the committed inactive specification',
  );

  await asAdmin(b, fixture.actor);
  await b.query("select public.product_lifecycle($1,1,'publish')", [product]);
  await asAdmin(a, fixture.actor, 'owner');
  const blockedDefinitionEdit = a
    .query('update public.attribute_definitions set is_active=false where id=$1', [attribute])
    .then(
      () => 'unexpected-success',
      (error) => error.code,
    );
  assert.equal(await waiting(a), true);
  await b.query('commit');
  assert.equal(await blockedDefinitionEdit, 'P0001');
  await a.query('rollback');
  record(
    'Definition deactivation waits for publication and cannot invalidate the newly published product',
  );

  await asAdmin(a, fixture.actor);
  await a.query("select public.product_lifecycle($1,2,'unpublish')", [product]);
  await a.query('commit');
  const optionAttribute = randomUUID(),
    option = randomUUID();
  await db.query(
    "insert into public.attribute_definitions(id,name,code,data_type) values($1,'Race option','RACE-OPTION','select')",
    [optionAttribute],
  );
  await db.query(
    "insert into public.category_attributes(category_id,attribute_id,applies_to) values($1,$2,'variant')",
    [category, optionAttribute],
  );
  await db.query(
    "insert into public.attribute_options(id,attribute_id,value,label) values($1,$2,'choice','Choice')",
    [option, optionAttribute],
  );
  await db.query(
    'insert into public.variant_attribute_values(variant_id,attribute_id,option_id) values($1,$2,$3)',
    [sku, optionAttribute, option],
  );
  await asAdmin(a, fixture.actor, 'owner');
  await asAdmin(b, fixture.actor);
  await a.query('update public.attribute_options set is_active=false where id=$1', [option]);
  const blockedOptionPublish = b
    .query("select public.product_lifecycle($1,3,'publish')", [product])
    .then(
      () => 'unexpected-success',
      (error) => error.code,
    );
  assert.equal(await waiting(b), true);
  await a.query('commit');
  assert.equal(await blockedOptionPublish, '23514');
  await b.query('rollback');
  await db.query('update public.attribute_options set is_active=true where id=$1', [option]);
  record(
    'Publication waits for a concurrent option deactivation and rejects the inactive choice without deadlock',
  );

  await asAdmin(b, fixture.actor);
  await b.query("select public.product_lifecycle($1,3,'publish')", [product]);
  await asAdmin(a, fixture.actor, 'owner');
  const blockedOptionEdit = a
    .query('update public.attribute_options set is_active=false where id=$1', [option])
    .then(
      () => 'unexpected-success',
      (error) => error.code,
    );
  assert.equal(await waiting(a), true);
  await b.query('commit');
  assert.equal(await blockedOptionEdit, 'P0001');
  await a.query('rollback');
  record(
    'Option deactivation waits for publication and cannot invalidate the newly published choice',
  );

  const clean = await createDatabase('clean');
  try {
    await apply(clean.db, migrations);
    fs.mkdirSync('.local-db-refinement', { recursive: true });
    fs.writeFileSync('.local-db-refinement/verified-connection.txt', clean.url + '\n');
    record(`Clean replay of all ${migrations.length} original and additive migrations succeeds`);
  } finally {
    await clean.db.end();
  }
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.failure = { code: error.code, message: error.message };
  throw error;
} finally {
  if (a) {
    await a.query('rollback');
    await a.end();
  }
  if (b) {
    await b.query('rollback');
    await b.end();
  }
  await db.end();
  await owner.end();
  fs.writeFileSync(
    'docs/production-refinement/upgrade-and-concurrency.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
