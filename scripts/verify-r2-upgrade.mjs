import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['localhost', '127.0.0.1'].includes(new URL(connection).hostname))
  throw new Error('Use the isolated local PostgreSQL cluster only');
const owner = new pg.Client({ connectionString: connection });
await owner.connect();
const database = 'ann_r2_upgrade_' + Date.now();
await owner.query(`create database ${database}`);
await owner.end();
const url = new URL(connection);
url.pathname = '/' + database;
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
try {
  await db.query(fs.readFileSync('scripts/local-postgres-bootstrap.sql', 'utf8'));
  const files = fs
    .readdirSync('supabase/migrations')
    .filter((n) => n.endsWith('.sql'))
    .sort();
  for (const file of files.filter((n) => n < '20261024001200_r2_media.sql'))
    await db.query(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
  const actor = crypto.randomUUID(),
    product = crypto.randomUUID(),
    media = crypto.randomUUID();
  await db.query('insert into auth.users(id) values($1)', [actor]);
  await db.query(
    "insert into public.admin_profiles(id,full_name,role) values($1,'Legacy fixture operator','editor')",
    [actor],
  );
  await db.query(
    "insert into public.products(id,name,product_code,slug,product_type,status,created_by,updated_by) values($1,'Legacy fixture','LEGACY-FIXTURE','legacy-fixture','physical','draft',$2,$2)",
    [product, actor],
  );
  await db.query(
    "insert into public.product_media(id,product_id,media_type,provider_asset_id,delivery_url,upload_status,is_primary,sort_order,alt_text) values($1,$2,'image','legacy-preserved','https://imagedelivery.net/hash/legacy-preserved/detail','ready',true,7,'Legacy alt')",
    [media, product],
  );
  await db.query(
    "insert into public.product_documents(product_id,title,document_type,storage_path,is_public) values($1,'Private fixture PDF','TDS','fixture/private.pdf',false)",
    [product],
  );
  await db.query(
    "insert into public.audit_logs(admin_id,entity_name,entity_id,action,new_data) values($1,'products',$2,'insert','{}')",
    [actor, product],
  );
  const snapshot = async () => {
    const result = {};
    for (const table of ['products', 'product_media', 'product_documents', 'audit_logs'])
      result[table] = (await db.query(`select * from public.${table} order by id`)).rows;
    return result;
  };
  const before = await snapshot();
  for (const file of files.filter((n) => n >= '20261024001200_r2_media.sql'))
    await db.query(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
  const after = await snapshot();
  const oldKeys = Object.keys(before.product_media[0]);
  after.product_media = after.product_media.map((row) =>
    Object.fromEntries(oldKeys.map((key) => [key, row[key]])),
  );
  assert.deepEqual(after, before);
  console.log(
    'PASS: all migrations apply; legacy product/image/primary/order/alt, private PDF and audit data are unchanged. Database: ' +
      database,
  );
} finally {
  await db.end();
}
