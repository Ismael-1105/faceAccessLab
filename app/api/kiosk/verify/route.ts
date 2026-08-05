import { verifyKioskAttempt } from '@/lib/kiosk-verification';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { InvalidJsonError, PayloadTooLargeError, readLimitedJson } from '@/lib/request-body';
import { getKioskAttemptToken } from '@/lib/kiosk-attempt-cookie';

// Imagen máxima backend: 2 MiB. El base64 añade ~33% y el resto es JSON.
const MAX_VERIFY_BODY_BYTES = 3 * 1024 * 1024;

export async function POST(req: Request) {
  const ip = getClientAddress(req);
  if (!await checkDistributedRateLimit(`kiosk-verify:${ip}`, RATE_LIMITS.compare)) {
    return Response.json({ ok: false, error: 'Demasiadas solicitudes. Espera un minuto.' }, { status: 429 });
  }
  try {
    const body = await readLimitedJson<{
      attemptId?: string;
      imageBase64?: string;
    }>(req, MAX_VERIFY_BODY_BYTES);
    if (!body.attemptId || !body.imageBase64) {
      return Response.json({ ok: false, error: 'attemptId e imageBase64 son requeridos' }, { status: 400 });
    }
    const attemptToken = getKioskAttemptToken(req);
    if (!attemptToken) {
      return Response.json({ ok: false, error: 'Credencial de intento requerida' }, { status: 401 });
    }
    const result = await verifyKioskAttempt(body.attemptId, attemptToken, body.imageBase64);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json({ ok: false, error: error.message }, { status: 413 });
    }
    if (error instanceof InvalidJsonError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo verificar el acceso' }, { status: 400 });
  }
}
