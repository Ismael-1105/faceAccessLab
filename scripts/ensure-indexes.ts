import { config } from 'dotenv';
config();

import { connectDB } from '../lib/db.ts';
import { AccessLog, Alert, Student, Lab } from '../lib/models.ts';
import mongoose from 'mongoose';

async function ensureIndexes() {
  await connectDB();

  console.log('[Indexes] Garantizando índices...');

  await Student.collection.createIndex({ id: 1 }, { unique: true });
  await Student.collection.createIndex({ career: 1 });

  await AccessLog.collection.createIndex({ studentId: 1, createdAt: -1 });
  await AccessLog.collection.createIndex({ createdAt: -1 });
  await AccessLog.collection.createIndex({ result: 1, createdAt: -1 });
  await AccessLog.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

  await Alert.collection.createIndex({ status: 1, createdAt: -1 });

  await Lab.collection.createIndex({ code: 1 }, { unique: true });
  await Lab.collection.createIndex({ active: 1 });

  console.log('[Indexes] Índices verificados/creados.');
  await mongoose.disconnect();
  console.log('[Indexes] Done');
}

ensureIndexes().catch(e => { console.error('[Indexes] Error:', e); process.exit(1); });
