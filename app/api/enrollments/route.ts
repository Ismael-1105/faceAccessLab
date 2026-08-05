import { corsOptions } from '@/lib/cors';
import {
  handleGetEnrollments,
  handleCreateEnrollment,
  handleDeleteEnrollment,
} from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetEnrollments(req);
}

export async function POST(req: Request) {
  return handleCreateEnrollment(req);
}

export async function DELETE(req: Request) {
  return handleDeleteEnrollment(req);
}
