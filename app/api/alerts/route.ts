import { corsOptions } from '@/lib/cors';
import { handleGetAlerts, handleUpdateAlert } from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetAlerts(req);
}

export async function PUT(req: Request) {
  return handleUpdateAlert(req);
}
