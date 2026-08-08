import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const models = {
    KioskAttempt: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn(), create: vi.fn() },
    Student: { findOne: vi.fn() },
    Lab: { findOne: vi.fn() },
    Schedule: { find: vi.fn(), findOne: vi.fn() },
    Enrollment: { find: vi.fn() },
    AccessLog: { findOneAndUpdate: vi.fn() },
    Attendance: { findOneAndUpdate: vi.fn() },
    Alert: { create: vi.fn() },
    DenialEvidence: { create: vi.fn(), findOneAndUpdate: vi.fn(), countDocuments: vi.fn() },
    Incident: { findOne: vi.fn(), create: vi.fn() },
  };
  return {
    models,
    getLivenessResult: vi.fn(),
    searchFace: vi.fn(),
    matchesToken: vi.fn(),
    uploadImage: vi.fn(),
    getPresignedUrl: vi.fn(),
    recordDenialEvidence: vi.fn(),
    publishAlert: vi.fn(),
    metrics: {
      livenessFailed: vi.fn(),
      livenessChecked: vi.fn(),
      livenessLatency: vi.fn(),
      accessGranted: vi.fn(),
      accessDenied: vi.fn(),
      facesSearched: vi.fn(),
      rekognitionLatency: vi.fn(),
      attemptsPerKiosk: vi.fn(),
      deniedPerKiosk: vi.fn(),
      httpError: vi.fn(),
    },
  };
});

vi.mock('../../lib/models.ts', () => mocks.models);
vi.mock('../../lib/db.ts', () => ({ connectDB: vi.fn().mockResolvedValue({}) }));
vi.mock('../../lib/liveness.ts', () => ({ createLivenessSession: vi.fn(), getLivenessResult: mocks.getLivenessResult }));
vi.mock('../../lib/rekognition.ts', () => ({ searchFace: mocks.searchFace, ensureCollection: vi.fn() }));
vi.mock('../../lib/kiosk-attempt-auth.ts', () => ({
  matchesKioskAttemptToken: mocks.matchesToken,
  createKioskAttemptToken: () => ({ token: 'tok', tokenHash: 'hash' }),
}));
vi.mock('../../lib/s3.ts', () => ({
  uploadImage: mocks.uploadImage,
  deleteImage: vi.fn(),
  getPresignedUrl: mocks.getPresignedUrl,
}));
vi.mock('../../lib/evidence.ts', () => ({
  recordDenialEvidence: mocks.recordDenialEvidence,
  denialEvidencePhotoKey: () => 'evidence/2026-08-05/kat-1.jpg',
}));
vi.mock('../../lib/sns.ts', () => ({ publishAlert: mocks.publishAlert }));
vi.mock('../../lib/cloudwatch.ts', () => ({ Metrics: mocks.metrics }));

import { verifyKioskAttempt } from '../../lib/kiosk-verification.ts';

/** Query simulada con .select que sigue siendo awaitable. */
function query<T>(value: T) {
  const p = Promise.resolve(value);
  const q = Object.assign(p, { sort: () => q, select: () => q });
  return q;
}

function makeAttempt() {
  return { id: 'kat-1', livenessSessionId: 'ls-1', labCode: 'LAB-02', kioskId: 'Kiosk-042' };
}

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'student-1',
    name: 'Ana',
    career: 'TIC',
    avatarInitials: 'AN',
    photoKey: 'students/student-1.jpg',
    status: 'allowed',
    matchPercentage: 85,
    biometricStatus: 'registered',
    consentVersion: 'v1',
    consentGrantedAt: new Date('2026-01-01'),
    consentExpiresAt: new Date(Date.now() + 30 * 86400000),
    ...overrides,
  };
}

function makeSchedule() {
  return {
    id: 'sched-1', subject: 'SO', teacherId: 't1', labCode: 'LAB-02',
    dayOfWeek: 3, startTime: '08:00', endTime: '10:00',
    active: true, status: 'en_curso',
    // ISS-05: una sesión en curso solo es vigente si lleva marca de inicio
    // dentro de la ventana máxima. El reloj del describe está en 08:30.
    sessionStartedAt: new Date('2026-08-05T08:00:00'),
    deliveryMode: 'presencial',
    requiresPhysicalAccess: true, activeKiosk: true, createdAt: new Date('2026-01-01'),
  };
}

const IMG = 'data:image/jpeg;base64,ZmFrZQ==';

