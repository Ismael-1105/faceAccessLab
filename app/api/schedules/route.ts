import { corsOptions } from '@/lib/cors';
import {
  handleGetSchedules,
  handleCreateSchedule,
  handleUpdateSchedule,
  handleDeleteSchedule,
} from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
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
