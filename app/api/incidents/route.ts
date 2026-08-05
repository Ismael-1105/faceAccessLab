import { corsOptions } from '@/lib/cors';
import { handleGetIncidents, handleUpdateIncident } from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetIncidents(req);
}

export async function PUT(req: Request) {
  return handleUpdateIncident(req);
}
