import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  setServers: vi.fn(),
  updateMany: vi.fn(),
  connection: { readyState: 0 },
}));

vi.mock('mongoose', () => ({
  default: { connect: mocks.connect, connection: mocks.connection },
}));
vi.mock('dns', () => ({ default: { setServers: mocks.setServers } }));
vi.mock('../../lib/models.ts', () => ({ Schedule: { updateMany: mocks.updateMany } }));
vi.mock('../../lib/cloudwatch.ts', () => ({ Metrics: { mongoFailure: vi.fn() } }));
vi.mock('../../lib/observability.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * lib/db.ts guarda estado en variables de módulo (la promesa compartida y el
 * indicador de migraciones), así que cada prueba necesita una copia limpia.
 */
async function freshConnectDB() {
  vi.resetModules();
  return (await import('../../lib/db.ts')).connectDB;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connection.readyState = 0;
  mocks.updateMany.mockResolvedValue({ modifiedCount: 0 });
  delete process.env.DNS_SERVERS;
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
});

describe('connectDB: promesa compartida (ISS-11)', () => {
  it('una sola conexion para varias peticiones simultaneas', async () => {
    const connectDB = await freshConnectDB();
    mocks.connect.mockResolvedValue({ ok: true });

    await Promise.all([connectDB(), connectDB(), connectDB()]);

    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  // El defecto que corrige el issue: antes estas peticiones se quedaban
  // sondeando cada 100 ms para siempre, sin responder ni con exito ni con error.
  it('propaga el fallo a TODAS las peticiones en espera', async () => {
    const connectDB = await freshConnectDB();
    mocks.connect.mockRejectedValue(new Error('SRV no resuelve'));

    const results = await Promise.allSettled([connectDB(), connectDB(), connectDB()]);

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason.message).toContain('MongoDB connection failed');
      expect((r as PromiseRejectedResult).reason.message).toContain('SRV no resuelve');
    }
  });

  it('un fallo transitorio no deja la aplicacion rota: el siguiente intento reconecta', async () => {
    const connectDB = await freshConnectDB();
    mocks.connect.mockRejectedValueOnce(new Error('red caida'));

    await expect(connectDB()).rejects.toThrow('MongoDB connection failed');

    // La promesa se anuló en el catch, así que este intento vuelve a conectar.
    mocks.connect.mockResolvedValue({ ok: true });
    await expect(connectDB()).resolves.toBeDefined();
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });

  it('no reconecta si ya hay conexion establecida', async () => {
    const connectDB = await freshConnectDB();
    mocks.connection.readyState = 1;

    await connectDB();

    expect(mocks.connect).not.toHaveBeenCalled();
  });
});

describe('connectDB: migraciones (ISS-11)', () => {
  it('runMigrations corre una sola vez pese a varias peticiones', async () => {
    const connectDB = await freshConnectDB();
    mocks.connect.mockResolvedValue({ ok: true });

    await Promise.all([connectDB(), connectDB()]);
    await connectDB();

    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
  });

  it('no corre migraciones si la conexion fallo', async () => {
    const connectDB = await freshConnectDB();
    mocks.connect.mockRejectedValue(new Error('sin red'));

    await expect(connectDB()).rejects.toThrow();

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe('connectDB: resolucion DNS (ISS-10)', () => {
  it('no toca el resolvedor del sistema por defecto', async () => {
    await freshConnectDB();

    expect(mocks.setServers).not.toHaveBeenCalled();
  });

  it('solo sobrescribe si DNS_SERVERS esta definida', async () => {
    process.env.DNS_SERVERS = '1.1.1.1, 8.8.8.8';
    await freshConnectDB();

    expect(mocks.setServers).toHaveBeenCalledWith(['1.1.1.1', '8.8.8.8']);
  });

  it('ignora un DNS_SERVERS vacio en lugar de dejar la lista a cero', async () => {
    process.env.DNS_SERVERS = '  , ,';
    await freshConnectDB();

    expect(mocks.setServers).not.toHaveBeenCalled();
  });
});
