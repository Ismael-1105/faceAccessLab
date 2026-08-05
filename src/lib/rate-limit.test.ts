import { describe, expect, it, vi, afterAll } from 'vitest';
import { checkRateLimit } from '../../lib/rate-limit.ts';

describe('rate limiting en memoria', () => {
  afterAll(() => vi.restoreAllMocks());

  it('permite hasta maxRequests en la ventana y bloquea el siguiente', () => {
    const key = `t1-${Math.random()}`;
    expect(checkRateLimit(key, 2)).toBe(true);
    expect(checkRateLimit(key, 2)).toBe(true);
    expect(checkRateLimit(key, 2)).toBe(false);
  });

  it('reinicia la ventana después del intervalo', () => {
    const key = `t2-${Math.random()}`;
    expect(checkRateLimit(key, 2)).toBe(true);
    expect(checkRateLimit(key, 2)).toBe(true);
    expect(checkRateLimit(key, 2)).toBe(false);

    // Avanzar el reloj 61 s: la entrada expira y vuelve a permitir.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    expect(checkRateLimit(key, 2)).toBe(true);
    vi.restoreAllMocks();
  });

  it('claves distintas tienen ventanas independientes', () => {
    const a = `ta-${Math.random()}`;
    const b = `tb-${Math.random()}`;
    checkRateLimit(a, 1);
    expect(checkRateLimit(a, 1)).toBe(false);
    expect(checkRateLimit(b, 1)).toBe(true);
  });
});
