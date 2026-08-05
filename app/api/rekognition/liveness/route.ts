/**
 * La sesión y el resultado de liveness pertenecen ahora a un KioskAttempt.
 * No se exponen operaciones sueltas porque permitirían combinar etapas de
 * intentos distintos o reutilizar sesiones ya consumidas.
 */
export async function POST(req: Request) {
  void req;
  return Response.json(
    { error: 'La sesión de liveness debe iniciarse mediante /api/kiosk/attempt.' },
    { status: 410 },
  );
}

export async function GET(req: Request) {
  void req;
  return Response.json(
    { error: 'El resultado de liveness solo puede ser consultado por el backend.' },
    { status: 410 },
  );
}
