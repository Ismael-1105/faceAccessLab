import { handleGetLabDashboard } from '@/lib/handlers';

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handleGetLabDashboard(req, code);
}
