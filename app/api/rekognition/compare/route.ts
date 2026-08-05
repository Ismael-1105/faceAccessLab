export async function POST(req: Request) {
  void req;
  return Response.json(
    { error: 'La comparación biométrica directa fue retirada. Usa la verificación autoritativa del kiosco.' },
    { status: 410 },
  );
}
