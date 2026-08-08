import { getPresignedUrl } from '@/lib/s3';
import { connectDB } from '@/lib/db';
import { getActorFromHeaderOrCookie } from '@/lib/rbac';
import { canReadPhoto } from '@/lib/photo-access';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // Este endpoint se consume como `src` de una etiqueta <img>, y un navegador
    // nunca añade la cabecera Authorization a la petición de una imagen. Es el
    // único sitio de la API que acepta la cookie de acceso; ver el comentario
    // de getActorFromHeaderOrCookie en lib/rbac.ts.
    const actor = getActorFromHeaderOrCookie(req);
    if (!actor || (actor.role !== 'admin' && actor.role !== 'docente')) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { key } = await params;
    await connectDB();
    // Sin cambios: es la barrera que impide que un docente vea fotos de alumnos
    // que no son suyos. Se sigue ejecutando siempre.
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
