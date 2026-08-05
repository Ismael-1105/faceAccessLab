import { describe, expect, it } from 'vitest';
import { alertIdentifierFilter } from '../lib/alerts.ts';
import { Alert } from '../lib/models.ts';

describe('identificadores de alertas', () => {
  it('persiste el ID público en alertas nuevas', () => {
    const alert = new Alert({
      id: 'alert-12345678',
      severity: 'critical',
      source: 'Kiosk',
      message: 'Intentos denegados',
      timestamp: new Date().toISOString(),
      status: 'active',
    });

    expect(alert.toObject().id).toBe('alert-12345678');
  });

  it('busca alertas nuevas por su ID público', () => {
    expect(alertIdentifierFilter('alert-12345678')).toEqual({ id: 'alert-12345678' });
  });

  it('mantiene compatibilidad con el ObjectId de alertas históricas', () => {
    const objectId = '507f1f77bcf86cd799439011';
    expect(alertIdentifierFilter(objectId)).toEqual({
      $or: [{ id: objectId }, { _id: objectId }],
    });
  });
});
