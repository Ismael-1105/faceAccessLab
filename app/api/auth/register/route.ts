import { corsOptions } from '@/lib/cors';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { registerSchema } from '@/lib/validation';
import { requireAdmin } from '@/lib/rbac';
import { authService } from '@/src/modules/auth/auth.service';
import { sendJson } from '@/src/shared/http';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  const ip = getClientAddress(req);
  if (!await checkDistributedRateLimit(`register:${ip}`, RATE_LIMITS.register)) {
    return sendJson({ error: 'Demasiadas solicitudes. Espera un minuto.' }, 429);
  }

  let actor;
  try {
    actor = requireAdmin(req);
  } catch {
    return sendJson({ error: 'Acceso restringido a administradores' }, 403);
  }

  const raw = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return sendJson({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, 400);
  }

  const result = await authService.register(actor, parsed.data);
  return sendJson(result.body, result.status);
}
