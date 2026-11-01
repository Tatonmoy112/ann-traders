// Minimal PostgREST transport double backed by real anonymous PostgreSQL reads.
// For repository tests only; never deploy this server.
import http from 'node:http';
import pg from 'pg';
import { seedPublicCatalog } from './public-catalog-data.mjs';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['127.0.0.1', 'localhost'].includes(new URL(connection).hostname))
  throw new Error('An isolated local TEST_DATABASE_URL is required');
const db = new pg.Client({ connectionString: connection });
await db.connect();
await db.query('begin');
await seedPublicCatalog(db, 18, 'WEB-TEST');
await db.query('set local role anon');
let unavailable = false;
const allowed = new Set([
  'categories',
  'brands',
  'product_cards',
  'product_details',
  'visibility',
  'documents',
]);
async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:55440');
    if (url.pathname === '/_test/unavailable') {
      unavailable = url.searchParams.get('value') === 'true';
      return res.end('ok');
    }
    if (url.pathname === '/_test/withdraw') {
      await db.query('reset role');
      await db.query(
        "update public.products set status='archived',revision=revision+1 where slug='synthetic-paper-1'",
      );
      await db.query('set local role anon');
      return res.end('ok');
    }
    if (url.pathname === '/_test/restore') {
      await db.query('reset role');
      await db.query(
        "update public.products set status='published',revision=revision+1 where slug='synthetic-paper-1'",
      );
      await db.query('set local role anon');
      return res.end('ok');
    }
    if (unavailable) {
      res.writeHead(503);
      return res.end('unavailable');
    }
    const view = url.pathname.split('/').at(-1);
    if (
      ['browse_product_cards', 'category_filters'].includes(view) &&
      req.method === 'GET' &&
      req.headers['accept-profile'] === 'public_catalog' &&
      req.headers.apikey === 'test-public-key'
    ) {
      const text = (key) => url.searchParams.get(key) || '';
      const values =
        view === 'category_filters'
          ? [text('category_filter')]
          : [
              text('category_filter'),
              text('brand_filter'),
              text('search_query'),
              text('featured_only') === 'true',
              text('new_only') === 'true',
              Number(text('page_number') || 1),
              Number(text('page_size') || 12),
              text('sort_field') || 'updated_at',
              text('sort_ascending') === 'true',
              text('attribute_filters') || '[]',
              text('after_cursor') || null,
            ];
      const sql =
        view === 'category_filters'
          ? 'select public_catalog.category_filters($1) as result'
          : 'select public_catalog.browse_product_cards($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result';
      const { rows } = await db.query(sql, values);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(rows[0].result));
    }
    if (
      view === 'list_product_cards' &&
      req.method === 'GET' &&
      req.headers['accept-profile'] === 'public_catalog'
    ) {
      const fields = url.searchParams.get('select');
      if (!fields || !/^[a-z_,]+$/.test(fields)) throw new Error('Invalid RPC selection');
      const text = (key) => url.searchParams.get(key) || '';
      const values = [
        text('category_filter'),
        text('brand_filter'),
        text('search_query'),
        text('featured_only') === 'true',
        text('new_only') === 'true',
        Number(text('page_number') || 1),
        Number(text('page_size') || 12),
        text('sort_field') || 'updated_at',
        text('sort_ascending') === 'true',
      ];
      const { rows } = await db.query(
        'select ' + fields + ' from public_catalog.list_product_cards($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        values,
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(rows));
    }
    if (
      req.method !== 'GET' ||
      !allowed.has(view) ||
      req.headers['accept-profile'] !== 'public_catalog' ||
      req.headers.apikey !== 'test-public-key'
    )
      throw new Error('Unexpected public boundary request');
    const columns = url.searchParams.get('select') || '*';
    if (!/^[a-z_,]+$/.test(columns)) throw new Error('Invalid selection');
    const values = [],
      where = [];
    const param = (value) => {
      values.push(value);
      return '$' + values.length;
    };
    for (const [key, value] of url.searchParams) {
      if (!/^[a-z_]+$/.test(key)) throw new Error('Invalid field');
      if (value.startsWith('eq.')) where.push(key + '=' + param(value.slice(3)));
      else if (value.startsWith('ilike.')) where.push(key + ' ilike ' + param(value.slice(6)));
      else if (value.startsWith('in.(')) {
        const list = value.slice(4, -1).split(',');
        where.push(key + ' in (' + list.map(param).join(',') + ')');
      } else if (key === 'or') {
        const terms = value
          .slice(1, -1)
          .split(',')
          .map((term) => {
            const parts = term.split('.ilike.');
            if (!/^[a-z_]+$/.test(parts[0])) throw new Error('Invalid search');
            return parts[0] + ' ilike ' + param(parts[1]);
          });
        where.push('(' + terms.join(' or ') + ')');
      }
    }
    let sql =
      'select ' +
      columns +
      ' from public_catalog.' +
      view +
      (where.length ? ' where ' + where.join(' and ') : '');
    const order = url.searchParams.get('order');
    if (order) {
      const items = order.split(',').map((item) => {
        const [field, direction] = item.split('.');
        if (!/^[a-z_]+$/.test(field) || !['asc', 'desc'].includes(direction))
          throw new Error('Invalid order');
        return field + ' ' + direction;
      });
      sql += ' order by ' + items.join(',');
    }
    if (url.searchParams.has('limit'))
      sql += ' limit ' + param(Number(url.searchParams.get('limit')));
    if (url.searchParams.has('offset'))
      sql += ' offset ' + param(Number(url.searchParams.get('offset')));
    const { rows } = await db.query(sql, values);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Range': '0-' + Math.max(0, rows.length - 1) + '/' + rows.length,
    });
    res.end(JSON.stringify(rows));
  } catch (error) {
    console.error(error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Test transport failed' }));
  }
}
// This fixture owns one transaction/session, so requests must use it serially.
let queue = Promise.resolve();
const server = http.createServer((req, res) => {
  queue = queue
    .then(() => handleRequest(req, res))
    .catch(() => {
      res.writeHead(500);
      res.end('Test transport failed');
    });
});
server.listen(55440, '127.0.0.1', () => console.log('Public catalog fixture ready on 55440'));
async function stop() {
  server.close();
  await db.query('rollback');
  await db.end();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
