import { corsOptions } from '@/lib/cors';
import { handleGetKioskSession } from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetKioskSession(req);
}