function setupAttempt() {
  mocks.models.KioskAttempt.findOne
    .mockResolvedValueOnce(query({ attemptTokenHash: 'hash' })) // autorización
    .mockResolvedValueOnce(query(null)); // no completado aún
  mocks.models.KioskAttempt.findOneAndUpdate.mockResolvedValue(makeAttempt());
  mocks.models.KioskAttempt.updateOne.mockResolvedValue({});
  mocks.matchesToken.mockReturnValue(true);
  mocks.models.AccessLog.findOneAndUpdate.mockResolvedValue({ _id: 'log1' });
  mocks.models.Attendance.findOneAndUpdate.mockResolvedValue({ id: 'att-1' });
  mocks.models.Schedule.find.mockResolvedValue(query([makeSchedule()]));
  mocks.models.Schedule.findOne.mockResolvedValue(query({ teacherId: 't1' }));
  mocks.models.Enrollment.find.mockResolvedValue([{ scheduleId: 'sched-1', studentId: 'student-1', active: true }]);
  mocks.models.Lab.findOne.mockResolvedValue({ code: 'LAB-02', active: true });
  mocks.recordDenialEvidence.mockResolvedValue({ incident: { incidentCreated: false } });
  mocks.uploadImage.mockResolvedValue('evidence/key.jpg');
}

describe('kiosco: verificación (cadena de decisión)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fijar el reloj para que canAccessLab evalúe la ventana de clase de forma determinista.
    vi.useFakeTimers().setSystemTime(new Date('2026-08-05T08:30:00'));
  });

  afterEach(() => vi.useRealTimers());

  it('concede acceso cuando liveness, match y permisos son correctos', async () => {
    setupAttempt();
    mocks.getLivenessResult.mockResolvedValue({ status: 'SUCCEEDED', confidence: 90, referenceImageBytes: new Uint8Array([1, 2, 3]) });
    mocks.searchFace.mockResolvedValue({ studentId: 'student-1', confidence: 92, faceId: 'f1', externalImageId: 'student-1' });
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent()));

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);

    expect(result.allowed).toBe(true);
    expect(mocks.models.AccessLog.findOneAndUpdate).toHaveBeenCalled();
    expect(mocks.models.Attendance.findOneAndUpdate).toHaveBeenCalled();
    expect(mocks.uploadImage).not.toHaveBeenCalled(); // no se guarda imagen en accesos exitosos
    expect(mocks.metrics.accessGranted).toHaveBeenCalled();
  });

  it('deniega cuando la prueba de vida falla', async () => {
    setupAttempt();
    mocks.getLivenessResult.mockResolvedValue({ status: 'FAILED', confidence: 10, referenceImageBytes: null });
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent()));

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('liveness-failed');
    expect(mocks.metrics.livenessFailed).toHaveBeenCalled();
  });

  it('deniega cuando el rostro no está en el índice', async () => {
    setupAttempt();
    mocks.getLivenessResult.mockResolvedValue({ status: 'SUCCEEDED', confidence: 90, referenceImageBytes: new Uint8Array([1, 2, 3]) });
    mocks.searchFace.mockResolvedValue({ studentId: null, confidence: 0, faceId: null, externalImageId: null });

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('no-match');
    expect(mocks.uploadImage).toHaveBeenCalled(); // el rechazo guarda evidencia
  });

  it('deniega cuando la cuenta del estudiante está suspendida (permissions)', async () => {
    setupAttempt();
    mocks.getLivenessResult.mockResolvedValue({ status: 'SUCCEEDED', confidence: 90, referenceImageBytes: new Uint8Array([1, 2, 3]) });
    mocks.searchFace.mockResolvedValue({ studentId: 'student-1', confidence: 92, faceId: 'f1', externalImageId: 'student-1' });
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent({ status: 'denied' })));

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('permissions');
  });

  it('deniega cuando no hay clase en curso (motivo de horario)', async () => {
    setupAttempt();
    mocks.getLivenessResult.mockResolvedValue({ status: 'SUCCEEDED', confidence: 90, referenceImageBytes: new Uint8Array([1, 2, 3]) });
    mocks.searchFace.mockResolvedValue({ studentId: 'student-1', confidence: 92, faceId: 'f1', externalImageId: 'student-1' });
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent()));
    mocks.models.Schedule.find.mockResolvedValue(query([])); // sin clase hoy

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('out-of-schedule');
  });

  it('deniega por confianza insuficiente frente al umbral del estudiante', async () => {
    setupAttempt();
    mocks.getLivenessResult.mockResolvedValue({ status: 'SUCCEEDED', confidence: 90, referenceImageBytes: new Uint8Array([1, 2, 3]) });
    mocks.searchFace.mockResolvedValue({ studentId: 'student-1', confidence: 60, faceId: 'f1', externalImageId: 'student-1' });
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent()));

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('low-confidence');
  });

  it('deniega cuando la biometría del estudiante está pendiente', async () => {
    setupAttempt();
    mocks.getLivenessResult.mockResolvedValue({ status: 'SUCCEEDED', confidence: 90, referenceImageBytes: new Uint8Array([1, 2, 3]) });
    mocks.searchFace.mockResolvedValue({ studentId: 'student-1', confidence: 92, faceId: 'f1', externalImageId: 'student-1' });
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent({ biometricStatus: 'pending' })));

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('no-biometric');
  });
});

