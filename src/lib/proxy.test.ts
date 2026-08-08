import { describe, expect, it, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, config, safeNext } from '../../proxy.ts';
import { generateToken } from '../../lib/auth.ts';

const RENEW = '/renovando';

beforeAll(() => {
  // proxy.ts firma con JWT_SECRET; generateToken usa el mismo valor.
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'faceaccess-lab-dev-secret-change-in-production';
});

function request(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(path, 'http://localhost'));
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

function staffToken(role: 'admin' | 'docente' | 'estudiante' = 'docente') {
  return generateToken({ userId: 'u1', email: 'a@x.com', role });
}

/** Destino al que redirige la respuesta, o null si deja pasar. */
function target(res: Response): string | null {
  const location = res.headers.get('location');
  return location ? new URL(location).pathname + new URL(location).search : null;
}

describe('proxy: renovacion de sesion (ISS-22)', () => {
  it('manda a renovar cuando el access token falta pero queda cookie de refresco', async () => {
    const res = await proxy(request('/docente', { refresh_token: 'r1' }));

    expect(target(res)).toBe(`${RENEW}?next=%2Fdocente`);
  });

  it('conserva la ruta profunda y su query como destino', async () => {
    const res = await proxy(request('/docente/demo?tab=kiosco', { refresh_token: 'r1' }));

    expect(target(res)).toBe(`${RENEW}?next=%2Fdocente%2Fdemo%3Ftab%3Dkiosco`);
  });

  it('manda al login si NO hay cookie de refresco', async () => {
    const res = await proxy(request('/docente'));

    expect(target(res)).toBe('/login');
  });

  it('deja pasar con sesion valida, sin tocar la renovacion', async () => {
    const res = await proxy(request('/docente', { token: staffToken('admin') }));

    expect(target(res)).toBeNull();
  });

  it('un estudiante con sesion valida sigue yendo al login, no a renovar', async () => {
    // La renovación no debe convertirse en una vía para saltarse el rol.
    const res = await proxy(request('/docente', {
      token: staffToken('estudiante'),
      refresh_token: 'r1',
    }));

    expect(target(res)).toBe('/login');
  });
});

describe('proxy: sin bucle de redirecciones (ISS-22)', () => {
  it('la pagina de renovacion no esta protegida por el middleware', async () => {
    // Si lo estuviera, se redirigiría a sí misma y la pestaña parpadearía hasta
    // que el navegador cortara.
    const res = await proxy(request(`${RENEW}?next=/docente`, { refresh_token: 'r1' }));

    expect(target(res)).toBeNull();
  });

  it('la pagina de renovacion tampoco entra en el matcher', () => {
    for (const pattern of config.matcher) {
      expect(pattern).not.toContain('renovando');
    }
  });
});

/**
 * safeNext se prueba de forma directa y no a través de proxy().
 *
 * Una petición a `//evil.com` la resuelve `new URL` como host evil.com con
 * pathname '/', así que nunca entra en la rama de staff y jamás llega a
 * construir un next: una prueba por esa vía pasaría sin comprobar nada.
 */
describe('proxy: el destino no puede salir del dominio (ISS-22)', () => {
  it('acepta rutas internas y conserva la query', () => {
    expect(safeNext('/docente', '')).toBe('/docente');
    expect(safeNext('/docente/demo', '?tab=kiosco')).toBe('/docente/demo?tab=kiosco');
    expect(safeNext('/diagnostico', '')).toBe('/diagnostico');
  });

  it.each([
    ['//evil.com', ''],
    ['//evil.com/robar', ''],
    ['//evil.com', '?next=/docente'],
  ])('rechaza el protocolo relativo %s%s', (pathname, search) => {
    const result = safeNext(pathname, search);

    expect(result).toBe('/docente');
    expect(result.startsWith('//')).toBe(false);
  });

  it.each([
    'https://evil.com',
    'http://evil.com/robar',
    'javascript:alert(1)',
    'evil.com',
  ])('rechaza %s por no ser una ruta interna', (pathname) => {
    expect(safeNext(pathname, '')).toBe('/docente');
  });
});
