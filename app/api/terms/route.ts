import { corsOptions } from '@/lib/cors';
import { handleGetAcademicTerms, handleCreateAcademicTerm } from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetAcademicTerms(req);
}

export async function POST(req: Request) {
  return handleCreateAcademicTerm(req);
}
