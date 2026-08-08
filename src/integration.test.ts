import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  studentFindOne: vi.fn(),
  studentFindOneAndUpdate: vi.fn(),
  scheduleFind: vi.fn(),
  enrollmentFindOne: vi.fn(),
  enrollmentFind: vi.fn(),
  indexFace: vi.fn(),
  searchFace: vi.fn(),
  uploadImage: vi.fn(),
  recordAudit: vi.fn(),
  createSession: vi.fn(),
  getAttendanceReport: vi.fn(),
  matchesToken: vi.fn(),
  refreshConsent: vi.fn(),
  models: {
    User: { findOne: vi.fn(), findById: vi.fn(), find: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn() },
    Student: { findOne: vi.fn(), find: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn(), deleteMany: vi.fn(), deleteOne: vi.fn() },
    Schedule: { find: vi.fn() },
    Enrollment: { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    AccessLog: { find: vi.fn(), findOneAndUpdate: vi.fn(), deleteMany: vi.fn() },
    Attendance: { find: vi.fn(), findOneAndUpdate: vi.fn(), insertMany: vi.fn(), deleteMany: vi.fn() },
    Incident: { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    DenialEvidence: { find: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn(), countDocuments: vi.fn(), deleteMany: vi.fn() },
    Alert: { create: vi.fn() },
    KioskAttempt: { findOne: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn() },
    Lab: { findOne: vi.fn() },
    Session: { create: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), updateMany: vi.fn() },
    ConsentLog: { create: vi.fn(), find: vi.fn(), deleteMany: vi.fn() },
    RateLimitBucket: { findOneAndUpdate: vi.fn().mockResolvedValue({ count: 1 }) },
  },
}));

