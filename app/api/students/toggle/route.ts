import { corsOptions } from '@/lib/cors';
import { handleToggleStudent } from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function PUT(req: Request) {
  return handleToggleStudent(req);
}
