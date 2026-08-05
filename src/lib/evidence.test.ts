import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const create = vi.fn();
  const countDocuments = vi.fn();
  const findOneAndUpdate = vi.fn();
  const incidentFindOne = vi.fn();
  const incidentCreate = vi.fn();
  return {
    create,
    countDocuments,
    findOneAndUpdate,
    incidentFindOne,
    incidentCreate,
    models: {
      DenialEvidence: { create, countDocuments, findOneAndUpdate },
      Incident: { findOne: incidentFindOne, create: incidentCreate },
    },
  };
});

vi.mock('../../lib/models.ts', () => mocks.models);

import { recordDenialEvidence } from '../../lib/evidence.ts';

const baseInput = {
  photoKey: 'evidence/2026-08-05/kat-1.jpg',
  reason: 'no-match',
  confidence: 41,
  date: 'Aug 5, 2026',
  time: '10:00:00',
  labCode: 'LAB-02',
  kioskId: 'Kiosk-042',
  studentId: 'student-1',
};

describe('evidence: clasificación de incidentes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockImplementation((data) => Promise.resolve(data));
  });

  it('no crea incidente por debajo del umbral', async () => {
    mocks.countDocuments.mockResolvedValue(4); // threshold = 5
    const { incident } = await recordDenialEvidence(baseInput);
    expect(incident.incidentCreated).toBe(false);
    expect(mocks.incidentCreate).not.toHaveBeenCalled();
  });

  it('crea incidente al alcanzar el umbral de rechazos en la ventana', async () => {
    mocks.countDocuments.mockResolvedValue(5);
    mocks.incidentFindOne.mockResolvedValue(null);
    mocks.incidentCreate.mockImplementation((data) => Promise.resolve(data));

    const { incident } = await recordDenialEvidence(baseInput);
    expect(incident.incidentCreated).toBe(true);
    expect(incident.incidentId).toMatch(/^inc-/);
    expect(mocks.incidentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'repeated_denials', status: 'open', studentId: 'student-1', count: 5 }),
    );
  });

  it('actualiza un incidente abierto existente en lugar de duplicarlo', async () => {
    mocks.countDocuments.mockResolvedValue(7);
    const open = {
      id: 'inc-9',
      count: 6,
      evidenceIds: ['ev-old'],
      save: vi.fn().mockResolvedValue(undefined),
    };
    mocks.incidentFindOne.mockResolvedValue(open);

    const { incident } = await recordDenialEvidence(baseInput);
    expect(incident.incidentCreated).toBe(false);
    expect(incident.incidentId).toBe('inc-9');
    expect(open.count).toBe(7);
    expect(open.evidenceIds).toHaveLength(2);
    expect(open.evidenceIds[1]).toMatch(/^ev-/);
    expect(open.save).toHaveBeenCalled();
    expect(mocks.incidentCreate).not.toHaveBeenCalled();
  });

  it('agrupa por kiosco cuando no hay estudiante identificado', async () => {
    mocks.countDocuments.mockResolvedValue(5);
    mocks.incidentFindOne.mockResolvedValue(null);
    mocks.incidentCreate.mockImplementation((data) => Promise.resolve({ id: 'inc-2', ...data }));

    const { incident } = await recordDenialEvidence({ ...baseInput, studentId: undefined });
    expect(incident.incidentCreated).toBe(true);
    expect(mocks.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ kioskId: 'Kiosk-042' }),
    );
  });
});
