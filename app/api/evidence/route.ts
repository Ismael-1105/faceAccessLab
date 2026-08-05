import { handleGetEvidence } from '@/lib/handlers';

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
  return handleGetEvidence(req);
}

export async function POST(req: Request) {
  void req;
  return Response.json(
    { error: 'La evidencia solo puede ser creada por la verificación autoritativa del kiosco.' },
    { status: 410 },
  );
}
