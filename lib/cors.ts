/**
 * CORS restringido: nunca se emite `Access-Control-Allow-Origin: *`.
 *
 * El origen solo se autoriza si está en ALLOWED_ORIGINS (lista separada por
 * comas) o, si no hay configuración, únicamente el propio dominio y localhost.
 * Las peticiones mismas de la aplicación son same-origin y no necesitan CORS.
 */
function allowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS || '';
  const fromEnv = env.split(',').map(s => s.trim()).filter(Boolean);
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  return Array.from(new Set([...fromEnv, baseUrl, vercelUrl].filter(Boolean)));
}

/** ¿El Origin de la petición está autorizado a consumir la API? */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const origins = allowedOrigins();
  if (origins.length === 0) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return origins.includes(origin);
}

/** Cabeceras CORS restringidas. Si el origen no está autorizado, no se envía ACAO. */
export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
  };
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }
  return headers;
}

/** Respuesta preflight sin comodín. */
export function corsOptions(req?: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
