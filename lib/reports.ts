import { Schedule, Enrollment, Attendance, AccessLog, Incident, User, DenialEvidence } from './models.ts';
import { getSchedulesForTeacher, getSchedulesForLab, getExistingStudentIds } from './scheduling.ts';

export interface ReportRow {
  scheduleId: string;
  subject: string;
  labCode: string;
  teacherId: string;
  teacherName: string | null;
  expected: number;
  present: number;
  absent: number;
  attendanceRate: number;
}

export interface StudentReportRow {
  studentId: string;
  studentName: string;
  scheduleId: string;
  subject: string;
  present: number;
  absent: number;
  attendanceRate: number;
  /** Rechazos (accesos denegados) del estudiante en el período. */
  denials: number;
}

export interface AttendanceReport {
  generatedAt: string;
  scope: 'all' | 'docente';
  byClass: ReportRow[];
  byStudent: StudentReportRow[];
  /** Estudiantes con más rechazos, desc. */
  topDenials: { studentId: string; studentName: string; count: number }[];
  /** Incidentes agrupados por laboratorio. */
  incidentsByLab: { labCode: string; open: number; closed: number }[];
  /** Tiempo promedio de reconocimiento en ms (latencia del kiosco). */
  avgRecognitionMs: number | null;
}

function rate(present: number, expected: number): number {
  if (expected === 0) return 0;
  return Math.round((present / expected) * 100);
}

/**
 * Agrega el reporte de asistencia de un conjunto de clases.
 *
 * `null` significa "sin filtro" (el reporte global del administrador) y una
 * lista vacía significa "ninguna clase". Antes ambos casos se escribían igual,
 * con `[]`, de modo que un docente sin clases asignadas recibía la asistencia,
 * los rechazos y los incidentes de todos los docentes, presentados como propios
 * porque `scope` decía 'docente'.
 */
