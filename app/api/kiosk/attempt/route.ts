import { createKioskAttempt } from '@/lib/kiosk-verification';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { serializeKioskAttemptCookie } from '@/lib/kiosk-attempt-cookie';

export async function POST(req: Request) {
  const ip = getClientAddress(req);
  if (!await checkDistributedRateLimit(`kiosk-attempt:${ip}`, RATE_LIMITS.compare)) {
    return Response.json({ ok: false, error: 'Demasiadas solicitudes. Espera un minuto.' }, { status: 429 });
  }
  try {
    const { attemptToken, ...attempt } = await createKioskAttempt();
    return Response.json(
      { ok: true, ...attempt },
      {
        status: 201,
        headers: { 'Set-Cookie': serializeKioskAttemptCookie(attemptToken) },
      },
    );
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo iniciar la verificación' }, { status: 500 });
  }
}
