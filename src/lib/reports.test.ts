import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const models = {
    Schedule: { find: vi.fn() },
    Enrollment: { find: vi.fn() },
    Attendance: { find: vi.fn() },
    AccessLog: { find: vi.fn(), aggregate: vi.fn() },
    Incident: { find: vi.fn() },
    User: { find: vi.fn() },
    DenialEvidence: { find: vi.fn() },
  };
  return {
    models,
    getSchedulesForTeacher: vi.fn(),
    getSchedulesForLab: vi.fn(),
    getExistingStudentIds: vi.fn(),
  };
});

vi.mock('../../lib/models.ts', () => mocks.models);
vi.mock('../../lib/scheduling.ts', () => ({
  getSchedulesForTeacher: mocks.getSchedulesForTeacher,
  getSchedulesForLab: mocks.getSchedulesForLab,
  getExistingStudentIds: mocks.getExistingStudentIds,
}));

import { getAttendanceReport, getLabAttendanceReport } from '../../lib/reports.ts';

/** Query simulada con cadena .select/.sort que sigue siendo awaitable. */
function query<T>(value: T) {
  const p = Promise.resolve(value);
  const q = Object.assign(p, { sort: () => q, select: () => q });
  return q;
}

function schedule(id: string, teacherId: string) {
  return { id, subject: `Materia ${id}`, labCode: 'LAB-02', teacherId };
}

/** Un registro de asistencia. La fecha define a qué sesión pertenece. */
function att(studentId: string, date: string, status: 'presente' | 'ausente' = 'presente') {
  return { studentId, scheduleId: 'c1', date, status };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Por defecto, nada que agregar: cada prueba rellena lo que le interesa.
  mocks.models.Enrollment.find.mockResolvedValue([]);
  mocks.models.Attendance.find.mockResolvedValue([]);
  mocks.models.AccessLog.find.mockReturnValue(query([]));
  mocks.models.AccessLog.aggregate.mockResolvedValue([]);
  mocks.models.Incident.find.mockResolvedValue([]);
  mocks.models.User.find.mockResolvedValue([]);
  mocks.getExistingStudentIds.mockImplementation(async (ids: string[]) => ids);
});

describe('reportes: aislamiento entre docentes (ISS-17)', () => {
  it('un docente sin clases recibe un reporte vacío, no el de la institución', async () => {
    mocks.getSchedulesForTeacher.mockResolvedValue([]);   // el docente no tiene clases
    // Si el filtro fallara, esta consulta global devolvería clases ajenas.
    mocks.models.Schedule.find.mockResolvedValue([schedule('ajena-1', 'otro-docente')]);

    const report = await getAttendanceReport('docente-sin-clases');

    expect(report.byClass).toEqual([]);
    expect(report.byStudent).toEqual([]);
    expect(report.topDenials).toEqual([]);
    expect(report.scope).toBe('docente');
    // La prueba de fondo: con lista vacía no se consulta la colección entera.
    expect(mocks.models.Schedule.find).not.toHaveBeenCalled();
  });

  it('un docente con clases recibe solo las suyas', async () => {
    mocks.getSchedulesForTeacher.mockResolvedValue([{ id: 'c1' }]);
    mocks.models.Schedule.find.mockResolvedValue([schedule('c1', 'docente-1')]);

    const report = await getAttendanceReport('docente-1');

    expect(mocks.models.Schedule.find).toHaveBeenCalledWith({ id: { $in: ['c1'] } });
    expect(report.byClass).toHaveLength(1);
    expect(report.scope).toBe('docente');
  });

  it('el administrador sigue viendo todo, sin filtro', async () => {
    mocks.models.Schedule.find.mockResolvedValue([
      schedule('c1', 'docente-1'),
      schedule('c2', 'docente-2'),
    ]);

    const report = await getAttendanceReport();

    // Sin argumentos: consulta global, que es el comportamiento correcto aquí.
    expect(mocks.models.Schedule.find).toHaveBeenCalledWith();
    expect(report.byClass).toHaveLength(2);
    expect(report.scope).toBe('all');
  });

  it('un laboratorio sin horarios da un reporte vacío, no el global', async () => {
    mocks.getSchedulesForLab.mockResolvedValue([]);
    mocks.models.Schedule.find.mockResolvedValue([schedule('ajena-1', 'otro')]);

    const report = await getLabAttendanceReport('LAB-99');

    expect(report.byClass).toEqual([]);
    expect(mocks.models.Schedule.find).not.toHaveBeenCalled();
  });
});

