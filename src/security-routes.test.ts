import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/rekognition.ts', () => ({
  ensureCollection: vi.fn(),
}));

import { POST as createLog } from '../app/api/logs/route.ts';
import { POST as createAttendance } from '../app/api/attendance/route.ts';
import { POST as createEvidence } from '../app/api/evidence/route.ts';
import { POST as authorize } from '../app/api/authorize/route.ts';
import { POST as compare } from '../app/api/rekognition/compare/route.ts';
import {
  GET as readLiveness,
  POST as createLiveness,
} from '../app/api/rekognition/liveness/route.ts';
import { POST as initRekognition } from '../app/api/rekognition/init/route.ts';

function post(url: string) {
  return new Request(url, { method: 'POST' });
}

describe('rutas críticas retiradas', () => {
  it.each([
    ['logs', () => createLog(post('http://localhost/api/logs'))],
    ['attendance', () => createAttendance(post('http://localhost/api/attendance'))],
    ['evidence', () => createEvidence(post('http://localhost/api/evidence'))],
    ['authorize', () => authorize(post('http://localhost/api/authorize'))],
    ['compare', () => compare(post('http://localhost/api/rekognition/compare'))],
    ['liveness POST', () => createLiveness(post('http://localhost/api/rekognition/liveness'))],
    ['liveness GET', () => readLiveness(new Request('http://localhost/api/rekognition/liveness'))],
  ])('%s no acepta el flujo legado', async (_name, call) => {
    const response = await call();
    expect(response.status).toBe(410);
  });
});

describe('operaciones AWS administrativas', () => {
  it('rechaza inicializar Rekognition sin sesión admin', async () => {
    const response = await initRekognition(post('http://localhost/api/rekognition/init'));
    expect(response.status).toBe(401);
  });
});
