import { corsOptions } from '@/lib/cors';
import {
  handleGetUsers,
  handleCreateUser,
  handleUpdateUser,
  handleDeleteUser,
  handleUpdateUserStatus,
} from '@/lib/handlers';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  return handleGetUsers(req);
}

export async function POST(req: Request) {
  return handleCreateUser(req);
}

export async function PUT(req: Request) {
  return handleUpdateUser(req);
}

export async function PATCH(req: Request) {
  return handleUpdateUserStatus(req);
}

export async function DELETE(req: Request) {
  return handleDeleteUser(req);
}
