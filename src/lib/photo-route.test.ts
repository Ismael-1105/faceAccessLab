import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  canReadPhoto: vi.fn(),
  getPresignedUrl: vi.fn(),
}));

vi.mock('../../lib/db.ts', () => ({ connectDB: vi.fn().mockResolvedValue({}) }));
vi.mock('../../lib/s3.ts', () => ({ getPresignedUrl: mocks.getPresignedUrl }));
vi.mock('../../lib/photo-access.ts', () => ({
  canReadPhoto: mocks.canReadPhoto,
  isManagedPhotoKey: vi.fn().mockReturnValue(true),
}));

import { GET } from '../../app/api/photos/[key]/route.ts';
import { generateToken, ACCESS_COOKIE } from '../../lib/auth.ts';

const KEY = 'students/alumno-1.jpg';
const params = Promise.resolve({ key: KEY });

function token(role: 'admin' | 'docente' | 'estudiante', userId = 't1') {
  return generateToken({ userId, email: 'e@x.com', role });
}

/** Petición como la que hace un <img>: sin Authorization, solo cookies. */
function withCookie(value: string) {
  return new Request(`http://localhost/api/photos/${KEY}`, {
    headers: { Cookie: `${ACCESS_COOKIE}=${encodeURIComponent(value)}` },
  });
}

function withHeader(value: string) {
  return new Request(`http://localhost/api/photos/${KEY}`, {
    headers: { Authorization: `Bearer ${value}` },
  });
}

describe('GET /api/photos/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPresignedUrl.mockResolvedValue('https://s3.example/firmada');
  });

  it('sirve la foto cuando el docente presenta la cookie de acceso', async () => {
    mocks.canReadPhoto.mockResolvedValue(true);

    const res = await GET(withCookie(token('docente')), { params });

    // Redirección a la URL firmada: ni 401 ni 403.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(mocks.getPresignedUrl).toHaveBeenCalledWith(KEY, 3600);
  });

  it('sigue aceptando la cabecera Authorization', async () => {
    mocks.canReadPhoto.mockResolvedValue(true);

    const res = await GET(withHeader(token('admin')), { params });

    expect(res.status).not.toBe(401);
    expect(mocks.getPresignedUrl).toHaveBeenCalled();
  });

  it('devuelve 401 sin cookie ni cabecera', async () => {
    const res = await GET(new Request(`http://localhost/api/photos/${KEY}`), { params });

    expect(res.status).toBe(401);
    // No debe llegar a firmar nada.
    expect(mocks.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('devuelve 401 con una cookie de acceso inválida', async () => {
    const res = await GET(withCookie('no-es-un-jwt'), { params });

    expect(res.status).toBe(401);
    expect(mocks.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('devuelve 401 al rol estudiante aunque su token sea válido', async () => {
    const res = await GET(withCookie(token('estudiante')), { params });

    expect(res.status).toBe(401);
    expect(mocks.canReadPhoto).not.toHaveBeenCalled();
  });

  // La barrera que ISS-15 no puede debilitar: la cookie resuelve QUIÉN eres,
  // canReadPhoto sigue decidiendo QUÉ puedes ver.
  it('devuelve 403 al docente que pide la clave de un alumno ajeno', async () => {
    mocks.canReadPhoto.mockResolvedValue(false);

    const res = await GET(withCookie(token('docente')), { params });

    expect(res.status).toBe(403);
    expect(mocks.canReadPhoto).toHaveBeenCalled();
    expect(mocks.getPresignedUrl).not.toHaveBeenCalled();
  });
});