vi.mock('../lib/models.ts', () => mocks.models);
vi.mock('../lib/db.ts', () => ({ connectDB: vi.fn().mockResolvedValue({}) }));
vi.mock('../lib/audit.ts', () => ({
  recordAudit: mocks.recordAudit,
  getClientIp: () => '127.0.0.1',
  getUserAgent: () => 'vitest',
  getAuditLogsPage: vi.fn(),
}));
vi.mock('../lib/sessions.ts', () => ({
  createSession: mocks.createSession,
  rotateSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
  generateRefreshToken: () => 'rt-123',
  hashToken: (t: string) => t,
}));
vi.mock('../lib/rekognition.ts', () => ({
  indexFace: mocks.indexFace,
  searchFace: mocks.searchFace,
  deleteFace: vi.fn(),
  ensureCollection: vi.fn(),
}));
vi.mock('../lib/s3.ts', () => ({
  uploadImage: mocks.uploadImage,
  deleteImage: vi.fn(),
  getPresignedUrl: vi.fn().mockResolvedValue('https://signed/url'),
  getS3Bucket: () => 'bucket',
}));
vi.mock('../lib/consent.ts', () => ({
  grantConsent: vi.fn().mockResolvedValue(undefined),
  refreshConsent: mocks.refreshConsent,
  revokeBiometric: vi.fn().mockResolvedValue(undefined),
  deleteStudentData: vi.fn().mockResolvedValue(undefined),
  getConsentHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/reports.ts', () => ({ getAttendanceReport: mocks.getAttendanceReport, getLabDashboard: vi.fn() }));
vi.mock('../lib/kiosk-attempt-auth.ts', () => ({
  matchesKioskAttemptToken: mocks.matchesToken,
  createKioskAttemptToken: () => ({ token: 'tok', tokenHash: 'hash' }),
}));

import { handleLogin } from '../lib/handlers.ts';
import { handleUpdateStudent } from '../lib/handlers.ts';
import { handleRegisterBiometric } from '../lib/handlers.ts';
import { verifyKioskAttempt } from '../lib/kiosk-verification.ts';
import { handleExportAttendanceReport } from '../lib/handlers.ts';
import { hashPassword, generateToken } from '../lib/auth.ts';
import { generateSecret, generateTotp } from '../lib/totp.ts';

function authed(role: 'admin' | 'docente', userId = 'u1') {
  const token = generateToken({ userId, email: 'e@x.com', role });
  return new Request('http://localhost/x', { headers: { Authorization: `Bearer ${token}` } });
}

function jsonReq(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** Query simulada con cadena .select que sigue siendo awaitable. */
function query<T>(value: T) {
  const p = Promise.resolve(value);
  const q = Object.assign(p, { sort: () => q, select: () => q });
  return q;
}

let passwordHash: string;
beforeEach(async () => {
  vi.clearAllMocks();
  passwordHash = await hashPassword('correcta');
  mocks.matchesToken.mockReturnValue(true);
});

describe('login (integración)', () => {
  it('autentica credenciales correctas y emite cookies de sesión', async () => {
    mocks.models.User.findOne.mockResolvedValue({
      _id: 'u1', email: 'admin@x.com', name: 'Admin', role: 'admin',
      passwordHash, mfaEnabled: false, status: 'active',
    });
    const res = await handleLogin(jsonReq('http://localhost/api/auth/login', { email: 'admin@x.com', password: 'correcta' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe('admin');
    const setCookies = res.headers.get('set-cookie') || '';
    expect(setCookies).toContain('refresh_token=');
    expect(setCookies).toContain('HttpOnly');
    expect(setCookies).toContain('SameSite=Strict');
    expect(mocks.createSession).toHaveBeenCalled();
  });

  it('rechaza contraseña incorrecta sin crear sesión', async () => {
    mocks.models.User.findOne.mockResolvedValue({
      _id: 'u1', email: 'a@x.com', role: 'docente', passwordHash, mfaEnabled: false, status: 'active',
    });
    const res = await handleLogin(jsonReq('http://localhost/x', { email: 'a@x.com', password: 'mala' }));
    expect(res.status).toBe(401);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('rechaza cuentas suspendidas', async () => {
    mocks.models.User.findOne.mockResolvedValue({
      _id: 'u1', email: 'a@x.com', role: 'docente', passwordHash, mfaEnabled: false, status: 'suspended',
    });
    const res = await handleLogin(jsonReq('http://localhost/x', { email: 'a@x.com', password: 'correcta' }));
    expect(res.status).toBe(403);
  });

  it('rechaza un cuerpo inválido (Zod)', async () => {
    const res = await handleLogin(jsonReq('http://localhost/x', { email: 'no-email' }));
    expect(res.status).toBe(400);
    expect(mocks.models.User.findOne).not.toHaveBeenCalled();
  });

  // ISS-16: faltar el código y equivocarse no son el mismo caso, y devolvían la
  // misma respuesta. La vista trataba ambos como "pide el código", borraba el
  // error y no mostraba nada. Se usa el TOTP real, no un doble.
  describe('MFA', () => {
    const mfaSecret = generateSecret();

    function mfaUser() {
      return {
        _id: 'u1', email: 'a@x.com', name: 'Ana', role: 'docente',
        passwordHash, mfaEnabled: true, mfaSecret, status: 'active',
      };
    }

    it('pide el código cuando la cuenta tiene MFA y no se envió ninguno', async () => {
      mocks.models.User.findOne.mockResolvedValue(mfaUser());
      const res = await handleLogin(jsonReq('http://localhost/x', { email: 'a@x.com', password: 'correcta' }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mfaRequired).toBe(true);
      expect(body.token).toBeUndefined();
      expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it('devuelve 401 con mensaje propio cuando el código es incorrecto', async () => {
      mocks.models.User.findOne.mockResolvedValue(mfaUser());
      const res = await handleLogin(jsonReq('http://localhost/x', {
        email: 'a@x.com', password: 'correcta', mfaToken: '000000',
      }));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Código de verificación incorrecto o caducado');
      // Lo que rompía la pantalla: un código incorrecto ya NO responde mfaRequired.
      expect(body.mfaRequired).toBeUndefined();
      expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it('autentica cuando el código es correcto', async () => {
      mocks.models.User.findOne.mockResolvedValue(mfaUser());
      const res = await handleLogin(jsonReq('http://localhost/x', {
        email: 'a@x.com', password: 'correcta', mfaToken: generateTotp(mfaSecret),
      }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeTruthy();
      expect(mocks.createSession).toHaveBeenCalled();
    });
  });
});

describe('RBAC sobre estudiantes (integración)', () => {
  it('un docente NO puede modificar un estudiante ajeno (403)', async () => {
    mocks.models.Schedule.find.mockResolvedValue(query([])); // el docente no tiene clases → no es propietario
    const res = await handleUpdateStudent(
      new Request('http://localhost/x', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateToken({ userId: 't1', email: 't@x.com', role: 'docente' })}` },
        body: JSON.stringify({ id: 'student-x', name: 'Hack' }),
      }),
    );
    expect(res.status).toBe(403);
    expect(mocks.models.Student.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('un admin puede modificar cualquier estudiante (200)', async () => {
    mocks.models.Student.findOneAndUpdate.mockResolvedValue({ id: 'student-x', name: 'Ana', status: 'allowed' });
    const res = await handleUpdateStudent(
      new Request('http://localhost/x', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateToken({ userId: 'u1', email: 'a@x.com', role: 'admin' })}` },
        body: JSON.stringify({ id: 'student-x', name: 'Ana' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.models.Student.findOneAndUpdate).toHaveBeenCalled();
  });
});

describe('registro biométrico (integración)', () => {
  it('indexa el rostro, sube la foto y renueva el consentimiento', async () => {
    const student = { id: 'student-1', name: 'Ana', lab: 'LAB-02', biometricStatus: 'pending', save: vi.fn().mockResolvedValue(undefined) };
    mocks.models.Student.findOne.mockResolvedValue(student);
    mocks.indexFace.mockResolvedValue('face-abc');
    mocks.uploadImage.mockResolvedValue('students/student-1.jpg');
    mocks.refreshConsent.mockResolvedValue(undefined);

    const res = await handleRegisterBiometric(jsonReq('http://localhost/x', {
      studentId: 'student-1',
      imageBase64: 'data:image/jpeg;base64,ZmFrZQ==',
    }, { Authorization: `Bearer ${generateToken({ userId: 'u1', email: 'a@x.com', role: 'admin' })}` }));

    expect(res.status).toBe(200);
    expect(mocks.indexFace).toHaveBeenCalled();
    expect(mocks.uploadImage).toHaveBeenCalled();
    expect(student.biometricStatus).toBe('registered');
    expect(mocks.refreshConsent).toHaveBeenCalledWith('student-1', expect.anything(), 'LAB-02');
  });
});

describe('kiosco: intento duplicado (integración)', () => {
  it('reproduce el resultado ya persistido sin re-ejecutar el pipeline', async () => {
    const stored = { attemptId: 'kat-1', allowed: true, reason: null, confidence: 92, student: { id: 's1' }, schedule: { id: 'c1' } };
    mocks.models.KioskAttempt.findOne
      .mockResolvedValueOnce(query({ attemptTokenHash: 'hash' })) // autorización
      .mockResolvedValueOnce(query({ resultPayload: JSON.stringify(stored) })); // ya completado

    const result = await verifyKioskAttempt('kat-1', 'tok', 'data:image/jpeg;base64,ZmFrZQ==');
    expect(result.allowed).toBe(true);
    expect(mocks.models.KioskAttempt.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('exportación de reporte (integración)', () => {
  it('exporta CSV de asistencia con formato y cabeceras', async () => {
    mocks.getAttendanceReport.mockResolvedValue({
      scope: 'admin',
      byClass: [{ subject: 'SO', teacherName: 'Doc', labCode: 'LAB-02', expected: 2, present: 1, absent: 1, attendanceRate: 50 }],
      byStudent: [],
      topDenials: [],
      incidentsByLab: [],
      avgRecognitionMs: 120,
    });
    const req = new Request('http://localhost/api/reports/attendance/export?format=excel', {
      headers: { Authorization: `Bearer ${generateToken({ userId: 'u1', email: 'a@x.com', role: 'admin' })}` },
    });
    const res = await handleExportAttendanceReport(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('Materia,Docente,Lab,Inscritos,Presentes,Ausentes,% Asistencia');
    expect(text).toContain('SO');
  });
});
