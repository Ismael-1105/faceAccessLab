import { indexFace } from '@/lib/rekognition';

export async function POST(req: Request) {
  try {
    const { studentId, imageBase64 } = await req.json() as {
      studentId?: string;
      imageBase64?: string;
    };

    if (!studentId || !imageBase64) {
      return new Response(JSON.stringify({ error: 'studentId e imageBase64 son requeridos' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));

    const faceId = await indexFace(imageBytes, studentId);

    if (!faceId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'NO_FACE',
        message: 'No se detectó ningún rostro en la imagen. Asegurate de que el rostro esté visible, bien iluminado y centrado.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      ok: true,
      faceId,
      message: 'Rostro registrado exitosamente',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';

    if (msg.includes('InvalidImageFormatException')) {
      return new Response(JSON.stringify({ ok: false, error: 'BAD_IMAGE', message: 'Formato de imagen no válido.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
