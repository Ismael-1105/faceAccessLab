import { corsOptions } from '@/lib/cors';
import { authService } from '@/src/modules/auth/auth.service';
import { sendJson } from '@/src/shared/http';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
  const result = await authService.logout(req);
  return sendJson(result.body, result.status, { cookies: result.cookies });
}
