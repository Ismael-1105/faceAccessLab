import { handleGetAttendanceReport } from '@/lib/handlers';

export async function GET(req: Request) {
  return handleGetAttendanceReport(req);
}