describe('reportes: porcentaje por clase normalizado (ISS-18)', () => {
  /** 4 inscritos, 3 sesiones, asistencia completa: el caso del informe. */
  function tresSesionesCompletas() {
    mocks.getSchedulesForTeacher.mockResolvedValue([{ id: 'c1' }]);
    mocks.models.Schedule.find.mockResolvedValue([schedule('c1', 'docente-1')]);
    mocks.models.Enrollment.find.mockResolvedValue(
      ['s1', 's2', 's3', 's4'].map(id => ({ scheduleId: 'c1', studentId: id, active: true })),
    );
    mocks.models.Attendance.find.mockResolvedValue(
      ['Aug 3, 2026', 'Aug 4, 2026', 'Aug 5, 2026']
        .flatMap(date => ['s1', 's2', 's3', 's4'].map(id => att(id, date))),
    );
  }

  it('no supera el 100 por ciento con varias sesiones', async () => {
    tresSesionesCompletas();

    const [fila] = (await getAttendanceReport('docente-1')).byClass;

    // Antes: present 12 sobre expected 4 daba 300 por ciento.
    expect(fila.present).toBe(12);
    expect(fila.expected).toBe(12);
    expect(fila.attendanceRate).toBe(100);
    expect(fila.attendanceRate).toBeLessThanOrEqual(100);
  });

  it('present y absent suman expected', async () => {
    mocks.getSchedulesForTeacher.mockResolvedValue([{ id: 'c1' }]);
    mocks.models.Schedule.find.mockResolvedValue([schedule('c1', 'docente-1')]);
    mocks.models.Enrollment.find.mockResolvedValue(
      ['s1', 's2'].map(id => ({ scheduleId: 'c1', studentId: id, active: true })),
    );
    // Dos sesiones: en la primera vienen los dos, en la segunda solo uno.
    mocks.models.Attendance.find.mockResolvedValue([
      att('s1', 'Aug 4, 2026'), att('s2', 'Aug 4, 2026'),
      att('s1', 'Aug 5, 2026'), att('s2', 'Aug 5, 2026', 'ausente'),
    ]);

    const [fila] = (await getAttendanceReport('docente-1')).byClass;

    expect(fila.expected).toBe(4);            // 2 inscritos x 2 sesiones
    expect(fila.present).toBe(3);
    expect(fila.absent).toBe(1);
    expect(fila.present + fila.absent).toBe(fila.expected);
    expect(fila.attendanceRate).toBe(75);
  });

  it('una clase sin ninguna asistencia registrada no divide por cero', async () => {
    mocks.getSchedulesForTeacher.mockResolvedValue([{ id: 'c1' }]);
    mocks.models.Schedule.find.mockResolvedValue([schedule('c1', 'docente-1')]);
    mocks.models.Enrollment.find.mockResolvedValue([{ scheduleId: 'c1', studentId: 's1', active: true }]);

    const [fila] = (await getAttendanceReport('docente-1')).byClass;

    // Sin registros, sessions cae a 1: el aforo de una sesión.
    expect(fila.expected).toBe(1);
    expect(fila.present).toBe(0);
    expect(fila.absent).toBe(1);
    expect(fila.attendanceRate).toBe(0);
  });

  it('coincide con el porcentaje que ya calculaba byStudent', async () => {
    tresSesionesCompletas();

    const report = await getAttendanceReport('docente-1');
    const [fila] = report.byClass;

    // Las dos tablas del mismo reporte dejan de contradecirse.
    for (const alumno of report.byStudent) {
      expect(alumno.attendanceRate).toBe(fila.attendanceRate);
    }
  });
});
