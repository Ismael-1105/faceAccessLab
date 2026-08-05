import { handleRevokeBiometric } from '@/lib/handlers';
import { corsOptions } from '@/lib/cors';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function PUT(req: Request) {
  return handleRevokeBiometric(req);
}
