import { describe, expect, it } from 'vitest';
import { denialEvidencePhotoKey } from '../lib/evidence.ts';

describe('evidencia idempotente del kiosco', () => {
  it('usa una clave S3 estable para el mismo intento', () => {
    const now = new Date('2026-08-04T15:30:00.000Z');
    const first = denialEvidencePhotoKey('kat-123', now);
    const retry = denialEvidencePhotoKey('kat-123', now);

    expect(first).toBe('evidence/2026-08-04/kat-123.jpg');
    expect(retry).toBe(first);
  });

  it('separa la evidencia de intentos diferentes', () => {
    const now = new Date('2026-08-04T15:30:00.000Z');
    expect(denialEvidencePhotoKey('kat-1', now)).not.toBe(denialEvidencePhotoKey('kat-2', now));
  });
});
