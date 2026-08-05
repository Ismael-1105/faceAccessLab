import { ensureCollection } from '@/lib/rekognition';
import { requireAdmin } from '@/lib/rbac';

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    await ensureCollection();
    return new Response(JSON.stringify({ ok: true, message: 'Colección Rekognition lista' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const status = error instanceof Error && 'status' in error
      ? (error as { status: number }).status
      : 500;
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  }
}
