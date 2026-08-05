import {
  handleGetSchedules,
  handleCreateSchedule,
  handleUpdateSchedule,
  handleDeleteSchedule,
} from '@/lib/handlers';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(req: Request) {
  return handleGetSchedules(req);
}

export async function POST(req: Request) {
  return handleCreateSchedule(req);
}

export async function PUT(req: Request) {
  return handleUpdateSchedule(req);
}

export async function DELETE(req: Request) {
  return handleDeleteSchedule(req);
}
