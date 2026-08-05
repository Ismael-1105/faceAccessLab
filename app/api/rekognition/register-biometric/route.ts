import { corsOptions } from '@/lib/cors';
import { handleRegisterBiometric } from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  return handleRegisterBiometric(req);
}
