import { config } from 'dotenv';
config();

import { connectDB } from '../lib/db.ts';
import { AccessLog, Alert, Student, Lab, Schedule, Enrollment, DenialEvidence, Incident, Attendance, AcademicTerm } from '../lib/models.ts';
import mongoose from 'mongoose';

async function ensureIndexes() {
  await connectDB();

  console.log('[Indexes] Garantizando índices...');

  await Student.collection.createIndex({ id: 1 }, { unique: true });
  await Student.collection.createIndex({ career: 1 });
  await Student.collection.createIndex({ biometricStatus: 1 });

  await AccessLog.collection.createIndex({ studentId: 1, createdAt: -1 });
  await AccessLog.collection.createIndex({ createdAt: -1 });
  await AccessLog.collection.createIndex({ result: 1, createdAt: -1 });
  await AccessLog.collection.createIndex({ scheduleId: 1 });
  await AccessLog.collection.createIndex({ recognitionMs: 1 });
  await AccessLog.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

  await Alert.collection.createIndex({ status: 1, createdAt: -1 });

  await Lab.collection.createIndex({ code: 1 }, { unique: true });
  await Lab.collection.createIndex({ active: 1 });

  await Schedule.collection.createIndex({ labCode: 1, dayOfWeek: 1, startTime: 1 });
  await Schedule.collection.createIndex({ teacherId: 1 });
  await Schedule.collection.createIndex({ academicTerm: 1 });
  await Schedule.collection.createIndex({ activeKiosk: 1 });

  await AcademicTerm.collection.createIndex({ code: 1 }, { unique: true });

  await Enrollment.collection.createIndex({ studentId: 1, scheduleId: 1 }, { unique: true });

  await DenialEvidence.collection.createIndex({ kioskId: 1, createdAt: -1 });
  await DenialEvidence.collection.createIndex({ studentId: 1, createdAt: -1 });
  await DenialEvidence.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

  await Incident.collection.createIndex({ status: 1, createdAt: -1 });
  await Incident.collection.createIndex({ kioskId: 1, status: 1 });

  await Attendance.collection.createIndex({ scheduleId: 1, date: -1 });
  await Attendance.collection.createIndex({ studentId: 1, date: -1 });
  await Attendance.collection.createIndex({ teacherId: 1, date: -1 });
  // ISS-19. Falla si la colección ya tiene duplicados: comprobarlo antes con
  // `npx tsx scripts/check-attendance-duplicates.ts`, que es de solo lectura.
  await Attendance.collection.createIndex({ studentId: 1, scheduleId: 1, date: 1 }, { unique: true });

  console.log('[Indexes] Índices verificados/creados.');
  await mongoose.disconnect();
  console.log('[Indexes] Done');
}

ensureIndexes().catch(e => { console.error('[Indexes] Error:', e); process.exit(1); });
