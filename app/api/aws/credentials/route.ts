import { STSClient, GetSessionTokenCommand } from '@aws-sdk/client-sts';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { getKioskAttemptToken } from '@/lib/kiosk-attempt-cookie';
import { getActor } from '@/lib/rbac';
import { assertKioskAttemptForCredentials } from '@/lib/kiosk-verification';

const DURATION_SECONDS = 3600;

/**
 * GET /api/aws/credentials
 * Genera credenciales temporales (STS) para el streaming de Face Liveness.
 * Se usa en el credentialProvider del FaceLivenessDetectorCore (kiosco público).
 *
 * Seguridad:
 * - El kiosco debe presentar un intento efímero creado por el backend.
 * - También se acepta sesión de docente/administrador.
 * - En producción, la clave maestra STS debe tener IAM de mínimo privilegio
 *   (solo rekognition:CreateFaceLivenessSession).
 */
export async function GET(req: Request) {
  const ip = getClientAddress(req);
  if (!await checkDistributedRateLimit(`sts:${ip}`, RATE_LIMITS.sts)) {
    return new Response(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes. Espera un minuto.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }

  const attemptId = req.headers.get('x-kiosk-attempt') || new URL(req.url).searchParams.get('attemptId');
  const attemptToken = getKioskAttemptToken(req);
  const actor = getActor(req);

  const hasValidAttempt = attemptId && attemptToken
    ? await assertKioskAttemptForCredentials(attemptId, attemptToken)
    : false;
  const hasValidSession = actor && (actor.role === 'admin' || actor.role === 'docente');

  if (!hasValidAttempt && !hasValidSession) {
    return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const region = process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      return new Response(JSON.stringify({ ok: false, error: 'AWS credenciales no configuradas' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const sts = new STSClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    const result = await sts.send(
      new GetSessionTokenCommand({ DurationSeconds: DURATION_SECONDS })
    );

    const creds = result.Credentials;
    if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
      return new Response(JSON.stringify({ ok: false, error: 'STS no devolvió credenciales' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretAccessKey,
      sessionToken: creds.SessionToken,
      expiration: creds.Expiration,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
