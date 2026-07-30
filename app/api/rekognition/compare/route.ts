import { searchFace, FaceMatchResult } from '@/lib/rekognition';

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json() as { imageBase64?: string };

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 es requerido' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));

    const result: FaceMatchResult = await searchFace(imageBytes);

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
