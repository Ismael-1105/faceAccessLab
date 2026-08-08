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

/**
 * Conexión en curso, compartida por todas las peticiones que lleguen mientras
 * se establece. Se anula en el `catch` para que un fallo transitorio no deje la
 * aplicación permanentemente rota: el siguiente `connectDB` vuelve a intentarlo.
 */
let connectionPromise: Promise<typeof mongoose> | null = null;
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

  // ISS-11: antes, las peticiones que llegaban durante una conexión en curso
  // entraban en un bucle que sondeaba readyState cada 100 ms y solo terminaba si
  // la conexión llegaba a establecerse. Si el primer intento fallaba, esas
  // peticiones no respondían nunca, ni con éxito ni con error: en pantalla se
  // veía un "Cargando..." indefinido, indistinguible de una aplicación colgada.
  //
  // Con una promesa compartida, el fallo se propaga a todos los que esperan y
  // cada uno responde con su error. runMigrations queda encadenado dentro, así
  // que sigue corriendo una sola vez y solo tras una conexión con éxito.
  if (!connectionPromise) {
    logger.info('db.connecting');
    connectionPromise = mongoose
      .connect(getMongoUri(), {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
      })
      .then(async (m) => {
        logger.info('db.connected');
        await runMigrations();
        return m;
      })
      .catch((error: unknown) => {
        // Se anula para que el siguiente intento pueda reconectar. Sin esto, un
        // fallo transitorio dejaría la aplicación rota hasta reiniciarla.
        connectionPromise = null;
        void Metrics.mongoFailure('connect');
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('db.connection.failed', { error: msg });
        throw new Error(`MongoDB connection failed: ${msg}`);
      });
  }

  return connectionPromise;
}
