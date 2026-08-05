import { handleGetIncidents, handleUpdateIncident } from '@/lib/handlers';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(req: Request) {
  return handleGetIncidents(req);
}

export async function PUT(req: Request) {
  return handleUpdateIncident(req);
}
