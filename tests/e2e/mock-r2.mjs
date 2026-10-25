// Local S3/R2 protocol double. Never imported by runtime application code.
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
export const testCredentials = { accessKeyId: 'test-r2-key', secretAccessKey: 'test-r2-secret' };
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (key, s) => crypto.createHmac('sha256', key).update(s).digest();
const encode = (s) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
export function verifyPresigned(url, headers, method = 'PUT', now = Date.now()) {
  const q = url.searchParams,
    date = q.get('X-Amz-Date'),
    credential = q.get('X-Amz-Credential');
  if (!date || !credential) throw Error('Missing signature');
  const timestamp = Date.parse(
    date.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'),
  );
  if (
    !Number.isFinite(timestamp) ||
    now > timestamp + Number(q.get('X-Amz-Expires')) * 1000 ||
    now < timestamp - 60000
  )
    throw Error('Expired signature');
  const [keyId, ...scopeParts] = credential.split('/');
  if (keyId !== testCredentials.accessKeyId) throw Error('Wrong key');
  const signed = q.get('X-Amz-SignedHeaders'),
    names = signed.split(';');
  const canonicalHeaders = names
    .map(
      (name) =>
        name +
        ':' +
        (headers[name] ?? (name === 'host' ? url.host : ''))
          .toString()
          .trim()
          .replace(/\s+/g, ' ') +
        '\n',
    )
    .join('');
  const query = [...q]
    .filter(([k]) => k !== 'X-Amz-Signature')
    .map(([k, v]) => [encode(k), encode(v)])
    .sort(([ak, av], [bk, bv]) => (ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => k + '=' + v)
    .join('&');
  const canonical = [
    method,
    url.pathname,
    query,
    canonicalHeaders,
    signed,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const scope = scopeParts.join('/'),
    text = ['AWS4-HMAC-SHA256', date, scope, hash(canonical)].join('\n');
  let signing = Buffer.from('AWS4' + testCredentials.secretAccessKey);
  for (const piece of scopeParts) signing = hmac(signing, piece);
  const expected = crypto.createHmac('sha256', signing).update(text).digest('hex');
  if (expected !== q.get('X-Amz-Signature')) throw Error('Invalid signature');
  if (
    !names.includes('if-none-match') ||
    !names.includes('content-type') ||
    !names.includes('content-length')
  )
    throw Error('Required upload headers were not signed');
}
export function createMockR2Server() {
  const objects = new Map();
  let fault = false,
    clockOffset = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1'),
      origin = req.headers.origin;
    const send = (status, body = '', headers = {}) => {
      res.writeHead(status, { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3100', ...headers });
      res.end(body);
    };
    if (url.pathname === '/health') return send(200, 'ok');
    if (url.pathname === '/__test/expire-uploads') {
      clockOffset = url.searchParams.get('enabled') === 'true' ? 301000 : 0;
      return send(200, 'ok');
    }
    if (url.pathname === '/__test/fault') {
      fault = url.searchParams.get('enabled') === 'true';
      return send(200, 'ok');
    }
    if (req.method === 'OPTIONS')
      return send(origin === 'http://127.0.0.1:3100' ? 204 : 403, '', {
        'Access-Control-Allow-Methods': 'PUT',
        'Access-Control-Allow-Headers': 'content-type,if-none-match',
        'Access-Control-Expose-Headers': 'etag',
      });
    if (fault)
      return send(503, '<Error><Code>ServiceUnavailable</Code></Error>', {
        'Content-Type': 'application/xml',
      });
    let key = decodeURIComponent(url.pathname.slice(1));
    const publicRead = key.startsWith('catalog/') && req.method === 'GET';
    if (publicRead) key = 'public-images/' + key;
    const signed = url.searchParams.has('X-Amz-Signature');
    if (signed) {
      try {
        verifyPresigned(
          new URL(req.url, `http://${req.headers.host}`),
          req.headers,
          req.method,
          Date.now() + clockOffset,
        );
      } catch (e) {
        return send(
          403,
          `<Error><Code>AccessDenied</Code><Message>${e.message}</Message></Error>`,
          { 'Content-Type': 'application/xml' },
        );
      }
    } else if (
      !publicRead &&
      !req.headers.authorization?.startsWith('AWS4-HMAC-SHA256 Credential=test-r2-key/')
    )
      return send(403, '<Error><Code>AccessDenied</Code></Error>', {
        'Content-Type': 'application/xml',
      });
    const parts = [];
    for await (const part of req) parts.push(part);
    const bytes = Buffer.concat(parts);
    if (req.method === 'PUT') {
      if (req.headers['if-none-match'] === '*' && objects.has(key))
        return send(412, '<Error><Code>PreconditionFailed</Code></Error>', {
          'Content-Type': 'application/xml',
        });
      objects.set(key, {
        bytes,
        type: req.headers['content-type'] ?? 'application/octet-stream',
        cache: req.headers['cache-control'],
        etag: '"' + hash(bytes) + '"',
      });
      return send(200, '', { ETag: objects.get(key).etag });
    }
    if (req.method === 'DELETE') {
      objects.delete(key);
      return send(204);
    }
    const object = objects.get(key);
    if (!object)
      return send(404, '<Error><Code>NoSuchKey</Code></Error>', {
        'Content-Type': 'application/xml',
      });
    return send(200, req.method === 'HEAD' ? '' : object.bytes, {
      'Content-Type': object.type,
      'Content-Length': object.bytes.length,
      ETag: object.etag,
      ...(object.cache ? { 'Cache-Control': object.cache } : {}),
    });
  });
  return { server, objects };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  createMockR2Server().server.listen(54330, '127.0.0.1', () =>
    console.log('Local R2 double on 54330'),
  );
}
