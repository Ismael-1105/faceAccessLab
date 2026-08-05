import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';

// En producción, JWT_SECRET es obligatorio; en desarrollo se permite un default
// para no romper el arranque local, pero NUNCA debe usarse en un entorno real.
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET es obligatorio en producción'); })()
    : 'faceaccess-lab-dev-secret-change-in-production');

// Access token de corta duración (Fase 2). Configurable vía JWT_EXPIRES_IN.
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'docente' | 'estudiante';
  studentId?: string;
  labCode?: string;
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Convierte '15m' | '1h' | '7d' | '60s' a segundos (para Max-Age de cookies). */
export function expiresInToSeconds(exp: string): number {
  const m = exp.trim().match(/^(\d+)([smhd])$/);
  if (!m) return 900;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    default: return n * 86400;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn'] });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

/** Solo se acepta el token por cabecera Authorization (nunca por cookie). */
export function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function getAuthPayload(req: Request): TokenPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

// ── Cookies de sesión (HttpOnly, Secure en producción, SameSite=Strict) ────

export const ACCESS_COOKIE = 'token';
export const REFRESH_COOKIE = 'refresh_token';

function cookieBase(maxAgeSeconds: number): string {
  const secure = isProd() ? '; Secure' : '';
  return `; Path=/; SameSite=Strict; HttpOnly; Max-Age=${maxAgeSeconds}${secure}`;
}

export function serializeAccessCookie(token: string): string {
  return `${ACCESS_COOKIE}=${encodeURIComponent(token)}${cookieBase(expiresInToSeconds(ACCESS_TOKEN_EXPIRES_IN))}`;
}

export function serializeRefreshCookie(token: string): string {
  const days = Number(process.env.REFRESH_TOKEN_DAYS || 7);
  return `${REFRESH_COOKIE}=${encodeURIComponent(token)}${cookieBase(days * 86400)}`;
}

export function clearAuthCookies(): string[] {
  const clear = (name: string) => `${name}=; Path=/; SameSite=Strict; HttpOnly; Max-Age=0`;
  return [clear(ACCESS_COOKIE), clear(REFRESH_COOKIE)];
}

export function readRefreshToken(req: Request): string | null {
  const cookieHeader = req.headers.get('Cookie');
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === REFRESH_COOKIE) {
      try {
        return decodeURIComponent(rawValue.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ── Respuestas JSON (sin CORS comodín, cabeceras básicas de seguridad) ─────

export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function errorResponse(message: string, status = 400, extraHeaders: Record<string, string> = {}): Response {
  if (status >= 500) {
    // Observabilidad: métrica de errores 5xx + alerta si supera el umbral.
    void import('./monitoring.ts').then(({ recordHttpError }) => recordHttpError('api', status));
    void import('./cloudwatch.ts').then(({ Metrics }) => Metrics.httpError('api', status));
  }
  return jsonResponse({ error: message }, status, extraHeaders);
}
