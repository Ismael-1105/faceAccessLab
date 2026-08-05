import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateToken,
  verifyToken,
  getTokenFromRequest,
  expiresInToSeconds,
  hashPassword,
  comparePassword,
  serializeAccessCookie,
  serializeRefreshCookie,
  clearAuthCookies,
  readRefreshToken,
  jsonResponse,
  errorResponse,
} from '../../lib/auth.ts';

describe('auth: generateToken / verifyToken', () => {
  const payload = { userId: 'u1', email: 'a@b.c', role: 'admin' as const };

  it('genera y verifica un token preservando el payload', () => {
    const token = generateToken(payload);
    expect(token.split('.')).toHaveLength(3);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('u1');
    expect(decoded.role).toBe('admin');
    expect(decoded.email).toBe('a@b.c');
  });

  it('rechaza un token cuyo payload fue manipulado', () => {
    const token = generateToken(payload);
    const [h, p, s] = token.split('.');
    const original = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    const forged = Buffer.from(JSON.stringify({ ...original, role: 'docente' })).toString('base64url');
    expect(() => verifyToken(`${h}.${forged}.${s}`)).toThrow();
  });

  it('rechaza un token firmado con un secreto distinto', () => {
    const foreign = jwt.sign({ userId: 'u', email: 'e', role: 'docente' }, 'otro-secreto', { expiresIn: '15m' });
    expect(() => verifyToken(foreign)).toThrow();
  });

  it('rechaza un token expirado', () => {
    const expired = jwt.sign({ userId: 'u', email: 'e', role: 'docente' }, 'faceaccess-lab-dev-secret-change-in-production', { expiresIn: '-1m' });
    expect(() => verifyToken(expired)).toThrow();
  });
});

describe('auth: getTokenFromRequest', () => {
  it('solo acepta Authorization Bearer (nunca cookies)', () => {
    const req = new Request('http://localhost/x', { headers: { Authorization: 'Bearer abc.def.ghi' } });
    expect(getTokenFromRequest(req)).toBe('abc.def.ghi');

    const cookieReq = new Request('http://localhost/x', { headers: { Cookie: 'token=abc.def.ghi; other=1' } });
    expect(getTokenFromRequest(cookieReq)).toBeNull();

    const none = new Request('http://localhost/x');
    expect(getTokenFromRequest(none)).toBeNull();
  });
});

describe('auth: contraseñas', () => {
  it('hasea y verifica una contraseña', async () => {
    const hash = await hashPassword('supersecreto');
    expect(hash).not.toBe('supersecreto');
    expect(await comparePassword('supersecreto', hash)).toBe(true);
    expect(await comparePassword('otra', hash)).toBe(false);
  });
});

describe('auth: expiresInToSeconds', () => {
  it('convierte unidades de duración a segundos', () => {
    expect(expiresInToSeconds('15m')).toBe(900);
    expect(expiresInToSeconds('1h')).toBe(3600);
    expect(expiresInToSeconds('60s')).toBe(60);
    expect(expiresInToSeconds('7d')).toBe(604800);
  });

  it('usa 900s por defecto ante formato inválido', () => {
    expect(expiresInToSeconds('garbage')).toBe(900);
    expect(expiresInToSeconds('')).toBe(900);
  });
});

describe('auth: cookies de sesión', () => {
  it('serializa el access token con HttpOnly, SameSite=Strict y Path=/', () => {
    const cookie = serializeAccessCookie('abc');
    expect(cookie).toContain('token=abc');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
  });

  it('serializa el refresh token con su propio nombre', () => {
    expect(serializeRefreshCookie('rt')).toContain('refresh_token=rt');
    expect(serializeRefreshCookie('rt')).toContain('HttpOnly');
  });

  it('clearAuthCookies borra ambos tokens', () => {
    const cookies = clearAuthCookies();
    expect(cookies.join(' ')).toContain('token=');
    expect(cookies.join(' ')).toContain('refresh_token=');
    expect(cookies.join(' ')).toContain('Max-Age=0');
  });

  it('lee el refresh token de la cookie', () => {
    const req = new Request('http://localhost/x', { headers: { Cookie: 'refresh_token=valor-rt; other=1' } });
    expect(readRefreshToken(req)).toBe('valor-rt');
    expect(readRefreshToken(new Request('http://localhost/x'))).toBeNull();
  });
});

describe('auth: respuestas JSON', () => {
  it('jsonResponse y errorResponse incluyen cabeceras de seguridad', async () => {
    const res = jsonResponse({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('content-type')).toContain('application/json');

    const err = errorResponse('nope', 403);
    expect(err.status).toBe(403);
    expect((await err.json()).error).toBe('nope');
  });
});
