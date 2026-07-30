import { handleGetStudents, handleCreateStudent, handleUpdateStudent, handleToggleStudent } from '@/lib/handlers';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
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
