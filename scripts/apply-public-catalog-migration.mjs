import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const { Client } = pg;
const connectionString = 'postgresql://postgres:EWJtCde2VAuizRfq@db.eoyrjacticdvkzzvibay.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to hosted Supabase PostgreSQL.');

  const sqlPath = path.resolve('supabase/migrations/20261025000100_public_catalog_exposure.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying 20261025000100_public_catalog_exposure.sql...');
  await client.query(sql);
  console.log('Migration applied successfully!');

  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

