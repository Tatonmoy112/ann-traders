import { describe, it, expect } from 'vitest';
import { catalogQueryError } from '../apps/client/src/lib/catalog-errors';

describe('public catalog diagnostics', () => {
  it('identifies schema exposure failures in development', () => {
    expect(catalogQueryError({ code: 'PGRST106' }, true).message).toContain(
      'expose public_catalog',
    );
  });
  it.each(['PGRST202', 'PGRST205'])('identifies unavailable database objects for %s', (code) => {
    const message = catalogQueryError({ code }, true).message;
    expect(message).toContain(code);
    expect(message).toContain('20261031000100');
    expect(message).toContain('20261031000200');
  });
  it('keeps production errors generic and never echoes untrusted server messages', () => {
    const error = { code: 'PGRST205', message: 'private query and credentials' };
    expect(catalogQueryError(error, false).message).toBe('Catalog data is temporarily unavailable');
    expect(catalogQueryError(error, true).message).not.toContain(error.message);
    expect(catalogQueryError({ code: 'untrusted private input' }, true).message).toBe(
      'Catalog data is temporarily unavailable',
    );
  });
});
