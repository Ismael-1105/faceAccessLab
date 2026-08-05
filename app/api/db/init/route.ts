import { connectDB } from '@/lib/db';
import { User, Student, AccessLog, Alert } from '@/lib/models';
import { hashPassword } from '@/lib/auth';
import { requireAdmin } from '@/lib/rbac';

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

export async function GET(req: Request) {
  try {
    // Solo administradores (o entorno de desarrollo) pueden inicializar la BD.
    if (process.env.NODE_ENV !== 'development') {
      requireAdmin(req);
    }
    const result = await seedDatabase();
    return new Response(JSON.stringify({ ok: true, message: result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : 500;
    return new Response(JSON.stringify({ ok: false, error: status === 401 || status === 403 ? 'No autorizado' : (err instanceof Error ? err.message : 'Unknown error') }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      requireAdmin(req);
    }
    const result = await seedDatabase();
    return new Response(JSON.stringify({ ok: true, message: result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : 500;
    return new Response(JSON.stringify({ ok: false, error: status === 401 || status === 403 ? 'No autorizado' : (err instanceof Error ? err.message : 'Unknown error') }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
