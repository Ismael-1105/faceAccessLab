import { corsOptions } from '@/lib/cors';
import {
  handleGetLabs,
  handleCreateLab,
  handleUpdateLab,
  handleDeleteLab,
} from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetLabs(req);
}

export async function POST(req: Request) {
  return handleCreateLab(req);
}

export async function PUT(req: Request) {
  return handleUpdateLab(req);
}

export async function DELETE(req: Request) {
  return handleDeleteLab(req);
}
