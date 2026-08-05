/**
 * Capa shared: utilidades HTTP puras para rutas delgadas.
 *
 * Una ruta ideal (Fase 5):
 *   1. autoriza (requireTeacher/requireAdmin)      ← lib/rbac
 *   2. valida el cuerpo (schema.parse)             ← lib/validation
 *   3. delega en un service de módulo              ← src/modules/*
 *   4. formatea la respuesta (sendJson)            ← este módulo
 * La ruta NO toca AWS, persistencia, auditoría ni alertas.
 */
export function sendJson(
  data: unknown,
  status = 200,
  opts: { cookies?: string[] } = {},
): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' });
  for (const cookie of opts.cookies ?? []) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function sendError(message: string, status = 400): Response {
  return sendJson({ error: message }, status);
}