// ISS-15: el kiosco no tiene sesión y no puede usar /api/photos, así que la foto
// del alumno viaja firmada dentro de la respuesta de verificación.
describe('kiosco: foto firmada del alumno (ISS-15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers().setSystemTime(new Date('2026-08-05T08:30:00'));
  });

  afterEach(() => vi.useRealTimers());

  it('devuelve una URL firmada del photoKey del alumno reconocido', async () => {
    setupAttempt();
    mocks.getPresignedUrl.mockResolvedValue('https://s3.example/firmada-1');
    mocks.getLivenessResult.mockResolvedValue({ status: 'SUCCEEDED', confidence: 90, referenceImageBytes: new Uint8Array([1, 2, 3]) });
    mocks.searchFace.mockResolvedValue({ studentId: 'student-1', confidence: 92, faceId: 'f1', externalImageId: 'student-1' });
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent()));

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);

    expect(result.allowed).toBe(true);
    expect(result.studentPhotoUrl).toBe('https://s3.example/firmada-1');
    expect(mocks.getPresignedUrl).toHaveBeenCalledWith('students/student-1.jpg', 120);
  });

  it('devuelve null si el alumno no tiene foto en S3', async () => {
    setupAttempt();
    mocks.getLivenessResult.mockResolvedValue({ status: 'SUCCEEDED', confidence: 90, referenceImageBytes: new Uint8Array([1, 2, 3]) });
    mocks.searchFace.mockResolvedValue({ studentId: 'student-1', confidence: 92, faceId: 'f1', externalImageId: 'student-1' });
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent({ photoKey: undefined })));

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);

    expect(result.studentPhotoUrl).toBeNull();
    expect(mocks.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('no tumba la verificación si S3 no puede firmar', async () => {
    setupAttempt();
    mocks.getPresignedUrl.mockRejectedValue(new Error('S3 caído'));
    mocks.getLivenessResult.mockResolvedValue({ status: 'SUCCEEDED', confidence: 90, referenceImageBytes: new Uint8Array([1, 2, 3]) });
    mocks.searchFace.mockResolvedValue({ studentId: 'student-1', confidence: 92, faceId: 'f1', externalImageId: 'student-1' });
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent()));

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);

    // El acceso ya estaba decidido: la foto es accesoria.
    expect(result.allowed).toBe(true);
    expect(result.studentPhotoUrl).toBeNull();
  });

  // El punto que el contrato no contemplaba: resultPayload se reproduce tal cual
  // cuando el intento ya se consumió, y una URL firmada guardada llega caducada.
  it('regenera la URL al reproducir un intento ya consumido, sin servir la guardada', async () => {
    const cachedPayload = JSON.stringify({
      attemptId: 'kat-1',
      allowed: true,
      reason: null,
      confidence: 92,
      student: { id: 'student-1', name: 'Ana', career: 'TIC', avatarInitials: 'AN' },
      schedule: { id: 'sched-1', subject: 'SO', startTime: '08:00', endTime: '10:00' },
      studentPhotoUrl: 'https://s3.example/CADUCADA',
    });

    mocks.matchesToken.mockReturnValue(true);
    mocks.models.KioskAttempt.findOne
      .mockResolvedValueOnce(query({ attemptTokenHash: 'hash' }))   // autorización
      .mockResolvedValueOnce(query({ resultPayload: cachedPayload })); // ya consumido
    mocks.models.Student.findOne.mockResolvedValue(query(makeStudent()));
    mocks.getPresignedUrl.mockResolvedValue('https://s3.example/firmada-nueva');

    const result = await verifyKioskAttempt('kat-1', 'tok', IMG);

    expect(result.studentPhotoUrl).toBe('https://s3.example/firmada-nueva');
    expect(result.studentPhotoUrl).not.toBe('https://s3.example/CADUCADA');
    expect(mocks.getPresignedUrl).toHaveBeenCalledWith('students/student-1.jpg', 120);
    // El resto del resultado sí se reproduce del payload guardado.
    expect(result.allowed).toBe(true);
    expect(result.confidence).toBe(92);
  });
});