async function buildReport(scheduleIds: string[] | null): Promise<AttendanceReport> {
  const schedules = scheduleIds === null
    ? await Schedule.find()
    : scheduleIds.length === 0
      ? []
      : await Schedule.find({ id: { $in: scheduleIds } });
  const ids = schedules.map(s => s.id);

  if (ids.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      scope: 'all',
      byClass: [],
      byStudent: [],
      topDenials: [],
      incidentsByLab: [],
      avgRecognitionMs: null,
    };
  }

  const [rawEnrollments, rawAttendances, rawDenials, avgRecognition] = await Promise.all([
    Enrollment.find({ scheduleId: { $in: ids }, active: true }),
    Attendance.find({ scheduleId: { $in: ids } }),
    // Rechazos, incidentes y latencia se limitan a las clases consultadas
    // (para un docente: solo sus clases; para admin: todo).
    AccessLog.find({ result: 'Denegado', scheduleId: { $in: ids } }),
    AccessLog.aggregate([
      { $match: { recognitionMs: { $gt: 0 }, scheduleId: { $in: ids } } },
      { $group: { _id: null, avg: { $avg: '$recognitionMs' } } },
    ]),
  ]);
  const existingStudentIds = await getExistingStudentIds(rawEnrollments.map(e => e.studentId));
  const existingStudentSet = new Set(existingStudentIds);
  const enrollments = rawEnrollments.filter(e => existingStudentSet.has(e.studentId));
  const attendances = rawAttendances.filter(a => existingStudentSet.has(a.studentId));
  const denials = rawDenials.filter(d => existingStudentSet.has(d.studentId));
  const incidents = await Incident.find({
    labCode: { $exists: true },
    studentId: { $in: existingStudentIds },
  });

  const teachers = await User.find({ role: 'docente' });
  const teacherName = (id: string) => teachers.find(t => String(t._id) === id)?.name || null;

  // Nombres de estudiantes conocidos desde los logs de acceso.
  const studentNames = new Map<string, string>();
  denials.forEach(d => { if (d.studentName && d.studentId) studentNames.set(d.studentId, d.studentName); });
  const allLogs = await AccessLog.find({ studentId: { $ne: 'unknown' } }).select('studentId studentName');
  allLogs.forEach(l => { if (l.studentName) studentNames.set(l.studentId, l.studentName); });
  const nameOf = (id: string) => studentNames.get(id) || id;

  // Asistencia por clase.
  const byClass: ReportRow[] = schedules.map(s => {
    const enrolled = enrollments.filter(e => e.scheduleId === s.id);
    const classAtt = attendances.filter(a => a.scheduleId === s.id);
    // `present` cuenta registros acumulados de todas las fechas, mientras que
    // los inscritos son el aforo de UNA sesión. Mezclarlos daba porcentajes por
    // encima de 100 (4 inscritos y 3 sesiones completas mostraban 300 por
    // ciento) y hacía que present + absent no sumara expected. Se normaliza por
    // número de sesiones registradas para que las tres cifras hablen la misma
    // unidad, que es la que ya usa el bloque byStudent.
    const sessions = new Set(classAtt.map(a => a.date)).size || 1;
    const present = classAtt.filter(a => a.status === 'presente').length;
    const expectedTotal = enrolled.length * sessions;
    const absent = Math.max(0, expectedTotal - present);
    return {
      scheduleId: s.id,
      subject: s.subject,
      labCode: s.labCode,
      teacherId: s.teacherId,
      teacherName: teacherName(s.teacherId),
      expected: expectedTotal,
      present,
      absent,
      attendanceRate: rate(present, expectedTotal),
    };
  });

  // Asistencia por estudiante (por clase).
  const byStudentMap = new Map<string, StudentReportRow>();
  for (const s of schedules) {
    const classAtt = attendances.filter(a => a.scheduleId === s.id);
    for (const a of classAtt) {
      const key = `${a.studentId}:${s.id}`;
      const existing = byStudentMap.get(key) || {
        studentId: a.studentId,
        studentName: nameOf(a.studentId),
        scheduleId: s.id,
        subject: s.subject,
        present: 0,
        absent: 0,
        attendanceRate: 0,
        denials: 0,
      };
      if (a.status === 'presente') existing.present += 1;
      else existing.absent += 1;
      byStudentMap.set(key, existing);
    }
  }
  for (const row of byStudentMap.values()) {
    row.attendanceRate = rate(row.present, row.present + row.absent);
  }

  // Rechazos por estudiante.
  const denialCount = new Map<string, number>();
  const denialName = new Map<string, string>();
  denials.forEach(d => {
    denialCount.set(d.studentId, (denialCount.get(d.studentId) || 0) + 1);
    if (d.studentName) denialName.set(d.studentId, d.studentName);
  });
  byStudentMap.forEach(row => {
    row.denials = denialCount.get(row.studentId) || 0;
  });

  const byStudent = Array.from(byStudentMap.values());
  const topDenials = Array.from(denialCount.entries())
    .map(([studentId, count]) => ({ studentId, studentName: denialName.get(studentId) || studentId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const incidentsByLabMap = new Map<string, { labCode: string; open: number; closed: number }>();
  incidents.forEach(inc => {
    const key = inc.labCode || 'Sin lab';
    const entry = incidentsByLabMap.get(key) || { labCode: key, open: 0, closed: 0 };
    if (inc.status === 'open') entry.open += 1;
    else entry.closed += 1;
    incidentsByLabMap.set(key, entry);
  });
  const incidentsByLab = Array.from(incidentsByLabMap.values());

  return {
    generatedAt: new Date().toISOString(),
    scope: 'all',
    byClass: byClass.sort((a, b) => b.present - a.present),
    byStudent,
    topDenials,
    incidentsByLab,
    avgRecognitionMs: avgRecognition[0]?.avg ?? null,
  };
}

/** Reporte global (admin) o del docente (solo sus clases). */
export async function getAttendanceReport(teacherId?: string): Promise<AttendanceReport> {
  // Sin docente, sin filtro (null). Con docente, sus clases, aunque sean cero:
  // una lista vacía debe producir un reporte vacío, no el de la institución.
  let scheduleIds: string[] | null = null;
  let scope: AttendanceReport['scope'] = 'all';
  if (teacherId) {
    scheduleIds = (await getSchedulesForTeacher(teacherId)).map(s => s.id);
    scope = 'docente';
  }
  const report = await buildReport(scheduleIds);
  report.scope = scope;
  return report;
}

/** Reporte de un laboratorio específico (todas las clases del lab). */
export async function getLabAttendanceReport(labCode: string): Promise<AttendanceReport> {
  const schedules = await getSchedulesForLab(labCode, false);
  // Siempre lista, nunca null: un laboratorio sin horarios configurados debe dar
  // un reporte vacío, no el global de todos los laboratorios.
  return buildReport(schedules.map(s => s.id));
}

// ── Dashboard del laboratorio (Funcionalidad 4) ──────────────────────────

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

const KIOSK_HEARTBEAT_MS = 2 * 60 * 1000;

export async function getLabDashboard(labCode: string): Promise<LabDashboard> {
  const now = new Date();
  const day = now.getDay();

  const [schedules, rawEnrollments, attendances, logs, incidents, avgRecognition] = await Promise.all([
    getSchedulesForLab(labCode, true).then(list => list.filter(s => s.dayOfWeek === day)),
    Enrollment.find({}),
    Attendance.find({ labCode }),
    AccessLog.find({ labCode }).sort({ createdAt: -1 }).limit(200),
    Incident.find({ labCode }),
    AccessLog.aggregate([
      { $match: { recognitionMs: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$recognitionMs' } } },
    ]),
  ]);
  const existingStudentIds = new Set(await getExistingStudentIds(rawEnrollments.map(e => e.studentId)));
  const enrollments = rawEnrollments.filter(e => existingStudentIds.has(e.studentId));

  // Clase en curso: la que esté dentro de la ventana y "en_curso".
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const current = schedules.find(s =>
    (s.status ?? 'programada') === 'en_curso' &&
    nowMin >= toMin(s.startTime) && nowMin <= toMin(s.endTime)
  ) || null;

  const teachers = await User.find({ role: 'docente' });

  let expectedStudents = 0;
  let presentStudents = 0;
  const presentSet = new Set<string>();
  if (current) {
    const enrolled = enrollments.filter(e => e.scheduleId === current.id && e.active);
    expectedStudents = enrolled.length;
    const classAtt = attendances.filter(a => a.scheduleId === current.id);
    presentStudents = classAtt.filter(a => a.status === 'presente').length;
    classAtt.filter(a => a.status === 'presente').forEach(a => presentSet.add(a.studentId));
  }

  const today = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const todayLogs = logs.filter(l => l.date === today);
  const grantedToday = todayLogs.filter(l => l.result === 'Permitido').length;
  const deniedToday = todayLogs.filter(l => l.result === 'Denegado').length;
  const openIncidents = incidents.filter(i => i.status === 'open').length;

  // Estado del kiosco según la última lectura registrada.
  const lastLog = logs[0] || null;
  const lastSync = lastLog?.createdAt?.toISOString() || null;
  const lastKioskId = lastLog?.kioskId || null;
  let kioskStatus: LabDashboard['kioskStatus'] = 'offline';
  if (lastLog?.createdAt) {
    const delta = now.getTime() - new Date(lastLog.createdAt).getTime();
    kioskStatus = delta < KIOSK_HEARTBEAT_MS ? 'online' : delta < 10 * 60 * 1000 ? 'idle' : 'offline';
  }

  return {
    labCode,
    currentClass: current
      ? {
          id: current.id,
          subject: current.subject,
          teacherName: teachers.find(t => String(t._id) === current.teacherId)?.name || null,
          startTime: current.startTime,
          endTime: current.endTime,
          status: current.status ?? 'programada',
        }
      : null,
    expectedStudents,
    presentStudents,
    absentStudents: Math.max(0, expectedStudents - presentSet.size),
    grantedToday,
    deniedToday,
    openIncidents,
    avgRecognitionMs: avgRecognition[0]?.avg ?? null,
    kioskStatus,
    lastSync,
    lastKioskId,
  };
}
