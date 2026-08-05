import { corsOptions } from '@/lib/cors';
import { handleGetEvidence } from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
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
