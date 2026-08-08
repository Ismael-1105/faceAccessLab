import mongoose from 'mongoose';
import dns from 'dns';
import { Schedule } from './models.ts';
import { Metrics } from './cloudwatch.ts';
import { logger } from './observability.ts';

// ISS-10: por defecto se usa el resolvedor del sistema. Forzar 8.8.8.8 rompía
// en redes institucionales que bloquean o interceptan el DNS saliente hacia
// resolvedores externos, y como mongodb+srv:// necesita resolver registros SRV y
// TXT, la conexión fallaba y TODOS los endpoints devolvían error. Es un fallo
// que no aparece en el equipo de desarrollo y sí en la red de la presentación.
// Solo se sobrescribe si DNS_SERVERS está definida de forma expresa.
const customDns = process.env.DNS_SERVERS;
if (customDns) {
  const servers = customDns.split(',').map(s => s.trim()).filter(Boolean);
  if (servers.length > 0) {
    dns.setServers(servers);
    logger.info('db.dns.override', { servers: servers.join(',') });
  }
}

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
  logger.info('db.connecting');

  try {
    await mongoose.connect(getMongoUri(), {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    logger.info('db.connected');
    await runMigrations();
    return mongoose;
  } catch (error: unknown) {
    void Metrics.mongoFailure('connect');
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('db.connection.failed', { error: msg });
    throw new Error(`MongoDB connection failed: ${msg}`);
  } finally {
    isConnecting = false;
  }
}
