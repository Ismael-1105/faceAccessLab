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

import { toMinutes, isClassNow, isSessionActive, canAccessLab } from '../../lib/scheduling.ts';

/** Query simulada con cadena .sort/.select que sigue siendo awaitable. */
function query<T>(value: T) {
  const p = Promise.resolve(value);
  const q = Object.assign(p, {
    sort: () => q,
    select: () => q,
  });
  return q;
}

// Miércoles 2026-08-05 08:30.
const WEDNESDAY_0830 = new Date('2026-08-05T08:30:00');
/** Sesión iniciada hace minutos: dentro de la ventana máxima. */
const FRESH_START = new Date('2026-08-05T08:00:00');
/** Sesión que nadie finalizó hace días: fuera de la ventana máxima. */
const STALE_START = new Date('2026-08-01T08:00:00');

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
    // Coherente con status 'en_curso': una sesión recién iniciada.
    sessionStartedAt: FRESH_START,
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

describe('scheduling: isSessionActive', () => {
  it('solo considera vigente una sesión en curso con marca dentro de la ventana', () => {
    expect(isSessionActive({ status: 'en_curso', sessionStartedAt: FRESH_START }, WEDNESDAY_0830)).toBe(true);
    expect(isSessionActive({ status: 'en_curso', sessionStartedAt: STALE_START }, WEDNESDAY_0830)).toBe(false);
    expect(isSessionActive({ status: 'en_curso' }, WEDNESDAY_0830)).toBe(false);
  });

  it('ningún otro estado es vigente, tenga o no marca', () => {
    for (const status of ['programada', 'finalizada', 'cancelada', undefined]) {
      expect(isSessionActive({ status, sessionStartedAt: FRESH_START }, WEDNESDAY_0830)).toBe(false);
    }
  });

  it('no depende del día de la semana ni de la franja horaria', () => {
    // Iniciada a las 08:00 y consultada a las 19:00, once horas después y muy
    // fuera de la franja 08:00-10:00 de la clase: sigue vigente.
    expect(isSessionActive(
      { status: 'en_curso', sessionStartedAt: FRESH_START },
      new Date('2026-08-05T19:00:00'),
    )).toBe(true);
    // A las 21:00, trece horas después, la ventana de doce ya venció.
    expect(isSessionActive(
      { status: 'en_curso', sessionStartedAt: FRESH_START },
      new Date('2026-08-05T21:00:00'),
    )).toBe(false);
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

  // ISS-05: la franja horaria ya no gobierna la autorización. Estas dos pruebas
  // afirmaban lo contrario; ahora cubren la denegación por el motivo correcto,
  // que es el estado de sesión, sin dejar de ejercitar el caso fuera de ventana.
  it('no autoriza fuera de la ventana si la clase no se ha iniciado', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule({
      status: 'programada', sessionStartedAt: undefined,
    })]));
    const result = await canAccessLab('student-1', 'LAB-02', new Date('2026-08-05T07:30:00'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('class-not-started');
  });

  it('no autoriza fuera de la ventana si la clase ya se finalizó', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule({ status: 'finalizada' })]));
    const result = await canAccessLab('student-1', 'LAB-02', new Date('2026-08-05T10:30:00'));
    expect(result.allowed).toBe(false);
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
      // La aserción de denegación faltaba: sin ella el `if` pasa en vacío y la
      // prueba no comprueba nada si el resultado llegara a ser `allowed`.
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.reason).toBe(reason);
    }
  });

  // ISS-05: el caso que motiva el cambio. El estado manda sobre el calendario.
  it('autoriza una clase en curso fuera de su franja y en otro día', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule({
      dayOfWeek: 1,                                        // lunes
      sessionStartedAt: new Date('2026-08-05T15:00:00'),
    })]));
    mocks.enrollmentFind.mockReturnValue(Promise.resolve([
      { scheduleId: 'sched-1', studentId: 'student-1', active: true },
    ]));
    mocks.studentFindOne.mockReturnValue(query(makeStudent()));
    // Miércoles a las 16:00: ni el día ni la hora coinciden con la clase.
    const result = await canAccessLab('student-1', 'LAB-02', new Date('2026-08-05T16:00:00'));
    expect(result.allowed).toBe(true);
  });

  // La contrapartida: quitar el filtro horario no puede dejar la puerta abierta.
  it('deniega una sesión en curso que nadie finalizó, pasada la ventana máxima', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule({ sessionStartedAt: STALE_START })]));
    const result = await canAccessLab('student-1', 'LAB-02', new Date('2026-08-05T16:00:00'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('class-ended');
  });

  it('deniega una clase en curso sin marca de inicio (anterior al campo)', async () => {
    mocks.scheduleFind.mockReturnValue(query([makeSchedule({ sessionStartedAt: undefined })]));
    const result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('class-ended');
  });

  it.each([
    ['programada', 'class-not-started', undefined],
    ['finalizada', 'class-ended', FRESH_START],
    ['cancelada', 'class-cancelled', FRESH_START],
    // "en curso" solo deniega si la marca está caducada: hay que pasarla
    // explícitamente, porque la fixture trae una fresca por defecto.
    ['en_curso', 'class-ended', STALE_START],
  ])('mapea el motivo del estado %s en una clase de otro día', async (status, reason, startedAt) => {
    mocks.scheduleFind.mockReturnValue(query([
      makeSchedule({ status, dayOfWeek: 1, sessionStartedAt: startedAt }),
    ]));
    const result = await canAccessLab('student-1', 'LAB-02', WEDNESDAY_0830);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe(reason);
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
