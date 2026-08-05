import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware de protección de rutas.
 *
 * - /login: solo accesible sin sesión (redirige al panel si ya hay sesión).
 * - /docente: requiere sesión con rol admin o docente (bloquea estudiantes/anónimos).
 * - /kiosco: es público (terminal de acceso), pero requiere conexión.
 *
 * La autorización real siempre se valida de nuevo en el backend (RBAC en las APIs);
 * este middleware protege la capa de presentación.
 */

// Rutas que requieren rol docente o admin.
const STAFF_PATHS = ['/docente'];
// Rutas públicas (kiosco y home).
const PUBLIC_PATHS = ['/kiosco', '/login', '/recuperar', '/'];

function parseJwt(token: string): { role?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '') || '';

  const payload = token ? parseJwt(token) : null;
  const isLogged = !!payload && typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
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
