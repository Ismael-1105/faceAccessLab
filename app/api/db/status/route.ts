import { connectDB } from '@/lib/db';
import { User, Student, AccessLog, Alert } from '@/lib/models';

export async function GET() {
  try {
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
    return new Response(JSON.stringify({ connected: false, error: err instanceof Error ? err.message : 'Unknown' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
