// Converts the supplied entity inventory into a reviewed initial migration.
// Run only during schema authoring; committed SQL is the deployment artifact.
import fs from 'node:fs';
if (fs.existsSync('supabase/migrations/20261024000100_core.sql')) {
  throw new Error('Refusing to overwrite migration history. Add a new reviewed migration instead.');
}
const source = fs.readFileSync('database-design.md', 'utf8');
const sections = [...source.matchAll(/#### \d+\. `([^`]+)`([\s\S]*?)(?=#### |### |## |$)/g)];
const order = [
  'admin_profiles',
  ...sections.map((s) => s[1]).filter((s) => s !== 'admin_profiles' && s !== 'audit_logs'),
  'audit_logs',
];
const definitions = new Map();
for (const [, name, body] of sections) {
  const cols = [];
  const pks = [];
  for (const line of body.split('\n')) {
    if (!line.startsWith('|')) continue;
    const [field, type, rule] = line
      .split('|')
      .slice(1, 4)
      .map((s) => s.trim());
    if (!field || field === 'Attribute' || field.startsWith('-')) continue;
    let t = type
      .replace(/VARCHAR\((\d+)\)/, 'varchar($1)')
      .replace('INTEGER', 'integer')
      .replace('BOOLEAN', 'boolean')
      .replace('TEXT', 'text')
      .replace('TIMESTAMPTZ', 'timestamptz')
      .replace('UUID', 'uuid')
      .replace('JSONB', 'jsonb')
      .replace('DATE', 'date');
    let extra = '';
    if (rule.includes('PK')) {
      pks.push(field);
      if (field === 'id' && name !== 'admin_profiles') extra += ' default gen_random_uuid()';
    }
    const nullable =
      rule.toLowerCase().includes('nullable') ||
      ['published_at', 'deleted_at'].includes(field) ||
      (name === 'products' && field === 'primary_category_id');
    if (!nullable) extra += ' not null';
    const def = rule.match(/Default (true|false|0|now\(\))/i);
    if (def) extra += ' default ' + def[1].toLowerCase();
    if (rule.includes('UQ')) extra += ' unique';
    const fk = rule.match(/FK\s*→\s*([a-z_.]+)/);
    if (fk) {
      const [table, col] = fk[1].includes('auth.') ? ['auth.users', 'id'] : fk[1].split('.');
      extra += ` references ${table.includes('.') ? table : 'public.' + table}(${col}) on delete ${['product_id', 'variant_id'].includes(field) && !['variant_prices'].includes(name) ? 'cascade' : 'restrict'}`;
    }
    cols.push(`  ${field} ${t}${extra}`);
  }
  if (name === 'products')
    cols.push(
      '  revision bigint not null default 1',
      "  search_vector tsvector generated always as (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(product_code,'') || ' ' || coalesce(short_description,''))) stored",
    );
  if (name === 'categories') cols.push('  requires_composition boolean not null default false');
  if (name === 'product_variants') cols.push('  unique(id, product_id)');
  if (name === 'attribute_options')
    cols.push('  unique(id, attribute_id)', '  unique(attribute_id, value)');
  if (name === 'product_documents') {
    const idx = cols.findIndex((s) => s.startsWith('  is_public '));
    cols[idx] = '  is_public boolean not null default false';
    cols.push(
      "  bucket_id text not null default 'catalog-documents'",
      "  content_type text not null default 'application/pdf'",
      '  bytes bigint check(bytes > 0 and bytes <= 10485760)',
      '  uploaded_by uuid references public.admin_profiles(id)',
      '  unique(id, product_id)',
    );
  }
  if (name === 'product_media')
    cols.push(
      "  provider text not null default 'cloudflare_images' check(provider='cloudflare_images')",
      '  provider_asset_id text unique',
      '  delivery_url text',
      "  upload_status text not null default 'pending' check(upload_status in ('pending','ready','failed'))",
      '  uploaded_by uuid references public.admin_profiles(id)',
      '  content_type text',
      '  bytes bigint check(bytes > 0 and bytes <= 10485760)',
      '  width integer check(width > 0)',
      '  height integer check(height > 0)',
    );
  if (name === 'variant_prices') {
    const idx = cols.findIndex((s) => s.startsWith('  trade_term '));
    cols[idx] = "  trade_term varchar(40) not null default ''";
  }
  if (!cols.some((s) => s.startsWith('  created_at ')))
    cols.push('  created_at timestamptz not null default now()');
  if (!cols.some((s) => s.startsWith('  updated_at ')))
    cols.push('  updated_at timestamptz not null default now()');
  cols.push(`  primary key (${pks.join(', ')})`);
  definitions.set(name, `create table public.${name} (\n${cols.join(',\n')}\n);\n`);
}
if (definitions.size !== 28) throw Error(`Expected 28 entities, got ${definitions.size}`);
fs.mkdirSync('supabase/migrations', { recursive: true });
fs.writeFileSync(
  'supabase/migrations/20261024000100_core.sql',
  `-- Fresh local/development schema. No remote application authorized.\nbegin;\ncreate schema if not exists private;\ncreate schema if not exists public_catalog;\ncreate extension if not exists pg_trgm with schema extensions;\ncreate extension if not exists btree_gist with schema extensions;\nset search_path=public,extensions;\n${order.map((s) => definitions.get(s)).join('\n')}\ncommit;\n`,
);
