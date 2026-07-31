import { config } from 'dotenv';
config();

import { connectDB } from '../lib/db.ts';
import { User, Student, AccessLog, Alert } from '../lib/models.ts';
import { hashPassword } from '../lib/auth.ts';

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await connectDB();
  console.log('[Seed] Connected. Clearing existing data...');

  await Promise.all([
    User.deleteMany({}),
    Student.deleteMany({}),
    AccessLog.deleteMany({}),
    Alert.deleteMany({}),
  ]);

  console.log('[Seed] Seeding users...');
  const docenteHash = await hashPassword('docente123');
  const adminHash = await hashPassword('admin123');

  await User.insertMany([
    { email: 'admin@faceaccess.lab', passwordHash: adminHash, name: 'Nicolás Cevallos', role: 'admin', createdAt: new Date() },
    { email: 'docente@faceaccess.lab', passwordHash: docenteHash, name: 'Ismael González', role: 'docente', createdAt: new Date() },
  ]);

  console.log('[Seed] 1 admin + 1 docente created.');
  console.log('[Seed] Done!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('[Seed] Error:', error);
  process.exit(1);
});
