export type Role = 'super_admin' | 'admin' | 'editor';
export const canPublish = (role: Role) => role === 'super_admin' || role === 'admin';
export const canManageAdmins = (role: Role) => role === 'super_admin';
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export function formatPrice(
  type: string,
  min: string | null,
  max: string | null,
  currency: string,
  unit: string,
) {
  if (type === 'on_request') return 'Price on request';
  const f = (n: string) =>
    new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency,
      maximumFractionDigits: 4,
    }).format(Number(n));
  return `${f(min ?? '0')}${type === 'range' ? ` – ${f(max ?? '0')}` : ''}/${unit}`;
}
export const dhakaDate = (s: string) =>
  new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(s));
export function convertWithinFamily(
  value: string,
  from: { family: string; factor: string },
  to: { family: string; factor: string },
): string {
  if (from.family !== to.family || ['areal_density', 'temperature'].includes(from.family))
    throw new Error('Incompatible quantity units');
  // Integer fixed-point rational arithmetic; presentation rounds to 4 decimal places.
  const scale = 100000000n;
  const fixed = (n: string) => {
    if (!/^\d+(\.\d{1,8})?$/.test(n)) throw new Error('Invalid decimal');
    const [a, b = ''] = n.split('.');
    return BigInt(a) * scale + BigInt(b.padEnd(8, '0'));
  };
  const denominator = fixed(to.factor);
  if (denominator <= 0n) throw new Error('Invalid factor');
  const result = ((fixed(value) * fixed(from.factor) * 10000n) / denominator + scale / 2n) / scale;
  return `${result / 10000n}.${(result % 10000n).toString().padStart(4, '0')}`;
}
