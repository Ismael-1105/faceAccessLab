import { detectFaceAttributes } from '@/lib/rekognition';
import { Metrics } from '@/lib/cloudwatch';
import { createLivenessSession, getLivenessResult } from '@/lib/liveness';

export type LivenessChallenge = 'blink' | 'smile' | 'mouth_open' | 'turn_left' | 'turn_right';

interface ChallengeSpec {
  validate: (attrs: {
    eyesOpen: boolean | null;
    smiling: boolean | null;
    mouthOpen: boolean | null;
    yaw: number | null;
  }) => boolean;
}

const CHALLENGES: Record<LivenessChallenge, ChallengeSpec> = {
  blink: { validate: (a) => a.eyesOpen === false },
  smile: { validate: (a) => a.smiling === true },
  mouth_open: { validate: (a) => a.mouthOpen === true },
  turn_left: { validate: (a) => a.yaw !== null && a.yaw < -10 },
  turn_right: { validate: (a) => a.yaw !== null && a.yaw > 10 },
};

const CHALLENGE_LABELS: Record<LivenessChallenge, string> = {
  blink: 'Parpadea',
  smile: 'Sonríe',
  mouth_open: 'Abre la boca',
  turn_left: 'Gira la cabeza a la izquierda',
  turn_right: 'Gira la cabeza a la derecha',
};

export const LIVENESS_CONFIDENCE_THRESHOLD = 75;

/**
 * POST /api/rekognition/liveness
 *
 * Modes:
 *  - `{ init: true }`                    → crea una sesión de Face Liveness oficial de AWS
 *  - `{ imageBase64, challenge }`        → verifica un reto de liveness (DetectFaces)
 *  - `{ imageBase64 }` (sin challenge)   → solo detección de rostro + atributos
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      init?: boolean;
      imageBase64?: string;
      frames?: string[];
      challenge?: string;
    };

    if (body.init) {
      const session = await createLivenessSession();
      return new Response(JSON.stringify({
        ok: true,
        mode: 'session',
        sessionId: session.sessionId,
        expiresAt: session.expiry,
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    const images: string[] = body.frames?.length ? body.frames : (body.imageBase64 ? [body.imageBase64] : []);

    if (images.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'imageBase64 o frames requerido' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const decode = (b64: string) => {
      const data = b64.replace(/^data:image\/\w+;base64,/, '');
      return Uint8Array.from(Buffer.from(data, 'base64'));
    };

    const challengeKey = (body.challenge && body.challenge in CHALLENGES ? body.challenge : null) as LivenessChallenge | null;

    let faceDetected = false;
    let anyPassed = false;
    let bestSharpness = 0;
    let lastAttrs: { eyesOpen: boolean | null; smiling: boolean | null; mouthOpen: boolean | null; yaw: number | null } | null = null;

    const results = await Promise.all(images.map(b64 => detectFaceAttributes(decode(b64))));

    for (const attrs of results) {
      if (!attrs.faceDetected) continue;
      faceDetected = true;

      if (attrs.sharpness > bestSharpness) bestSharpness = attrs.sharpness;

      lastAttrs = { eyesOpen: attrs.eyesOpen, smiling: attrs.smiling, mouthOpen: attrs.mouthOpen, yaw: attrs.yaw };

      if (!challengeKey) {
        anyPassed = true;
        break;
      }

      const spec = CHALLENGES[challengeKey];
      if (spec.validate(lastAttrs)) {
        anyPassed = true;
        break;
      }
    }

    if (!faceDetected) {
      return new Response(JSON.stringify({
        ok: false,
        passed: false,
        reason: 'NO_FACE',
        message: 'No se detectó un rostro. Asegúrate de estar frente a la cámara.',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (!challengeKey) {
      return new Response(JSON.stringify({
        ok: true,
        passed: true,
        reason: 'NO_CHALLENGE',
        message: 'Rostro detectado.',
        sharpness: bestSharpness,
        attrs: lastAttrs,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const passed = anyPassed;

    if (passed) {
      Metrics.livenessChecked();
    } else {
      Metrics.livenessFailed();
    }

    return new Response(JSON.stringify({
      ok: true,
      mode: 'challenge',
      passed,
      challenge: challengeKey,
      label: CHALLENGE_LABELS[challengeKey],
      message: passed ? 'Reto superado' : 'No se detectó el reto. Volvé a intentarlo.',
      attrs: lastAttrs,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/rekognition/liveness?sessionId=X
 * Obtiene el resultado de una sesión de Face Liveness oficial de AWS.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response(JSON.stringify({ ok: false, error: 'sessionId requerido' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await getLivenessResult(sessionId);

    if (result.status === 'SUCCEEDED') {
      Metrics.livenessChecked();
    } else if (result.status === 'FAILED') {
      Metrics.livenessFailed();
    }

    const passed = result.status === 'SUCCEEDED' && result.confidence >= LIVENESS_CONFIDENCE_THRESHOLD;

    return new Response(JSON.stringify({
      ok: true,
      mode: 'session',
      status: result.status,
      confidence: result.confidence,
      passed,
      threshold: LIVENESS_CONFIDENCE_THRESHOLD,
      faceId: result.faceId,
      externalImageId: result.externalImageId,
      message: passed
        ? `Liveness superado (${result.confidence.toFixed(1)}%)`
        : `Liveness ${result.status} — confianza ${result.confidence.toFixed(1)}%`,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
