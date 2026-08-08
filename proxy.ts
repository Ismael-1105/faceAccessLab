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
/**
 * Página de renovación de sesión (ISS-22). Deliberadamente FUERA de STAFF_PATHS:
 * si exigiera sesión, el middleware la redirigiría a sí misma y el navegador
 * entraría en un bucle de redirecciones, que se manifiesta como una pestaña
 * parpadeando hasta que el navegador corta.
 */
const RENEW_PATH = '/renovando';

/**
 * Solo se admite como destino una ruta interna. Sin esto, `next` sería un
 * redirector abierto en una ruta de autenticación: `//evil.com` lo interpreta el
 * navegador como protocolo relativo y sale del dominio.
 *
 * Se exporta para poder probarla de forma directa. Al llamarla desde `proxy` el
 * pathname ya viene normalizado por el parseo de URL, de modo que a través del
 * middleware la rama de rechazo es inalcanzable y una prueba que pasara por ahí
 * pasaría en vacío.
 */
export function safeNext(pathname: string, search: string): string {
  const target = `${pathname}${search}`;
  if (!target.startsWith('/') || target.startsWith('//')) return '/docente';
  return target;
}

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
      // ISS-22: la cookie de acceso vive 15 minutos y la de refresco 7 días. Si
      // la primera caducó pero la segunda sigue ahí, la sesión es renovable y
      // expulsar al login es incorrecto: pasa al abrir el panel en una pestaña
      // nueva tras un rato en el kiosco, y obliga a autenticarse otra vez
      // delante del tribunal.
      //
      // La renovación NO puede hacerla el middleware: authService.refresh exige
      // CSRF por cabecera (isCsrfValid) y una redirección es una navegación, que
      // no puede enviar cabeceras. Por eso se delega en una página cliente, que
      // sí hace fetch y sí puede adjuntar X-CSRF-Token.
      if (req.cookies.get('refresh_token')?.value) {
        const url = new URL(RENEW_PATH, req.url);
        url.searchParams.set('next', safeNext(pathname, req.nextUrl.search));
        return NextResponse.redirect(url);
      }
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
