import { createHash } from 'crypto';

/** Una sola asistencia por estudiante, clase y fecha, incluso entre instancias. */
export function attendanceRecordId(studentId: string, scheduleId: string, date: string): string {
  const digest = createHash('sha256')
    .update(`${studentId}\u0000${scheduleId}\u0000${date}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
  return `att-${digest}`;
}

export function isMongoDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 11000;
}
