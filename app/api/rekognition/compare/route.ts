import { searchFace } from '@/lib/rekognition';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(`rekognition:${ip}`, RATE_LIMITS.compare)) {
    return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Espera un minuto.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { imageBase64 } = await req.json() as { imageBase64?: string };

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 es requerido' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));

    const result = await searchFace(imageBytes);

    if (result.externalImageId) {
      return new Response(JSON.stringify({
        ok: true,
        match: true,
        studentId: result.studentId,
        studentName: result.studentName,
        confidence: result.confidence,
        faceId: result.faceId,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      ok: true,
      match: false,
      confidence: 0,
      message: 'No se encontró coincidencia',
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
