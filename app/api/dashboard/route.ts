import { handleGetDashboard } from '@/lib/handlers';

export async function GET(req: Request) {
  return handleGetDashboard(req);
}
