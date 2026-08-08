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
