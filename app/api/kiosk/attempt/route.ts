import { createKioskAttempt } from '@/lib/kiosk-verification';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { serializeKioskAttemptCookie } from '@/lib/kiosk-attempt-cookie';
import { getRequestId } from '@/lib/observability';
import { Metrics } from '@/lib/cloudwatch';
import { sanitizeError } from '@/lib/errors';

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const ip = getClientAddress(req);
  if (!await checkDistributedRateLimit(`kiosk-attempt:${ip}`, RATE_LIMITS.compare)) {
    return Response.json({ ok: false, error: 'Demasiadas solicitudes. Espera un minuto.' }, { status: 429 });
  }
  try {
    const { attemptToken, ...attempt } = await createKioskAttempt(requestId);
    return Response.json(
      { ok: true, ...attempt },
      {
        status: 201,
        headers: { 'Set-Cookie': serializeKioskAttemptCookie(attemptToken) },
      },
    );
  } catch (error) {
    void Metrics.httpError('kiosk/attempt', 500);
    return Response.json({ ok: false, error: sanitizeError(error) }, { status: 500 });
  }
}
