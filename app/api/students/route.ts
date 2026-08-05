import { corsOptions } from '@/lib/cors';
import {
  handleGetStudents,
  handleCreateStudent,
  handleUpdateStudent,
  handleDeleteStudent,
} from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetStudents(req);
}

export async function POST(req: Request) {
  return handleCreateStudent(req);
}

export async function PUT(req: Request) {
  return handleUpdateStudent(req);
}

export async function DELETE(req: Request) {
  return handleDeleteStudent(req);
}
