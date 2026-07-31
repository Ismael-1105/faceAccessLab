import { uploadImage } from '@/lib/s3';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const { imageBase64, studentId } = await req.json() as {
      imageBase64?: string;
      studentId?: string;
    };

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 es requerido' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const s3Key = `students/${studentId || uuidv4()}.jpg`;
    const imageUrl = await uploadImage(s3Key, imageBase64);

    return new Response(JSON.stringify({ ok: true, url: imageUrl, key: s3Key }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
