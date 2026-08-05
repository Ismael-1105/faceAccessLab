import { connectDB } from '@/lib/db';
import { User, Student, AccessLog, Alert } from '@/lib/models';
import { requireAuth } from '@/lib/rbac';

export async function GET(req: Request) {
  try {
    requireAuth(req);
    await connectDB();
    const [users, students, logs, alerts] = await Promise.all([
      User.countDocuments(),
      Student.countDocuments(),
      AccessLog.countDocuments(),
      Alert.countDocuments(),
    ]);
    return new Response(JSON.stringify({
      connected: true,
      database: 'faceaccess-lab',
      collections: {
        users: `${users} docs`,
        students: `${students} docs`,
        access_logs: `${logs} docs`,
        alerts: `${alerts} docs`,
      },
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : 500;
    return new Response(JSON.stringify({ connected: false, error: status === 401 ? 'No autorizado' : (err instanceof Error ? err.message : 'Unknown') }), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  }
}
