import { handleExportAttendanceReport } from '@/lib/handlers';

export async function GET(req: Request) {
  return handleExportAttendanceReport(req);
}
