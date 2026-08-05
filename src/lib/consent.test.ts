import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const studentUpdateOne = vi.fn();
  const studentFindOne = vi.fn();
  const studentDeleteOne = vi.fn();
  const consentLogCreate = vi.fn();
  const consentLogFind = vi.fn();
  const consentLogDeleteMany = vi.fn();
  const denialEvidenceFind = vi.fn();
  const denialEvidenceDeleteMany = vi.fn();
  const accessLogDeleteMany = vi.fn();
  const incidentDeleteMany = vi.fn();
  const attendanceDeleteMany = vi.fn();
  const enrollmentDeleteMany = vi.fn();
  const deleteImage = vi.fn();
  const deleteFace = vi.fn();

  return {
    studentUpdateOne,
    studentFindOne,
    studentDeleteOne,
    consentLogCreate,
    consentLogDeleteMany,
    denialEvidenceFind,
    accessLogDeleteMany,
    incidentDeleteMany,
    attendanceDeleteMany,
    enrollmentDeleteMany,
    deleteImage,
    deleteFace,
    models: {
      Student: { updateOne: studentUpdateOne, findOne: studentFindOne, deleteOne: studentDeleteOne },
      ConsentLog: { create: consentLogCreate, find: consentLogFind, deleteMany: consentLogDeleteMany },
      DenialEvidence: { find: denialEvidenceFind, deleteMany: denialEvidenceDeleteMany },
      AccessLog: { deleteMany: accessLogDeleteMany },
      Incident: { deleteMany: incidentDeleteMany },
      Attendance: { deleteMany: attendanceDeleteMany },
      Enrollment: { deleteMany: enrollmentDeleteMany },
    },
  };
});

vi.mock('../../lib/models.ts', () => mocks.models);
vi.mock('../../lib/s3.ts', () => ({ deleteImage: mocks.deleteImage }));
vi.mock('../../lib/rekognition.ts', () => ({ deleteFace: mocks.deleteFace, ensureCollection: vi.fn() }));

import { grantConsent, refreshConsent, revokeBiometric, deleteStudentData } from '../../lib/consent.ts';
import { CONSENT_VERSION } from '../../lib/biometrics.ts';

const actor = { email: 'docente@x.com', role: 'docente' };

describe('consentimiento: otorgar y renovar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consentLogCreate.mockResolvedValue({});
  });

  it('grantConsent registra actor, versión, lab y expiración futura', async () => {
    mocks.studentUpdateOne.mockResolvedValue({});
    await grantConsent('student-1', actor, 'LAB-02');

    const set = mocks.studentUpdateOne.mock.calls[0][1].$set;
    expect(set.consentVersion).toBe(CONSENT_VERSION);
    expect(set.consentGrantedBy).toBe('docente@x.com');
    expect(set.consentLab).toBe('LAB-02');
    expect(set.consentGrantedAt).toBeInstanceOf(Date);
    expect(set.consentExpiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(mocks.consentLogCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'grant', version: CONSENT_VERSION }));
  });

  it('refreshConsent renueva la expiración y conserva el otorgante', async () => {
    mocks.studentFindOne.mockResolvedValue({ consentGrantedBy: 'admin@x.com', consentLab: 'LAB-02' });
    mocks.studentUpdateOne.mockResolvedValue({});
    await refreshConsent('student-1', actor, 'LAB-02');

    const set = mocks.studentUpdateOne.mock.calls[0][1].$set;
    expect(set.consentGrantedBy).toBe('admin@x.com');
    expect(mocks.consentLogCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'refresh' }));
  });
});

describe('consentimiento: revocación y eliminación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consentLogCreate.mockResolvedValue({});
  });

  it('revokeBiometric borra foto, embedding y limpia los campos', async () => {
    const student = { id: 'student-1', photoKey: 'students/s1.jpg', faceEmbeddingId: 'face-1', consentVersion: 'v1', consentLab: 'LAB-02', lab: 'LAB-02' };
    mocks.studentUpdateOne.mockResolvedValue({});

    await revokeBiometric(student as Parameters<typeof revokeBiometric>[0], actor);

    expect(mocks.deleteImage).toHaveBeenCalledWith('students/s1.jpg');
    expect(mocks.deleteFace).toHaveBeenCalledWith('face-1');
    const set = mocks.studentUpdateOne.mock.calls[0][1].$set;
    expect(set.biometricStatus).toBe('pending');
    expect(set.consentRevokedAt).toBeInstanceOf(Date);
    expect(mocks.consentLogCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'revoke' }));
  });

  it('deleteStudentData elimina evidencias, accesos, incidentes, asistencia e inscripciones', async () => {
    mocks.denialEvidenceFind.mockResolvedValue([
      { photoKey: 'evidence/2026-08-05/e1.jpg' },
      { photoKey: 'evidence/2026-08-05/e2.jpg' },
    ]);
    const student = { id: 'student-1', photoKey: 'students/s1.jpg', faceEmbeddingId: 'face-1' };

    await deleteStudentData(student as Parameters<typeof deleteStudentData>[0]);

    expect(mocks.denialEvidenceFind).toHaveBeenCalledWith({ studentId: 'student-1' });
    expect(mocks.deleteImage).toHaveBeenCalledTimes(3); // 2 evidencias + foto
    expect(mocks.deleteFace).toHaveBeenCalledWith('face-1');
    expect(mocks.accessLogDeleteMany).toHaveBeenCalledWith({ studentId: 'student-1' });
    expect(mocks.incidentDeleteMany).toHaveBeenCalledWith({ studentId: 'student-1' });
    expect(mocks.attendanceDeleteMany).toHaveBeenCalledWith({ studentId: 'student-1' });
    expect(mocks.enrollmentDeleteMany).toHaveBeenCalledWith({ studentId: 'student-1' });
    expect(mocks.consentLogDeleteMany).toHaveBeenCalledWith({ studentId: 'student-1' });
    expect(mocks.studentDeleteOne).toHaveBeenCalledWith({ id: 'student-1' });
  });
});
