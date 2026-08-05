import { describe, expect, it } from 'vitest';
import { attendanceRecordId, isMongoDuplicateKeyError } from '../lib/attendance-idempotency.ts';

describe('asistencia idempotente del kiosco', () => {
  it('genera el mismo ID para el mismo estudiante, clase y fecha', () => {
    const first = attendanceRecordId('student-1', 'schedule-1', 'Aug 4, 2026');
    const retry = attendanceRecordId('student-1', 'schedule-1', 'Aug 4, 2026');
    expect(retry).toBe(first);
  });

  it('genera IDs distintos al cambiar una dimensión', () => {
    const base = attendanceRecordId('student-1', 'schedule-1', 'Aug 4, 2026');
    expect(attendanceRecordId('student-2', 'schedule-1', 'Aug 4, 2026')).not.toBe(base);
    expect(attendanceRecordId('student-1', 'schedule-2', 'Aug 4, 2026')).not.toBe(base);
    expect(attendanceRecordId('student-1', 'schedule-1', 'Aug 5, 2026')).not.toBe(base);
  });

  it('solo reconoce el código E11000 como colisión idempotente', () => {
    expect(isMongoDuplicateKeyError({ code: 11000 })).toBe(true);
    expect(isMongoDuplicateKeyError({ code: 50 })).toBe(false);
    expect(isMongoDuplicateKeyError(new Error('fallo de red'))).toBe(false);
  });
});
