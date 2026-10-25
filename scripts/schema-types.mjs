import fs from 'node:fs';
if (fs.existsSync('packages/database/src/database.types.ts')) {
  throw new Error(
    'Bootstrap types already exist. Use schema introspection or Supabase CLI generation.',
  );
}
const sql = fs.readFileSync('supabase/migrations/20261024000100_core.sql', 'utf8');
let result =
  '// Bootstrap types derived from the committed SQL. Replace with CLI introspection after local DB startup.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport interface Database { public: { Tables: {\n';
for (const [, name, body] of sql.matchAll(/create table public\.(\w+) \(([\s\S]*?)\n\);/g)) {
  const cols = [];
  for (const line of body.split('\n')) {
    const m = line.match(
      /^  (\w+) (uuid|varchar\(\d+\)|text|CHAR\(\d+\)|integer|bigint|NUMERIC\([\d,]+\)|boolean|timestamptz|date|jsonb|tsvector)(.*)/,
    );
    if (!m) continue;
    const [, field, type, rest] = m;
    const t =
      type === 'jsonb'
        ? 'Json'
        : /integer|bigint|NUMERIC/.test(type)
          ? 'number'
          : type === 'boolean'
            ? 'boolean'
            : 'string';
    cols.push({
      field,
      type: t + (rest.includes('not null') ? '' : ' | null'),
      optional:
        !rest.includes('not null') || rest.includes('default') || rest.includes('generated'),
    });
  }
  result += `${name}: { Row: {${cols.map((c) => `${c.field}: ${c.type}`).join(';')}}; Insert: {${cols.map((c) => `${c.field}${c.optional ? '?' : ''}: ${c.type}`).join(';')}}; Update: {${cols.map((c) => `${c.field}?: ${c.type}`).join(';')}}; Relationships: [] };\n`;
}
result +=
  '}; Views: { [_ in never]: never }; Functions: { create_product_draft: { Args: {p_name:string;p_code:string;p_slug:string};Returns:string }; save_product_draft: {Args:{payload:Json};Returns:number}; product_publish_errors:{Args:{product:string};Returns:Json}; product_lifecycle:{Args:{product:string;expected_revision:number;operation:string};Returns:number} }; Enums: {[_ in never]:never}; CompositeTypes: {[_ in never]:never} } }\n';
result = result.replace(
  'Functions: {',
  'Functions: { product_media_action:{Args:{product:string;expected_revision:number;media:string;operation:string;alt?:string};Returns:number}; list_admin_products: {Args:{search?:string;state?:string;category?:string;brand?:string;page?:number;page_size?:number;sort?:string;ascending?:boolean};Returns:Json}; save_product_relation:{Args:{product:string;expected_revision:number;relation:string;rows:Json};Returns:number};',
);
fs.mkdirSync('packages/database/src', { recursive: true });
fs.writeFileSync('packages/database/src/database.types.ts', result);
