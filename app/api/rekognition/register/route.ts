import { indexFace } from '@/lib/rekognition';

export async function POST(req: Request) {
  try {
    const { studentId, imageBase64 } = await req.json() as { studentId?: string; imageBase64?: string };

    if (!studentId || !imageBase64) {
      return new Response(JSON.stringify({ error: 'studentId e imageBase64 son requeridos' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));

    const faceId = await indexFace(imageBytes, studentId);

    return new Response(JSON.stringify({
      ok: true,
      faceId,
      message: faceId ? 'Rostro registrado exitosamente' : 'No se detectó ningún rostro en la imagen',
    }), { status: faceId ? 201 : 400, headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
