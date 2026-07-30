import { ensureCollection } from '@/lib/rekognition';

export async function POST() {
  try {
    await ensureCollection();
    return new Response(JSON.stringify({ ok: true, message: 'Colección Rekognition lista' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
