import { getPresignedUrl } from '@/lib/s3';
import { connectDB } from '@/lib/db';
import { requireTeacher } from '@/lib/rbac';
import { canReadPhoto } from '@/lib/photo-access';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const actor = requireTeacher(req);
    const { key } = await params;
    await connectDB();
    if (!(await canReadPhoto(actor, key))) {
      return Response.json({ error: 'Acceso restringido' }, { status: 403 });
    }
    const url = await getPresignedUrl(key, 3600);
    return Response.redirect(url);
  } catch (error) {
    const status = error instanceof Error && 'status' in error
      ? (error as { status: number }).status
      : 500;
    return new Response(JSON.stringify({ error: status === 401 ? 'No autorizado' : 'No se pudo generar la URL' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
