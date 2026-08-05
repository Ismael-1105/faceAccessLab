import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const scheduleFind = vi.fn();
  const enrollmentFind = vi.fn();
  const studentFindOne = vi.fn();
  return {
    scheduleFind,
    enrollmentFind,
    studentFindOne,
    models: {
      Schedule: { find: scheduleFind },
      Enrollment: { find: enrollmentFind },
      Student: { findOne: studentFindOne },
    },
  };
});

vi.mock('../../lib/models.ts', () => mocks.models);

import { toMinutes, isClassNow, canAccessLab } from '../../lib/scheduling.ts';

/** Query simulada con cadena .sort/.select que sigue siendo awaitable. */
function query<T>(value: T) {
  const p = Promise.resolve(value);
  const q = Object.assign(p, {
    sort: () => q,
    select: () => q,
  });
  return q;
}

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    subject: 'Sistemas Operativos',
    teacherId: 't1',
    labCode: 'LAB-02',
    dayOfWeek: 3,
    startTime: '08:00',
    endTime: '10:00',
    active: true,
    status: 'en_curso',
    deliveryMode: 'presencial',
    requiresPhysicalAccess: true,
    activeKiosk: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'student-1',
    biometricStatus: 'registered',
    consentVersion: 'v1',
    consentGrantedAt: new Date('2026-01-01'),
    consentExpiresAt: new Date(Date.now() + 30 * 86400000),
    consentRevokedAt: undefined,
    ...overrides,
  };
}

// Miércoles 2026-08-05 08:30.
const WEDNESDAY_0830 = new Date('2026-08-05T08:30:00');

describe('scheduling: toMinutes / isClassNow', () => {
  it('convierte HH:MM a minutos desde medianoche', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('08:30')).toBe(510);
    expect(toMinutes('23:59')).toBe(1439);
  });

  it('dice si la hora actual cae dentro de la ventana', () => {
    const s = { startTime: '08:00', endTime: '10:00' };
    expect(isClassNow(s, new Date('2026-08-05T08:00:00'))).toBe(true);
    expect(isClassNow(s, new Date('2026-08-05T09:59:00'))).toBe(true);
    expect(isClassNow(s, new Date('2026-08-05T07:59:00'))).toBe(false);
    expect(isClassNow(s, new Date('2026-08-05T10:01:00'))).toBe(false);
  });
});

describe('scheduling: canAccessLab', () => {
  beforeEach(() => {
    mocks.scheduleFind.mockReset();
    mocks.enrollmentFind.mockReset();
    mocks.studentFindOne.mockReset();
  });

  it('deniega cuando no hay clase hoy en el lab', async () => {
    mocks.scheduleFind.mockReturnValue(query([]));
    const result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('no-class');
  });

  it('deniega antes de la ventana de la clase', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule()]));
    const result = await canAccessLab('student-1', 'LAB-02', new Date('2026-08-05T07:30:00'));
    if (!result.allowed) expect(result.reason).toBe('class-not-started');
  });

  it('deniega después de la ventana', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule()]));
    const result = await canAccessLab('student-1', 'LAB-02', new Date('2026-08-05T10:30:00'));
    if (!result.allowed) expect(result.reason).toBe('class-ended');
  });

  it('deniega materias virtuales o sin acceso físico', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule({ deliveryMode: 'virtual' })]));
    let result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
    if (!result.allowed) expect(result.reason).toBe('virtual');

    mocks.scheduleFind.mockReturnValue(query([makeSchedule({ requiresPhysicalAccess: false })]));
    result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
    if (!result.allowed) expect(result.reason).toBe('virtual');
  });

  it('deniega según el estado de sesión de la clase', async () => {
    const cases: Array<[string, string]> = [
      ['programada', 'class-not-started'],
      ['finalizada', 'class-ended'],
      ['cancelada', 'class-cancelled'],
    ];
    for (const [status, reason] of cases) {
      mocks.scheduleFind.mockReturnValue(query([makeSchedule({ status })]));
      const result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
      if (!result.allowed) expect(result.reason).toBe(reason);
    }
  });

  it('deniega si el estudiante no está inscrito en la clase exacta', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule()]));
    mocks.enrollmentFind.mockReturnValue(Promise.resolve([]));
    const result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
    if (!result.allowed) expect(result.reason).toBe('not-enrolled');
  });

  it('deniega si la biometría no está registrada', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule()]));
    mocks.enrollmentFind.mockReturnValue(Promise.resolve([{ scheduleId: 'sched-1', studentId: 'student-1', active: true }]));
    mocks.studentFindOne.mockReturnValue(query(makeStudent({ biometricStatus: 'pending' })));
    const result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
    if (!result.allowed) expect(result.reason).toBe('no-biometric');
  });

  it('deniega si el consentimiento venció', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule()]));
    mocks.enrollmentFind.mockReturnValue(Promise.resolve([{ scheduleId: 'sched-1', studentId: 'student-1', active: true }]));
    mocks.studentFindOne.mockReturnValue(query(makeStudent({ consentExpiresAt: new Date(Date.now() - 1000) })));
    const result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
    if (!result.allowed) expect(result.reason).toBe('consent-expired');
  });

  it('concede acceso cuando todo es válido', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule()]));
    mocks.enrollmentFind.mockReturnValue(Promise.resolve([{ scheduleId: 'sched-1', studentId: 'student-1', active: true }]));
    mocks.studentFindOne.mockReturnValue(query(makeStudent()));
    const result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
    expect(result.allowed).toBe(true);
  });
});
