/**
 * POST /api/authorize
 * Body: { studentId, labCode }
 * Determina si el estudiante puede acceder ahora al laboratorio según la
 * planificación de clases vigente (clase activa hoy a esta hora + inscripción)
 * y el estado de sesión ("en curso" iniciado por el docente).
 * Es un endpoint público del kiosco; el acceso real se valida igualmente en el
 * flujo del kiosco tras el match biométrico.
 */
export async function POST(req: Request) {
  void req;
  return Response.json(
    { error: 'La autorización separada fue retirada. Usa la verificación autoritativa del kiosco.' },
    { status: 410 },
  );
}
