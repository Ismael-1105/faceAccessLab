import { corsOptions } from '@/lib/cors';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { authService } from '@/src/modules/auth/auth.service';
import { sendJson } from '@/src/shared/http';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  const ip = getClientAddress(req);
  if (!await checkDistributedRateLimit(`refresh:${ip}`, RATE_LIMITS.login)) {
    return sendJson({ error: 'Demasiadas solicitudes. Espera un minuto.' }, 429);
  }
  const result = await authService.refresh(req);
  return sendJson(result.body, result.status, { cookies: result.cookies });
}
