/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Career = 'Ingeniería en Tecnologías de la Información (TIC)';

export interface CareerInfo {
  value: Career;
  degree: string;
  duration: string;
  modality: string;
  accreditation?: string;
}

export const CAREERS: CareerInfo[] = [
  {
    value: 'Ingeniería en Tecnologías de la Información (TIC)',
    degree: 'Ingeniero/a',
    duration: '8 semestres',
    modality: 'Presencial',
  },
];

export interface Student {
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
  faceEmbeddingId?: string;
  matchPercentage: number;
  status: 'allowed' | 'denied';
  avatarInitials: string;
  biometricStatus?: 'pending' | 'registered';
}

export interface AccessLog {
  id: string;
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
  scheduleId?: string;
  recognitionMs?: number;
}

export interface CloudService {
  id: string;
  name: string;
  iconName: string;
  tag: string;
  description: string;
  actionLabel: string;
  status: 'operational' | 'busy' | 'alert';
}

export type AppView = 'home' | 'demo' | 'admin' | 'architecture';

export type UserRole = 'admin' | 'docente' | 'estudiante';

export interface AuthUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  studentId?: string;
  labCode?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'docente';
  labCode?: string;
  status?: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

export interface Lab {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  actorEmail: string;
  actorRole?: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
  ip?: string;
  userAgent?: string;
  before?: string;
  after?: string;
  createdAt: string;
}

export interface Schedule {
  id: string;
  subject: string;
  teacherId: string;
  labCode: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
  status: 'programada' | 'en_curso' | 'finalizada' | 'cancelada';
  parallel?: string;
  campus?: string;
  academicTerm?: string;
  deliveryMode: 'presencial' | 'virtual';
  requiresPhysicalAccess: boolean;
  activeKiosk: boolean;
  createdAt: string;
}

export interface AcademicTerm {
  id: string;
  code: string;
  name: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
}

export type AttendanceStatus = 'presente' | 'fuera_de_horario' | 'ausente';

export interface Attendance {
  id: string;
  studentId: string;
  scheduleId: string;
  subject?: string;
  labCode?: string;
  teacherId?: string;
  status: AttendanceStatus;
  date: string;
  time: string;
  createdAt: string;
}

export interface AttendanceReportRow {
  scheduleId: string;
  subject: string;
  labCode: string;
  teacherId: string;
  teacherName: string | null;
  expected: number;
  present: number;
  outOfWindow: number;
  absent: number;
  attendanceRate: number;
}

export interface StudentReportRow {
  studentId: string;
  studentName: string;
  scheduleId: string;
  subject: string;
  present: number;
  outOfWindow: number;
  absent: number;
  attendanceRate: number;
  denials: number;
}

export interface AttendanceReport {
  generatedAt: string;
  scope: 'all' | 'docente';
  byClass: AttendanceReportRow[];
  byStudent: StudentReportRow[];
  topLate: { studentId: string; studentName: string; count: number }[];
  topDenials: { studentId: string; studentName: string; count: number }[];
  incidentsByLab: { labCode: string; open: number; closed: number }[];
  avgRecognitionMs: number | null;
}

export interface LabDashboard {
  labCode: string;
  currentClass: { id: string; subject: string; teacherName: string | null; startTime: string; endTime: string; status: string } | null;
  expectedStudents: number;
  presentStudents: number;
  absentStudents: number;
  grantedToday: number;
  deniedToday: number;
  openIncidents: number;
  avgRecognitionMs: number | null;
  kioskStatus: 'online' | 'idle' | 'offline';
  lastSync: string | null;
  lastKioskId: string | null;
}

export interface AcademicDashboard {
  scope: 'admin' | 'docente';
  classes?: number;
  classesTotal?: number;
  classesActive?: number;
  docentes?: number;
  students: number;
  labs?: number;
  biometricsPending: number;
  todayAccesses: number;
  todayDenied: number;
  activeIncidents: number;
  labOccupancy?: { code: string; name: string; activeClasses: number }[];
  upcomingSchedules?: { id: string; subject: string; labCode: string; dayOfWeek: number; startTime: string; endTime: string; status: string }[];
}

export interface Enrollment {
  id: string;
  scheduleId: string;
  studentId: string;
  active: boolean;
  createdAt: string;
}

export interface DenialEvidence {
  id: string;
  photoKey: string;
  reason: string;
  confidence: number;
  date: string;
  time: string;
  labCode?: string;
  kioskId?: string;
  studentId?: string;
  createdAt: string;
}

export interface Incident {
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
  firstSeen: string;
  lastSeen: string;
  closedAt?: string;
  createdAt: string;
}

export interface SystemHealth {
  ok: boolean;
  timestamp: string;
  mongo: {
    connected: boolean;
    counts?: { users: number; students: number; logs: number; alerts: number; labs: number };
    error?: string;
  };
  cloudwatch: {
    ok: boolean;
    metrics?: Record<string, number>;
    error?: string;
  };
  aws: {
    configured: boolean;
    region: string;
    s3Bucket: string | null;
    snsTopic: boolean;
  };
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  message: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
}
