import { handleLogin } from '@/lib/handlers';
import { checkRateLimit } from '@/lib/rate-limit';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(`login:${ip}`, 5)) {
    return new Response(JSON.stringify({ error: 'Demasiados intentos. Espera un minuto.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return handleLogin(req);
}
