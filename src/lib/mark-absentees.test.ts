import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const models = {
    Enrollment: { find: vi.fn() },
    Attendance: { find: vi.fn(), bulkWrite: vi.fn(), insertMany: vi.fn() },
    Schedule: { findOne: vi.fn() },
  };
  return { models, getExistingStudentIds: vi.fn() };
});

vi.mock('../../lib/models.ts', () => mocks.models);
vi.mock('../../lib/db.ts', () => ({ connectDB: vi.fn().mockResolvedValue({}) }));
vi.mock('../../lib/scheduling.ts', () => ({
  getExistingStudentIds: mocks.getExistingStudentIds,
  getSchedulesForTeacher: vi.fn(),
  getSchedulesForLab: vi.fn(),
  newScheduleId: vi.fn(),
  newEnrollmentId: vi.fn(),
  isClassNow: vi.fn(),
  isSessionActive: vi.fn(),
}));

import { markAbsentees } from '../../lib/handlers.ts';
import { attendanceRecordId } from '../../lib/attendance-idempotency.ts';

const SCHEDULE = 'sched-1';
const INSCRITOS = ['s1', 's2', 's3'];

/** Fecha con el mismo formato que usa markAbsentees. */
function today() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.models.Enrollment.find.mockResolvedValue(
    INSCRITOS.map(id => ({ scheduleId: SCHEDULE, studentId: id, active: true })),
  );
  mocks.getExistingStudentIds.mockImplementation(async (ids: string[]) => ids);
  mocks.models.Schedule.findOne.mockResolvedValue({ subject: 'SO', labCode: 'LAB-02', teacherId: 't1' });
  mocks.models.Attendance.bulkWrite.mockResolvedValue({ upsertedCount: 0 });
});

describe('markAbsentees: idempotencia (ISS-19)', () => {
  it('marca ausentes a los inscritos sin registro de hoy', async () => {
    mocks.models.Attendance.find.mockResolvedValue([
      { studentId: 's1', status: 'presente' },
    ]);
    mocks.models.Attendance.bulkWrite.mockResolvedValue({ upsertedCount: 2 });

    const marcados = await markAbsentees(SCHEDULE);

    expect(marcados).toBe(2);
    const [ops] = mocks.models.Attendance.bulkWrite.mock.calls[0];
    expect(ops.map((o: { updateOne: { filter: { studentId: string } } }) => o.updateOne.filter.studentId))
      .toEqual(['s2', 's3']);
  });

  // El caso del issue: Finalizar, Iniciar, Finalizar no debe duplicar.
  it('no vuelve a marcar a quien ya figura como ausente', async () => {
    mocks.models.Attendance.find.mockResolvedValue([
      { studentId: 's1', status: 'presente' },
      { studentId: 's2', status: 'ausente' },
      { studentId: 's3', status: 'ausente' },
    ]);

    const marcados = await markAbsentees(SCHEDULE);

    // Nadie nuevo: ni siquiera se llega a escribir.
    expect(marcados).toBe(0);
    expect(mocks.models.Attendance.bulkWrite).not.toHaveBeenCalled();
  });

  it('consulta los registros del dia SIN filtrar por status', async () => {
    // Filtrar por 'presente' era la causa raiz: dejaba fuera a los ya ausentes.
    mocks.models.Attendance.find.mockResolvedValue([]);

    await markAbsentees(SCHEDULE);

    expect(mocks.models.Attendance.find).toHaveBeenCalledWith({
      scheduleId: SCHEDULE,
      date: today(),
    });
  });

  it('usa upsert con ID determinista, no insertMany con UUID', async () => {
    mocks.models.Attendance.find.mockResolvedValue([]);
    mocks.models.Attendance.bulkWrite.mockResolvedValue({ upsertedCount: 3 });

    await markAbsentees(SCHEDULE);

    expect(mocks.models.Attendance.insertMany).not.toHaveBeenCalled();
    const [ops] = mocks.models.Attendance.bulkWrite.mock.calls[0];
    for (const op of ops) {
      expect(op.updateOne.upsert).toBe(true);
      // Nada de $set: un registro existente no debe reescribirse.
      expect(op.updateOne.update.$set).toBeUndefined();
      expect(op.updateOne.update.$setOnInsert.id).toBe(
        attendanceRecordId(op.updateOne.filter.studentId, SCHEDULE, today()),
      );
    }
  });

  it('el ID no depende del azar: dos llamadas producen el mismo', async () => {
    mocks.models.Attendance.find.mockResolvedValue([]);
    mocks.models.Attendance.bulkWrite.mockResolvedValue({ upsertedCount: 3 });

    await markAbsentees(SCHEDULE);
    const primera = mocks.models.Attendance.bulkWrite.mock.calls[0][0]
      .map((o: { updateOne: { update: { $setOnInsert: { id: string } } } }) => o.updateOne.update.$setOnInsert.id);

    mocks.models.Attendance.bulkWrite.mockClear();
    await markAbsentees(SCHEDULE);
    const segunda = mocks.models.Attendance.bulkWrite.mock.calls[0][0]
      .map((o: { updateOne: { update: { $setOnInsert: { id: string } } } }) => o.updateOne.update.$setOnInsert.id);

    expect(segunda).toEqual(primera);
  });

  it('cuenta solo las inserciones reales, no los inscritos procesados', async () => {
    mocks.models.Attendance.find.mockResolvedValue([]);
    // Mongo insertó 1 de los 3: los otros dos ya existían.
    mocks.models.Attendance.bulkWrite.mockResolvedValue({ upsertedCount: 1 });

    expect(await markAbsentees(SCHEDULE)).toBe(1);
  });

  it('tolera la colision del indice unico entre finalizaciones simultaneas', async () => {
    mocks.models.Attendance.find.mockResolvedValue([]);
    mocks.models.Attendance.bulkWrite.mockRejectedValue({ code: 11000 });

    // La perdedora de la carrera no propaga el error: el resultado funcional es
    // el mismo, un registro por estudiante.
    expect(await markAbsentees(SCHEDULE)).toBe(0);
  });

  it('propaga cualquier otro error de escritura', async () => {
    mocks.models.Attendance.find.mockResolvedValue([]);
    mocks.models.Attendance.bulkWrite.mockRejectedValue(new Error('sin conexión'));

    await expect(markAbsentees(SCHEDULE)).rejects.toThrow('sin conexión');
  });
});
