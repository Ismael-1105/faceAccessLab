import { handleGetConsentLogs } from '@/lib/handlers';
import { corsOptions } from '@/lib/cors';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetConsentLogs(req);
}
