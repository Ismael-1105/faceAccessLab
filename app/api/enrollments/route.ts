import {
  handleGetEnrollments,
  handleCreateEnrollment,
  handleDeleteEnrollment,
} from '@/lib/handlers';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
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
