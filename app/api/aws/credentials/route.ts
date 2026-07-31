import { STSClient, GetSessionTokenCommand } from '@aws-sdk/client-sts';

const DURATION_SECONDS = 3600;

/**
 * GET /api/aws/credentials
 * Genera credenciales temporales (STS) para el streaming de Face Liveness.
 * Se usa en el credentialProvider del FaceLivenessDetectorCore.
 */
export async function GET() {
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
