import { Schedule, Enrollment, Student } from './models.ts';
import { v4 as uuidv4 } from 'uuid';
import { isConsentActive } from './biometrics.ts';

export interface ScheduleView {
  id: string;
  subject: string;
  teacherId: string;
  labCode: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
  /** Estado de sesión; puede faltar en clases creadas antes del campo (legacy). */
  status?: 'programada' | 'en_curso' | 'finalizada' | 'cancelada';
  parallel?: string;
  campus?: string;
  academicTerm?: string;
  deliveryMode: 'presencial' | 'virtual';
  requiresPhysicalAccess: boolean;
  activeKiosk: boolean;
  createdAt: Date;
}

function toScheduleView(s: InstanceType<typeof Schedule>): ScheduleView {
  return {
    id: s.id,
    subject: s.subject,
    teacherId: s.teacherId,
    labCode: s.labCode,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    active: s.active,
    status: s.status,
    parallel: s.parallel,
    campus: s.campus,
    academicTerm: s.academicTerm,
    deliveryMode: s.deliveryMode ?? 'presencial',
    requiresPhysicalAccess: s.requiresPhysicalAccess ?? true,
    activeKiosk: s.activeKiosk ?? true,
    createdAt: s.createdAt,
  };
}

export async function listSchedules(): Promise<ScheduleView[]> {
  const docs = await Schedule.find().sort({ dayOfWeek: 1, startTime: 1 });
  return docs.map(toScheduleView);
}

export async function getSchedulesForTeacher(teacherId: string): Promise<ScheduleView[]> {
  const docs = await Schedule.find({ teacherId }).sort({ dayOfWeek: 1, startTime: 1 });
  return docs.map(toScheduleView);
}

export async function getSchedulesForLab(labCode: string, activeOnly = true): Promise<ScheduleView[]> {
  const filter: Record<string, unknown> = { labCode };
  if (activeOnly) filter.active = true;
  const docs = await Schedule.find(filter).sort({ dayOfWeek: 1, startTime: 1 });
  return docs.map(toScheduleView);
}

/** Devuelve únicamente IDs que todavía corresponden a estudiantes existentes. */
export async function getExistingStudentIds(studentIds: string[]): Promise<string[]> {
  const uniqueIds = Array.from(new Set(studentIds));
  if (uniqueIds.length === 0) return [];
  const students = await Student.find({ id: { $in: uniqueIds } }).select('id');
  return students.map(student => student.id);
}

/** Convierte HH:MM a minutos desde medianoche. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** ¿Es ahora una clase vigente en `labCode`? Convierte HH:MM a minutos. */
export function isClassNow(schedule: { startTime: string; endTime: string }, now = new Date()): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= toMinutes(schedule.startTime) && mins <= toMinutes(schedule.endTime);
}

/**
 * Razón exacta de la autorización. Permite que el kiosco muestre el motivo
 * específico de denegación (clase no iniciada, finalizada, laboratorio
 * incorrecto, no inscrito, etc.).
 */
export type AuthResult =
  | { allowed: true; schedule: ScheduleView }
  | { allowed: false; schedule: ScheduleView | null; reason: 'no-class' | 'not-enrolled' | 'class-not-started' | 'class-ended' | 'class-cancelled' | 'wrong-lab' | 'virtual' | 'no-biometric' | 'consent-expired' };

/**
 * Autorización por planificación + estado de sesión:
 * - Debe existir una clase activa hoy en `labCode`.
 * - La materia debe ser presencial y habilitada para el kiosco.
 * - El estudiante debe estar inscrito en esa clase y con biometría registrada.
 * - La clase debe estar "en curso" (el docente la inició desde su panel).
 *
 * Devuelve el motivo concreto para que el kiosco lo presente al estudiante.
 * Todos los Schedule se normalizan con `status` (backfill en `lib/db.ts`);
 * solo `en_curso` habilita el acceso.
 */
export async function canAccessLab(
  studentId: string,
  labCode: string,
  now = new Date()
): Promise<AuthResult> {
  const day = now.getDay();
  const schedules = await getSchedulesForLab(labCode, true).then(list =>
    list.filter(s => s.dayOfWeek === day && s.activeKiosk !== false)
  );

  if (schedules.length === 0) {
    return { allowed: false, schedule: null, reason: 'no-class' };
  }

  const inSession = schedules.find(s => isClassNow(s, now));
  if (!inSession) {
    // Hay clase hoy pero fuera de su ventana horaria.
    const earliest = schedules.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0];
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const reason = nowMin < toMinutes(earliest.startTime) ? 'class-not-started' : 'class-ended';
    return { allowed: false, schedule: earliest, reason };
  }

  // Las materias virtuales no generan autorizaciones por el kiosco.
  if (inSession.deliveryMode === 'virtual' || inSession.requiresPhysicalAccess === false) {
    return { allowed: false, schedule: inSession, reason: 'virtual' };
  }

  // El estado de sesión gobierna la asistencia: solo "en_curso" habilita.
  if (inSession.status === 'finalizada') {
    return { allowed: false, schedule: inSession, reason: 'class-ended' };
  }
  if (inSession.status === 'cancelada') {
    return { allowed: false, schedule: inSession, reason: 'class-cancelled' };
  }
  if (inSession.status !== 'en_curso') {
    // "programada" (o status ausente, normalizado por backfill): no autoriza.
    return { allowed: false, schedule: inSession, reason: 'class-not-started' };
  }

  const enrollments = await Enrollment.find({
    studentId,
    active: true,
    // La matrícula debe corresponder exactamente a la clase que está en curso.
    // Estar inscrito en otra clase del mismo laboratorio y día no autoriza esta sesión.
    scheduleId: inSession.id,
  });

  if (enrollments.length === 0) {
    return { allowed: false, schedule: inSession, reason: 'not-enrolled' };
  }

  // El acceso físico exige biometría registrada.
  const student = await Student.findOne({ id: studentId }).select('biometricStatus consentVersion consentGrantedAt consentExpiresAt consentRevokedAt');
  if (!student || student.biometricStatus !== 'registered') {
    return { allowed: false, schedule: inSession, reason: 'no-biometric' };
  }

  // Fase 3: consentimiento biométrico vigente. Si expiró o fue revocado, la
  // biometría deja de ser válida aunque siga indexada.
  if (!isConsentActive(student)) {
    return { allowed: false, schedule: inSession, reason: 'consent-expired' };
  }

  return { allowed: true, schedule: inSession };
}

export function newScheduleId(): string {
  return `sched-${uuidv4().slice(0, 8)}`;
}

export function newEnrollmentId(): string {
  return `enr-${uuidv4().slice(0, 8)}`;
}
