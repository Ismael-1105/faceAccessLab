import { describe, expect, it } from 'vitest';
import { InvalidJsonError, PayloadTooLargeError, readLimitedJson } from '../lib/request-body.ts';

describe('lectura limitada de solicitudes públicas', () => {
  it('lee JSON dentro del límite', async () => {
    const req = new Request('http://localhost/api/kiosk/verify', {
      method: 'POST',
      body: JSON.stringify({ attemptId: 'kat-1' }),
    });
    await expect(readLimitedJson(req, 100)).resolves.toEqual({ attemptId: 'kat-1' });
  });

  it('rechaza por Content-Length antes de leer el body', async () => {
    const req = new Request('http://localhost/api/kiosk/verify', {
      method: 'POST',
      headers: { 'content-length': '1000' },
      body: '{}',
    });
    await expect(readLimitedJson(req, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('rechaza un stream que supera el límite aunque no declare tamaño', async () => {
    const req = new Request('http://localhost/api/kiosk/verify', {
      method: 'POST',
      body: JSON.stringify({ image: 'x'.repeat(200) }),
    });
    await expect(readLimitedJson(req, 50)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('rechaza JSON malformado', async () => {
    const req = new Request('http://localhost/api/kiosk/verify', {
      method: 'POST',
      body: '{invalid',
    });
    await expect(readLimitedJson(req, 100)).rejects.toBeInstanceOf(InvalidJsonError);
  });
});
