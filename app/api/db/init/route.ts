import { connectDB } from '@/lib/db';
import { User, Student, AccessLog, Alert } from '@/lib/models';
import { hashPassword } from '@/lib/auth';

async function seedDatabase() {
  await connectDB();
  const userCount = await User.countDocuments();
  if (userCount > 0) return 'Database already has data';

  const docenteHash = await hashPassword('docente123');
  const adminHash = await hashPassword('admin123');

  await User.insertMany([
    { email: 'admin@faceaccess.lab', passwordHash: adminHash, name: 'Nicolás Cevallos', role: 'admin', createdAt: new Date() },
    { email: 'docente@faceaccess.lab', passwordHash: docenteHash, name: 'Ismael González', role: 'docente', createdAt: new Date() },
  ]);

  return 'Database seeded: 1 admin + 1 docente';
}

export async function GET() {
  try {
    const result = await seedDatabase();
    return new Response(JSON.stringify({ ok: true, message: result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST() {
  try {
    const result = await seedDatabase();
    return new Response(JSON.stringify({ ok: true, message: result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
