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
