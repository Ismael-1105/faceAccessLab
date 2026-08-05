import { describe, expect, it } from 'vitest';
import {
  generateCsrfToken,
  serializeCsrfCookie,
  isCsrfValid,
  assertCsrf,
  CSRF_COOKIE,
  CSRF_HEADER,
} from '../../lib/csrf.ts';

function withCsrf({ token, cookie }: { token?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (token) headers[CSRF_HEADER] = token;
  if (cookie) headers['Cookie'] = `${CSRF_COOKIE}=${cookie}`;
  return new Request('http://localhost/x', { method: 'POST', headers });
}

describe('csrf: doble envío', () => {
  it('genera tokens únicos', () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
    expect(generateCsrfToken()).toBeTruthy();
  });

  it('serializa la cookie con SameSite=Strict y Path=/', () => {
    const cookie = serializeCsrfCookie('abc');
    expect(cookie).toContain(`${CSRF_COOKIE}=abc`);
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
  });

  it('valida cuando el header coincide con la cookie', () => {
    const req = withCsrf({ token: 'tok-1', cookie: 'tok-1' });
    expect(isCsrfValid(req)).toBe(true);
  });

  it('rechaza cuando el header no coincide', () => {
    expect(isCsrfValid(withCsrf({ token: 'tok-1', cookie: 'tok-2' }))).toBe(false);
    expect(isCsrfValid(withCsrf({ token: 'tok-1' }))).toBe(false);
    expect(isCsrfValid(withCsrf({ cookie: 'tok-1' }))).toBe(false);
    expect(isCsrfValid(new Request('http://localhost/x', { method: 'POST' }))).toBe(false);
  });

  it('assertCsrf no exige token en métodos de solo lectura', () => {
    const get = new Request('http://localhost/x', { method: 'GET' });
    const options = new Request('http://localhost/x', { method: 'OPTIONS' });
    expect(assertCsrf(get)).toBe(true);
    expect(assertCsrf(options)).toBe(true);
    expect(assertCsrf(withCsrf())).toBe(false); // POST sin token
  });
});
