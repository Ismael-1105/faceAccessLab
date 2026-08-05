import { corsOptions } from '@/lib/cors';
import { handleGetAttendance } from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetAttendance(req);
}

export async function POST(req: Request) {
  void req;
  return Response.json(
    { error: 'La asistencia solo puede ser creada por la verificación autoritativa del kiosco.' },
    { status: 410 },
  );
}
