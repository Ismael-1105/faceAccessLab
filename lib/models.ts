import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'docente' | 'estudiante';
  studentId?: string;
  /** Lab o aula asignado al docente (LAB-02, AULA-B4, VIRTUAL, ...). */
  labCode?: string;
  /** Estado de la cuenta: activa, inactiva o suspendida. */
  status: 'active' | 'inactive' | 'suspended';
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaVerifiedAt?: Date;
  createdAt: Date;
}

export interface IStudent extends Document {
  id: string;
  name: string;
  lastName?: string;
  documentId?: string;
  email?: string;
  phone?: string;
  career: string;
  lab: string;
  labs?: string[];
  photoUrl: string;
  photoKey?: string;
  matchPercentage: number;
  status: 'allowed' | 'denied';
  avatarInitials: string;
  faceEmbeddingId?: string;
  /** Estado del registro biométrico: pendiente hasta que el docente lo capture. */
  biometricStatus: 'pending' | 'registered';
  /** Última captura facial (foto + embedding) registrada con éxito. */
  biometricUpdatedAt?: Date;
  // ── Consentimiento biométrico (Fase 3) ──
  /** Versión de la política que aceptó (p. ej. "v1"). */
  consentVersion?: string;
  /** Quién matriculó/otorgó el consentimiento (email del actor). */
  consentGrantedBy?: string;
  consentGrantedAt?: Date;
  /** Laboratorio para el que se autorizó el tratamiento biométrico. */
  consentLab?: string;
  consentExpiresAt?: Date;
  /** Si existe, el consentimiento fue revocado. */
  consentRevokedAt?: Date;
  createdAt: Date;
}

export interface IAccessLog extends Document {
  attemptId?: string;
  studentId: string;
  studentName: string;
  avatarInitials: string;
  date: string;
  time: string;
  result: 'Permitido' | 'Denegado';
  similarity: number;
  kioskId?: string;
  labCode?: string;
  reason?: string;
  /** Clase vigente que autorizó (o denegó) este acceso; permite filtrar por clase. */
  scheduleId?: string;
  /** Latencia del reconocimiento en ms (medida por el kiosco). */
  recognitionMs?: number;
  createdAt: Date;
}

export interface IAlert extends Document {
  /** Identificador público estable. Alertas históricas pueden carecer de él. */
  id?: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  message: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: Date;
}

export interface ILab extends Document {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  createdAt: Date;
}

export interface IAuditLog extends Document {
  actor: string;
  actorEmail: string;
  /** Rol del usuario que ejecutó la acción (admin | docente). */
  actorRole?: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
  /** Dirección IP desde la que se ejecutó la acción. */
  ip?: string;
  /** Cadena del navegador (User-Agent). */
  userAgent?: string;
  /** Valor anterior de la entidad afectada (antes del cambio). */
  before?: string;
  /** Valor nuevo de la entidad afectada (después del cambio). */
  after?: string;
  createdAt: Date;
}

// ── Funcionalidad 1: planificación académica ──────────────────────────────

export interface ISchedule extends Document {
  id: string;
  subject: string;
  teacherId: string;      // _id del usuario docente
  labCode: string;        // código del laboratorio (LAB-02)
  dayOfWeek: number;      // 0=Dom ... 6=Sáb
  startTime: string;      // "HH:MM"
  endTime: string;        // "HH:MM"
  active: boolean;
  /** Estado de sesión: el docente lo inicia/finaliza desde su panel. */
  status: 'programada' | 'en_curso' | 'finalizada' | 'cancelada';
  /** Paralelo del curso (A, B, ...) dentro del horario oficial. */
  parallel?: string;
  /** Campus donde se imparte la clase (UIO, GYE, ...). */
  campus?: string;
  /** Período académico al que pertenece (p.ej. "2026-A"). */
  academicTerm?: string;
  /** Modalidad de entrega: presencial (usa laboratorio) o virtual (sin kiosco). */
  deliveryMode: 'presencial' | 'virtual';
  /** Si es false, la materia no exige control de acceso físico (kiosco). */
  requiresPhysicalAccess: boolean;
  /** Si es false, la materia no aparece en el kiosco ni genera autorizaciones. */
  activeKiosk: boolean;
  createdAt: Date;
}

