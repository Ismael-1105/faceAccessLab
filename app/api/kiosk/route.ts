import { handleGetStudentsPublic, handleCreateLogPublic } from '@/lib/handlers';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(req: Request) {
  return handleGetStudentsPublic(req);
}

export async function POST(req: Request) {
  return handleCreateLogPublic(req);
}
