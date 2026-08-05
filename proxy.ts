import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware de protección de rutas (Fase 2).
 *
 * - /login: solo accesible sin sesión (redirige al panel si ya hay sesión).
 * - /docente: requiere sesión con rol admin o docente (bloquea estudiantes/anónimos).
 * - /kiosco: es público (terminal de acceso), pero requiere conexión.
 *
 * La verificación del JWT es CRIPTOGRÁFICA (HMAC-SHA256 con JWT_SECRET), no un
 * simple base64: un token forjado o firmado con otro secreto se rechaza.
 *
 * La autorización real siempre se valida de nuevo en el backend (RBAC en las APIs);
 * este middleware protege la capa de presentación.
 */

// Rutas que requieren rol docente o admin.
const STAFF_PATHS = ['/docente', '/diagnostico'];
// Rutas públicas (kiosco y home).
const PUBLIC_PATHS = ['/kiosco', '/login', '/recuperar', '/'];

const encoder = new TextEncoder();

function secret(): string {
  return process.env.JWT_SECRET
    || (process.env.NODE_ENV === 'production'
      ? ''
      : 'faceaccess-lab-dev-secret-change-in-production');
}

/** Verifica firma HMAC-SHA256 y expiración del JWT. Devuelve el payload o null. */
async function verifyJwt(token: string): Promise<{ role?: string; exp?: number } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const secretBytes = secret();
    if (!secretBytes) return null;

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretBytes),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (expected !== parts[2]) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '') || '';

  const payload = token ? await verifyJwt(token) : null;
  const isLogged = !!payload;
  const role = payload?.role;

  // /login: redirigir al panel si ya hay sesión activa.
  if (pathname === '/login' && isLogged) {
    return NextResponse.redirect(new URL(role === 'admin' || role === 'docente' ? '/docente' : '/', req.url));
  }

  // Rutas de staff (docente/admin): exigen sesión y rol correcto.
  if (STAFF_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    if (!isLogged) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    if (role !== 'admin' && role !== 'docente') {
      // Estudiantes o roles inválidos no acceden al panel administrativo.
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/docente/:path*', '/docente', '/login'],
};