export interface IAcademicTerm extends Document {
  id: string;
  code: string;           // "2026-A"
  name: string;           // "Primer Semestre 2026"
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface IEnrollment extends Document {
  id: string;
  scheduleId: string;
  studentId: string;
  active: boolean;
  createdAt: Date;
}

// ── Funcionalidad 5: control de asistencia ────────────────────────────────

export type AttendanceStatus = 'presente' | 'ausente';

export interface IAttendance extends Document {
  id: string;
  studentId: string;
  scheduleId: string;
  /** Fecha en formato local corto (p.ej. "Aug 2, 2026"). */
  date: string;
  /** Hora de ingreso registrada en el kiosco (HH:MM:SS). */
  time: string;
  /** Clase a la que pertenece el registro. */
  subject?: string;
  labCode?: string;
  teacherId?: string;
  status: AttendanceStatus;
  createdAt: Date;
}

export type KioskAttemptStatus = 'pending' | 'processing' | 'granted' | 'denied' | 'failed';

/** Intento efímero que vincula liveness, reconocimiento y persistencia. */
export interface IKioskAttempt extends Document {
  id: string;
  kioskId: string;
  labCode: string;
  livenessSessionId: string;
  attemptTokenHash: string;
  status: KioskAttemptStatus;
  studentId?: string;
  scheduleId?: string;
  accessLogId?: string;
  allowed?: boolean;
  reason?: string;
  confidence?: number;
  resultPayload?: string;
  processingStartedAt?: Date;
  consumedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface IRateLimitBucket extends Document {
  key: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
}

/** Sesión con refresh token revocable (Fase 2: rotación + revocación). */
export interface ISession extends Document {
  id: string;
  userId: string;
  /** SHA-256 del refresh token opaco. Nunca se guarda el token en claro. */
  refreshTokenHash: string;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

/** Historial de eventos de consentimiento biométrico (Fase 3). */
export type ConsentAction = 'grant' | 'refresh' | 'revoke';

export interface IConsentLog extends Document {
  id: string;
  studentId: string;
  action: ConsentAction;
  /** Versión de la política de consentimiento afectada. */
  version: string;
  labCode?: string;
  /** Actor (email) que ejecutó la acción. */
  grantedBy: string;
  /** Expiración del consentimiento tras esta acción (solo grant/refresh). */
  expiresAt?: Date;
  createdAt: Date;
}

// ── Funcionalidad 2: evidencia de denegados e incidentes ─────────────────

export interface IDenialEvidence extends Document {
  id: string;
  attemptId?: string;
  photoKey: string;
  reason: string;
  confidence: number;
  date: string;
  time: string;
  labCode?: string;
  kioskId?: string;
  studentId?: string;
  createdAt: Date;
}

export interface IIncident extends Document {
  id: string;
  type: 'repeated_denials' | 'kiosk_anomaly';
  status: 'open' | 'closed';
  reason?: string;
  labCode?: string;
  kioskId?: string;
  studentId?: string;
  evidenceIds: string[];
  count: number;
  windowMinutes: number;
  firstSeen: Date;
  lastSeen: Date;
  closedAt?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'docente', 'estudiante'], required: true },
  studentId: { type: String },
  labCode: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String },
  mfaVerifiedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.index({ labCode: 1 });
UserSchema.index({ role: 1, status: 1 });

const StudentSchema = new Schema<IStudent>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  lastName: { type: String },
  documentId: { type: String },
  email: { type: String },
  phone: { type: String },
  career: { type: String, required: true },
  lab: { type: String, required: true },
  labs: { type: [String], default: undefined },
  photoUrl: { type: String, default: '/images/default-avatar.jpg' },
  photoKey: { type: String },
  matchPercentage: { type: Number, default: 0 },
  status: { type: String, enum: ['allowed', 'denied'], default: 'allowed' },
  avatarInitials: { type: String, required: true },
  faceEmbeddingId: { type: String },
  biometricStatus: { type: String, enum: ['pending', 'registered'], default: 'pending' },
  biometricUpdatedAt: { type: Date },
  consentVersion: { type: String },
  consentGrantedBy: { type: String },
  consentGrantedAt: { type: Date },
  consentLab: { type: String },
  consentExpiresAt: { type: Date },
  consentRevokedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

const AccessLogSchema = new Schema<IAccessLog>({
  attemptId: { type: String },
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  avatarInitials: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  result: { type: String, enum: ['Permitido', 'Denegado'], required: true },
  similarity: { type: Number, required: true },
  kioskId: { type: String, default: 'Kiosk-042' },
  labCode: { type: String },
  reason: { type: String },
  scheduleId: { type: String },
  recognitionMs: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

AccessLogSchema.index({ studentId: 1, createdAt: -1 });
AccessLogSchema.index({ attemptId: 1 }, { unique: true, sparse: true });
AccessLogSchema.index({ createdAt: -1 });
AccessLogSchema.index({ result: 1, createdAt: -1 });
AccessLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const AlertSchema = new Schema<IAlert>({
  id: { type: String, unique: true, sparse: true },
  severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
  source: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: String, required: true },
  status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

AlertSchema.index({ status: 1, createdAt: -1 });

const LabSchema = new Schema<ILab>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

const AuditLogSchema = new Schema<IAuditLog>({
  actor: { type: String, required: true },
  actorEmail: { type: String, required: true },
  actorRole: { type: String },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String },
  details: { type: String },
  ip: { type: String },
  userAgent: { type: String },
  before: { type: String },
  after: { type: String },
  createdAt: { type: Date, default: Date.now },
});

AuditLogSchema.index({ actorEmail: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

const ScheduleSchema = new Schema<ISchedule>({
  id: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  teacherId: { type: String, required: true },
  labCode: { type: String, required: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  active: { type: Boolean, default: true },
  status: { type: String, enum: ['programada', 'en_curso', 'finalizada', 'cancelada'], default: 'programada' },
  parallel: { type: String },
  campus: { type: String },
  academicTerm: { type: String },
  deliveryMode: { type: String, enum: ['presencial', 'virtual'], default: 'presencial' },
  requiresPhysicalAccess: { type: Boolean, default: true },
  activeKiosk: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

ScheduleSchema.index({ labCode: 1, dayOfWeek: 1, startTime: 1 });
ScheduleSchema.index({ teacherId: 1 });
ScheduleSchema.index({ academicTerm: 1 });
ScheduleSchema.index({ activeKiosk: 1 });

const AcademicTermSchema = new Schema<IAcademicTerm>({
  id: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  startDate: { type: String },
  endDate: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

const EnrollmentSchema = new Schema<IEnrollment>({
  id: { type: String, required: true, unique: true },
  scheduleId: { type: String, required: true },
  studentId: { type: String, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

EnrollmentSchema.index({ studentId: 1, scheduleId: 1 }, { unique: true });

const DenialEvidenceSchema = new Schema<IDenialEvidence>({
  id: { type: String, required: true, unique: true },
  attemptId: { type: String },
  photoKey: { type: String, required: true },
  reason: { type: String, required: true },
  confidence: { type: Number, default: 0 },
  date: { type: String, required: true },
  time: { type: String, required: true },
  labCode: { type: String },
  kioskId: { type: String, default: 'Kiosk-042' },
  studentId: { type: String },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

DenialEvidenceSchema.index({ kioskId: 1, createdAt: -1 });
DenialEvidenceSchema.index({ studentId: 1, createdAt: -1 });
DenialEvidenceSchema.index({ attemptId: 1 }, { unique: true, sparse: true });
DenialEvidenceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const IncidentSchema = new Schema<IIncident>({
  id: { type: String, required: true, unique: true },
  type: { type: String, enum: ['repeated_denials', 'kiosk_anomaly'], required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  reason: { type: String },
  labCode: { type: String },
  kioskId: { type: String },
  studentId: { type: String },
  evidenceIds: { type: [String], default: [] },
  count: { type: Number, default: 0 },
  windowMinutes: { type: Number, default: 15 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  closedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

IncidentSchema.index({ status: 1, createdAt: -1 });
IncidentSchema.index({ kioskId: 1, status: 1 });

const AttendanceSchema = new Schema<IAttendance>({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  scheduleId: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  subject: { type: String },
  labCode: { type: String },
  teacherId: { type: String },
  status: { type: String, enum: ['presente', 'ausente'], default: 'presente' },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

AttendanceSchema.index({ scheduleId: 1, date: -1 });
AttendanceSchema.index({ studentId: 1, date: -1 });
AttendanceSchema.index({ teacherId: 1, date: -1 });

const KioskAttemptSchema = new Schema<IKioskAttempt>({
  id: { type: String, required: true, unique: true },
  kioskId: { type: String, required: true },
  labCode: { type: String, required: true },
  livenessSessionId: { type: String, required: true, unique: true },
  attemptTokenHash: { type: String, required: true, select: false },
  status: { type: String, enum: ['pending', 'processing', 'granted', 'denied', 'failed'], default: 'pending' },
  studentId: { type: String },
  scheduleId: { type: String },
  accessLogId: { type: String },
  allowed: { type: Boolean },
  reason: { type: String },
  confidence: { type: Number },
  resultPayload: { type: String },
  processingStartedAt: { type: Date },
  consumedAt: { type: Date },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

KioskAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
KioskAttemptSchema.index({ kioskId: 1, createdAt: -1 });

const RateLimitBucketSchema = new Schema<IRateLimitBucket>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  windowStart: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { id: false });

RateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SessionSchema = new Schema<ISession>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  refreshTokenHash: { type: String, required: true, unique: true },
  userAgent: { type: String },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
}, { id: false });

SessionSchema.index({ userId: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ConsentLogSchema = new Schema<IConsentLog>({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  action: { type: String, enum: ['grant', 'refresh', 'revoke'], required: true },
  version: { type: String, required: true },
  labCode: { type: String },
  grantedBy: { type: String, required: true },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

ConsentLogSchema.index({ studentId: 1, createdAt: -1 });

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Student = mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);
export const AccessLog = mongoose.models.AccessLog || mongoose.model<IAccessLog>('AccessLog', AccessLogSchema);
export const Alert = mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema);
export const Lab = mongoose.models.Lab || mongoose.model<ILab>('Lab', LabSchema);
export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export const Schedule = mongoose.models.Schedule || mongoose.model<ISchedule>('Schedule', ScheduleSchema);
export const Enrollment = mongoose.models.Enrollment || mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema);
export const DenialEvidence = mongoose.models.DenialEvidence || mongoose.model<IDenialEvidence>('DenialEvidence', DenialEvidenceSchema);
export const Incident = mongoose.models.Incident || mongoose.model<IIncident>('Incident', IncidentSchema);
export const Attendance = mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);
export const AcademicTerm = mongoose.models.AcademicTerm || mongoose.model<IAcademicTerm>('AcademicTerm', AcademicTermSchema);
export const KioskAttempt = mongoose.models.KioskAttempt || mongoose.model<IKioskAttempt>('KioskAttempt', KioskAttemptSchema);
export const RateLimitBucket = mongoose.models.RateLimitBucket || mongoose.model<IRateLimitBucket>('RateLimitBucket', RateLimitBucketSchema);
export const Session = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
export const ConsentLog = mongoose.models.ConsentLog || mongoose.model<IConsentLog>('ConsentLog', ConsentLogSchema);
