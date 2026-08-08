import { corsOptions } from '@/lib/cors';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { loginSchema } from '@/lib/validation';
import { authService } from '@/src/modules/auth/auth.service';
import { sendJson } from '@/src/shared/http';
import { logger } from '@/lib/observability';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  // ISS-20: el cupo se comprueba DESPUÉS de validar el cuerpo, porque antes el
  // correo todavía no existe y la clave no puede incluirlo. Efecto secundario
  // aceptado: un cuerpo malformado deja de consumir cupo.
  const raw = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return sendJson({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, 400);
  }

  // Sin proxy inverso delante, getClientAddress devuelve 'unknown' para todos, y
  // cinco intentos por minuto para la sala entera se agotan con un par de
  // contraseñas mal escritas: el sistema respondía "Demasiados intentos" a todo
  // el mundo, incluido quien presenta. Con el correo en la clave, el cupo se
  // aplica por cuenta y equivocarse con la propia no bloquea a los demás.
  const ip = getClientAddress(req);
  const rateKey = `login:${ip}:${parsed.data.email.toLowerCase()}`;
  if (!await checkDistributedRateLimit(rateKey, RATE_LIMITS.login)) {
    logger.warn('ratelimit.exceeded', { endpoint: 'auth/login', key: rateKey });
    return sendJson({ error: 'Demasiados intentos. Espera un minuto.' }, 429);
  }

  const result = await authService.login(req, parsed.data);
  return sendJson(result.body, result.status, { cookies: result.cookies });
}
