import { corsOptions } from '@/lib/cors';
import { handleGetLogs } from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetLogs(req);
}

export async function POST(req: Request) {
  void req;
  return Response.json(
    { error: 'Los accesos solo pueden ser creados por la verificación autoritativa del kiosco.' },
    { status: 410 },
  );
}
