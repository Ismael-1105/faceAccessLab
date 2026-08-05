
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(req: Request) {
  void req;
  return Response.json(
    { error: 'El kiosco ya no descarga el directorio de estudiantes.' },
    { status: 410 },
  );
}

export async function POST(req: Request) {
  void req;
  return Response.json(
    { error: 'La creación de accesos desde el cliente fue retirada. Usa el flujo de verificación del kiosco.' },
    { status: 410 },
  );
}
