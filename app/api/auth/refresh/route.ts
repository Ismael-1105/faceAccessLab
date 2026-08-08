import { corsOptions } from '@/lib/cors';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { authService } from '@/src/modules/auth/auth.service';
import { sendJson } from '@/src/shared/http';
import { logger } from '@/lib/observability';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  // ISS-20: aquí la clave se queda por dirección. No hay cuerpo del que sacar el
  // correo, y la identidad viaja en la cookie de refresco, que es HttpOnly: no
  // se puede leer para construir la clave sin rotar la sesión antes, que es
  // justamente lo que este endpoint decide si hacer.
  const ip = getClientAddress(req);
  const rateKey = `refresh:${ip}`;
  if (!await checkDistributedRateLimit(rateKey, RATE_LIMITS.login)) {
    logger.warn('ratelimit.exceeded', { endpoint: 'auth/refresh', key: rateKey });
    return sendJson({ error: 'Demasiadas solicitudes. Espera un minuto.' }, 429);
  }
  const result = await authService.refresh(req);
  return sendJson(result.body, result.status, { cookies: result.cookies });
}
