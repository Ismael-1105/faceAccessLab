/**
 * CSRF: patrón de doble envío (double-submit cookie + header).
 *
 * La cookie `csrf_token` no es HttpOnly para que el cliente pueda leerla y
 * reenviarla en `X-CSRF-Token`. Un origen cross-site no puede leerla (SOP) ni
 * forzar su envío junto con un header arbitrario, así que la comparación
 * header↔cookie invalida solicitudes forjadas.
 */
import { randomBytes, timingSafeEqual } from 'crypto';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';
const CSRF_MAX_AGE = 60 * 60 * 24 * 7;

export function generateCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

export function serializeCsrfCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${CSRF_COOKIE}=${token}; Path=/; SameSite=Strict; Max-Age=${CSRF_MAX_AGE}${secure}`;
}

function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('Cookie');
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) {
      try {
        return decodeURIComponent(rawValue.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function readCsrfCookie(req: Request): string | null {
  return readCookie(req, CSRF_COOKIE);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function isCsrfValid(req: Request): boolean {
  const header = req.headers.get(CSRF_HEADER);
  const cookie = readCsrfCookie(req);
  return Boolean(header && cookie && safeEqual(header, cookie));
}

/** GET/HEAD/OPTIONS no mutan estado: no requieren CSRF. */
export function assertCsrf(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  return isCsrfValid(req);
}
