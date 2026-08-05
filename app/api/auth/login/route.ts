import { corsOptions } from '@/lib/cors';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { loginSchema } from '@/lib/validation';
import { authService } from '@/src/modules/auth/auth.service';
import { sendJson } from '@/src/shared/http';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  const ip = getClientAddress(req);
  if (!await checkDistributedRateLimit(`login:${ip}`, RATE_LIMITS.login)) {
    return sendJson({ error: 'Demasiados intentos. Espera un minuto.' }, 429);
  }

  const raw = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return sendJson({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, 400);
  }

  const result = await authService.login(req, parsed.data);
  return sendJson(result.body, result.status, { cookies: result.cookies });
}
