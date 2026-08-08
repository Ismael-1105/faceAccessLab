import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  login: vi.fn(),
}));

vi.mock('../../lib/distributed-rate-limit.ts', () => ({
  checkDistributedRateLimit: mocks.checkDistributedRateLimit,
  // Reproduce el escenario del issue: sin proxy inverso no hay cabeceras y
  // todos los clientes resuelven a la misma dirección.
  getClientAddress: () => 'unknown',
}));
vi.mock('../../src/modules/auth/auth.service.ts', () => ({
  authService: { login: mocks.login },
}));
vi.mock('../../lib/cors.ts', () => ({ corsOptions: vi.fn() }));
vi.mock('../../lib/observability.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST as login } from '../../app/api/auth/login/route.ts';

function req(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Claves con las que se llamó al limitador, en orden. */
function keys() {
  return mocks.checkDistributedRateLimit.mock.calls.map(c => c[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkDistributedRateLimit.mockResolvedValue(true);
  mocks.login.mockResolvedValue({ status: 200, body: { token: 't' } });
});

describe('login: cupo por cuenta y no por sala (ISS-20)', () => {
  it('dos correos distintos desde la misma direccion no comparten cubo', async () => {
    await login(req({ email: 'ana@x.com', password: 'secreta' }));
    await login(req({ email: 'luis@x.com', password: 'secreta' }));

    const [primera, segunda] = keys();
    expect(primera).not.toBe(segunda);
    expect(primera).toContain('ana@x.com');
    expect(segunda).toContain('luis@x.com');
  });

  it('normaliza el correo para que no se eluda cambiando mayusculas', async () => {
    await login(req({ email: 'Ana@X.com', password: 'secreta' }));

    expect(keys()[0]).toBe('login:unknown:ana@x.com');
  });

  it('un cuerpo invalido no consume cupo', async () => {
    // El limitador iba antes del parseo: cualquier basura gastaba presupuesto
    // del cubo compartido.
    const res = await login(req({ email: 'no-es-un-correo' }));

    expect(res.status).toBe(400);
    expect(mocks.checkDistributedRateLimit).not.toHaveBeenCalled();
  });

  it('sigue devolviendo 429 cuando la cuenta agota su cupo', async () => {
    mocks.checkDistributedRateLimit.mockResolvedValue(false);

    const res = await login(req({ email: 'ana@x.com', password: 'secreta' }));

    expect(res.status).toBe(429);
    // No debe llegar al servicio: el corte ocurre antes.
    expect(mocks.login).not.toHaveBeenCalled();
  });
});
