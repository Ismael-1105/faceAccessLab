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
  /** Momento en que la sesión se inició; falta en clases anteriores al campo. */
  sessionStartedAt?: Date;
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
    sessionStartedAt: s.sessionStartedAt,
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

/** Horas que una sesión sin finalizar sigue siendo válida. Configurable. */
function sessionMaxMs(): number {
  const raw = Number(process.env.SESSION_MAX_HOURS);
  const hours = Number.isFinite(raw) && raw > 0 ? raw : 12;
  return hours * 3600_000;
}

/**
 * Definición única de "sesión vigente", compartida por `canAccessLab` y por la
 * cabecera del kiosco (`handleGetKioskSession`). Deben coincidir siempre: si el
 * terminal anuncia una clase en curso que la autorización luego rechaza, el
 * kiosco se contradice a sí mismo delante del estudiante.
 *
 * Ni el día de la semana ni la franja horaria intervienen: el docente puede
 * iniciar la clase cuando la necesite (ISS-01/ISS-05). Lo que sí acota es la
 * marca de inicio, para que una clase que nadie finalizó deje de autorizar en
 * lugar de quedar abierta indefinidamente. Sin marca (clases anteriores al
 * campo) se considera no vigente, que es el lado seguro.
 */
export function isSessionActive(
  schedule: { status?: string; sessionStartedAt?: Date },
  now = new Date(),
): boolean {
  if (schedule.status !== 'en_curso') return false;
  if (!schedule.sessionStartedAt) return false;
  return now.getTime() - schedule.sessionStartedAt.getTime() < sessionMaxMs();
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
 * Autorización por estado de sesión:
 * - Debe existir una clase activa en `labCode` con sesión vigente, es decir
 *   iniciada por el docente y dentro de la ventana máxima (isSessionActive).
 *   Ni el día de la semana ni la franja horaria condicionan la autorización:
 *   una clase puede empezar tarde, adelantarse o recuperarse en otro horario.
 * - La materia debe ser presencial y habilitada para el kiosco.
 * - El estudiante debe estar inscrito en esa clase y con biometría registrada.
 *
 * Devuelve el motivo concreto para que el kiosco lo presente al estudiante.
 * Todos los Schedule se normalizan con `status` (backfill en `lib/db.ts`).
 */
export async function canAccessLab(
  studentId: string,
  labCode: string,
  now = new Date()
): Promise<AuthResult> {
  // Sin filtro por dayOfWeek: el estado de sesión gobierna, no el calendario.
  const candidates = await getSchedulesForLab(labCode, true).then(list =>
    list.filter(s => s.activeKiosk !== false)
  );

  if (candidates.length === 0) {
    return { allowed: false, schedule: null, reason: 'no-class' };
  }

  const byStart = (a: ScheduleView, b: ScheduleView) =>
    toMinutes(a.startTime) - toMinutes(b.startTime);

  // Una clase en curso autoriza aunque sea otro día y fuera de su franja.
  // isClassNow ya solo desempata entre varias sesiones simultáneas.
  const running = candidates.filter(s => isSessionActive(s, now));
  const inSession = running.length
    ? (running.find(s => isClassNow(s, now)) ?? running.slice().sort(byStart)[0])
    : null;

  if (!inSession) {
    // Ninguna sesión vigente. El motivo sale del estado de la clase más
    // representativa, priorizando las de hoy para que el mensaje sea útil.
    const today = candidates.filter(s => s.dayOfWeek === now.getDay());
    const reference = (today.length ? today : candidates).slice().sort(byStart)[0];
    const reason = reference.status === 'cancelada'
      ? 'class-cancelled'
      // "en_curso" aquí significa sesión caducada por no haberse finalizado:
      // para quien está frente al kiosco, eso es una clase terminada.
      : reference.status === 'finalizada' || reference.status === 'en_curso'
        ? 'class-ended'
        : 'class-not-started';
    return { allowed: false, schedule: reference, reason };
  }

  // Las materias virtuales no generan autorizaciones por el kiosco.
  if (inSession.deliveryMode === 'virtual' || inSession.requiresPhysicalAccess === false) {
    return { allowed: false, schedule: inSession, reason: 'virtual' };
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
