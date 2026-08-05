import mongoose from 'mongoose';
import dns from 'dns';
import { Schedule } from './models.ts';

dns.setServers(['8.8.8.8', '8.8.4.4']);

let isConnecting = false;
let ranMigrations = false;

/**
 * Migración idempotente (A3): normaliza el estado de sesión de todas las
 * clases. Las clases legacy sin `status` pasan a `programada`, de modo que
 * solo `en_curso` habilita acceso en el kiosco.
 */
async function runMigrations(): Promise<void> {
  if (ranMigrations) return;
  ranMigrations = true;
  try {
    const res = await Schedule.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'programada' } },
    );
    if (res.modifiedCount > 0) {
      console.log(`[DB] Backfill Schedule.status → programada: ${res.modifiedCount} documento(s)`);
    }
  } catch (error) {
    console.error('[DB] Backfill Schedule.status falló:', error);
  }
}

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no está definida en las variables de entorno');
  }
  return uri;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (isConnecting) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (mongoose.connection.readyState === 1) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
    return mongoose;
  }

  isConnecting = true;
  console.log('[DB] Connecting to MongoDB...');

  try {
    await mongoose.connect(getMongoUri(), {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    console.log('[DB] MongoDB connected');
    await runMigrations();
    return mongoose;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[DB] Connection failed:', msg);
    throw new Error(`MongoDB connection failed: ${msg}`);
  } finally {
    isConnecting = false;
  }
}
