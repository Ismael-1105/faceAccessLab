import { connectDB } from './db.ts';
import { User, Student, AccessLog, Alert, Lab, Schedule, Enrollment, DenialEvidence, Incident, Attendance, AcademicTerm } from './models.ts';
import { hashPassword, comparePassword, generateToken, verifyToken, getTokenFromRequest, readRefreshToken, jsonResponse, errorResponse } from './auth.ts';
import { v4 as uuidv4 } from 'uuid';
import {
  studentCreateSchema,
  userCreateSchema,
  userUpdateSchema,
  labCreateSchema,
  labUpdateSchema,
  scheduleCreateSchema,
  scheduleUpdateSchema,
  enrollmentCreateSchema,
  denialEvidenceSchema,
  incidentCloseSchema,
  attendanceCreateSchema,
  academicTermCreateSchema,
} from './validation.ts';
import { recordAudit, getAuditLogsPage, getClientIp, getUserAgent } from './audit.ts';
import { newScheduleId, newEnrollmentId, getSchedulesForTeacher, getSchedulesForLab, getExistingStudentIds, isClassNow } from './scheduling.ts';
import { getAttendanceReport, getLabDashboard } from './reports.ts';
import { recordDenialEvidence } from './evidence.ts';
import { getPresignedUrl } from './s3.ts';
import { alertIdentifierFilter } from './alerts.ts';

export async function handleLogin(req: Request): Promise<Response> {
  const { loginSchema } = await import('./validation.ts');
  const { authService } = await import('../src/modules/auth/auth.service.ts');
  const { sendJson } = await import('../src/shared/http.ts');
  const raw = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return sendJson({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, 400);
  }
  const result = await authService.login(req, parsed.data);
  return sendJson(result.body, result.status, { cookies: result.cookies });
}

export async function handleLogout(req: Request): Promise<Response> {
  const { authService } = await import('../src/modules/auth/auth.service.ts');
  const { sendJson } = await import('../src/shared/http.ts');
  const result = await authService.logout(req);
  return sendJson(result.body, result.status, { cookies: result.cookies });
}

export async function handleRegister(req: Request): Promise<Response> {
  const { errorResponse } = await import('./auth.ts');
  const { registerSchema } = await import('./validation.ts');
  const { authService } = await import('../src/modules/auth/auth.service.ts');
  const { sendJson } = await import('../src/shared/http.ts');
  const { requireAdmin } = await import('./rbac.ts');
  let actor;
  try {
    actor = requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }
  const raw = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }
  const result = await authService.register(actor, parsed.data);
  return sendJson(result.body, result.status);
}

export async function handleGetUsers(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }

  await connectDB();
  const users = await User.find({ role: 'docente' }).sort({ createdAt: -1 });
  const safe = users.map(u => ({
    id: u._id,
    email: u.email,
    name: u.name,
    role: u.role,
    studentId: u.studentId,
    labCode: u.labCode,
    status: u.status,
    createdAt: u.createdAt,
  }));
  return jsonResponse(safe);
}

export async function handleCreateUser(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  let actor;
  try {
    actor = await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }
  if (await mutationRateLimited(req, 'user')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  const body = await req.json() as Record<string, unknown>;

  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const { email, password, name, labCode } = parsed.data;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return errorResponse('El email ya está registrado', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email: email.toLowerCase(), passwordHash, name, role: 'docente', labCode });

  await recordAudit({
    actor: actor.email,
    actorEmail: actor.email,
    action: 'user.create',
    targetType: 'user',
    targetId: String(user._id),
    details: `Creado docente ${name} (${email})${labCode ? ` · asignado a ${labCode}` : ''}`,
  });

  return jsonResponse({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      labCode: user.labCode,
      createdAt: user.createdAt,
    },
  }, 201);
}

export async function handleUpdateUser(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor || actor.role !== 'admin') {
    return errorResponse('Acceso restringido a administradores', 403);
  }
  if (await mutationRateLimited(req, 'user')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const body = await req.json() as Record<string, unknown>;

  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const { id, email, password, name, labCode } = parsed.data;

  if (!id) {
    return errorResponse('ID del docente requerido', 400);
  }

  const updates: { email?: string; name?: string; passwordHash?: string; labCode?: string } = {};
  if (email) updates.email = email.toLowerCase();
  if (name) updates.name = name;
  if (password) updates.passwordHash = await hashPassword(password);
  if (labCode !== undefined) updates.labCode = labCode;

  if (Object.keys(updates).length === 0) {
    return errorResponse('No hay cambios para aplicar', 400);
  }

  const user = await User.findOneAndUpdate({ _id: id }, { $set: updates }, { new: true });
  if (!user) {
    return errorResponse('Docente no encontrado', 404);
  }

  await recordAudit({
    ...auditContext(actor, req),
    action: 'user.update',
    targetType: 'user',
    targetId: id,
    details: `Docente ${user.name} actualizado${labCode !== undefined ? ` · lab/aula → ${labCode}` : ''}`,
  });

  return jsonResponse({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      labCode: user.labCode,
      createdAt: user.createdAt,
    },
  });
}

export async function handleDeleteUser(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  let actor;
  try {
    actor = await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }
  if (await mutationRateLimited(req, 'user')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const { id } = await req.json() as { id?: string };

  if (!id) {
    return errorResponse('ID del docente requerido', 400);
  }

  const deleted = await User.findOneAndDelete({ _id: id, role: 'docente' });
  if (!deleted) {
    return errorResponse('Docente no encontrado', 404);
  }

  await recordAudit({
    actor: actor.email,
    actorEmail: actor.email,
    action: 'user.delete',
    targetType: 'user',
    targetId: id,
    details: `Eliminado docente ${deleted.name} (${deleted.email})`,
  });

  return jsonResponse({ ok: true, message: 'Docente eliminado' });
}

/** Suspende o reactiva la cuenta de un docente/estudiante (solo admin). */
export async function handleUpdateUserStatus(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor || actor.role !== 'admin') {
    return errorResponse('Acceso restringido a administradores', 403);
  }
  if (await mutationRateLimited(req, 'user')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const { id, status } = await req.json() as { id?: string; status?: string };
  if (!id || !['active', 'inactive', 'suspended'].includes(status || '')) {
    return errorResponse('id y status son requeridos (active | inactive | suspended)', 400);
  }

  const user = await User.findOneAndUpdate({ _id: id }, { $set: { status } }, { new: true });
  if (!user) return errorResponse('Usuario no encontrado', 404);

  await recordAudit({
    ...auditContext(actor, req),
    action: 'user.status',
    targetType: 'user',
    targetId: id,
    details: `Estado de ${user.name} → ${status}`,
    before: user.status,
    after: status as string,
  });

  return jsonResponse({
    user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status },
  });
}

export async function handleGetLabs(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const labs = await Lab.find().sort({ code: 1 });
  const safe = labs.map(l => ({
    id: l.id,
    name: l.name,
    code: l.code,
    description: l.description,
    active: l.active,
    createdAt: l.createdAt,
  }));
  return jsonResponse(safe);
}

export async function handleCreateLab(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  let actor;
  try {
    actor = await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }
  if (await mutationRateLimited(req, 'lab')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const body = await req.json() as Record<string, unknown>;

  const parsed = labCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const { name, code, description, active } = parsed.data;

  const normalizedCode = String(code).toUpperCase().trim();
  const existing = await Lab.findOne({ code: normalizedCode });
  if (existing) {
    return errorResponse('Ya existe un laboratorio con ese código', 409);
  }

  const lab = await Lab.create({
    id: `lab-${uuidv4().slice(0, 8)}`,
    name: String(name).trim(),
    code: normalizedCode,
    description: description?.trim() || undefined,
    active: active ?? true,
  });

  await recordAudit({
    actor: actor.email,
    actorEmail: actor.email,
    action: 'lab.create',
    targetType: 'lab',
    targetId: lab.id,
    details: `Creado laboratorio ${lab.name} (${lab.code})`,
  });

  return jsonResponse({
    lab: {
      id: lab.id,
      name: lab.name,
      code: lab.code,
      description: lab.description,
      active: lab.active,
      createdAt: lab.createdAt,
    },
  }, 201);
}

export async function handleUpdateLab(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }
  if (await mutationRateLimited(req, 'lab')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const body = await req.json() as Record<string, unknown>;

  const parsed = labUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const { id, name, code, description, active } = parsed.data;

  if (!id) {
    return errorResponse('ID del laboratorio requerido', 400);
  }

  const updates: { name?: string; code?: string; description?: string; active?: boolean } = {};
  if (name) updates.name = name.trim();
  if (code) updates.code = String(code).toUpperCase().trim();
  if (typeof description === 'string') updates.description = description.trim() || undefined;
  if (typeof active === 'boolean') updates.active = active;

  if (Object.keys(updates).length === 0) {
    return errorResponse('No hay cambios para aplicar', 400);
  }

  const lab = await Lab.findOneAndUpdate({ id }, { $set: updates }, { new: true });
  if (!lab) {
    return errorResponse('Laboratorio no encontrado', 404);
  }

  return jsonResponse({
    lab: {
      id: lab.id,
      name: lab.name,
      code: lab.code,
      description: lab.description,
      active: lab.active,
      createdAt: lab.createdAt,
    },
  });
}

export async function handleDeleteLab(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  let actor;
  try {
    actor = await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }
  if (await mutationRateLimited(req, 'lab')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const { id } = await req.json() as { id?: string };

  if (!id) {
    return errorResponse('ID del laboratorio requerido', 400);
  }

  const deleted = await Lab.findOneAndDelete({ id });
  if (!deleted) {
    return errorResponse('Laboratorio no encontrado', 404);
  }

  await recordAudit({
    actor: actor.email,
    actorEmail: actor.email,
    action: 'lab.delete',
    targetType: 'lab',
    targetId: id,
    details: `Eliminado laboratorio ${deleted.name} (${deleted.code})`,
  });

  return jsonResponse({ ok: true, message: 'Laboratorio eliminado' });
}

async function authenticate(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) throw new Error('No autorizado');
  return verifyToken(token);
}

async function requireAdmin(req: Request) {
  const payload = await authenticate(req);
  if (payload.role !== 'admin') throw new Error('Acceso restringido a administradores');
  return payload;
}

/** Perfil del usuario autenticado, o null si no hay sesión válida. */
async function tryAuthenticate(req: Request) {
  try {
    return await authenticate(req);
  } catch {
    return null;
  }
}

/**
 * Rate limit distribuido para mutaciones sensibles (por IP). Devuelve true si
 * la petición debe bloquearse (429).
 */
async function mutationRateLimited(req: Request, bucket: string, max = 30): Promise<boolean> {
  const { checkDistributedRateLimit, getClientAddress } = await import('./distributed-rate-limit.ts');
  return !(await checkDistributedRateLimit(`mut:${bucket}:${getClientAddress(req)}`, max));
}

/** Contexto común de auditoría: quién, desde dónde y desde qué navegador. */
function auditContext(actor: { email: string; role: string }, req: Request) {
  return {
    actor: actor.email,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}

/** IDs de las clases del docente, para filtrar sus datos (F2/F3). */
async function getTeacherScheduleIds(teacherId: string): Promise<string[]> {
  const schedules = await getSchedulesForTeacher(teacherId);
  return schedules.map(s => s.id);
}

/**
 * F10: al finalizar una clase, marca como "ausente" a los inscritos que aún no
 * registraron asistencia hoy. Es la automatización de un proceso manual.
 */
export async function markAbsentees(scheduleId: string): Promise<number> {  const now = new Date();
  const today = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const enrolled = await Enrollment.find({ scheduleId, active: true });
  const existingStudentIds = new Set(await getExistingStudentIds(enrolled.map(e => e.studentId)));
  const present = await Attendance.find({ scheduleId, date: today, status: 'presente' });
  const presentIds = new Set(present.map(a => a.studentId));

  const absentees = enrolled.filter(e => existingStudentIds.has(e.studentId) && !presentIds.has(e.studentId));
  if (absentees.length === 0) return 0;

  const schedule = await Schedule.findOne({ id: scheduleId });
  const pad = (n: number) => n.toString().padStart(2, '0');

  const docs = absentees.map(e => ({
    id: `att-${uuidv4().slice(0, 8)}`,
    studentId: e.studentId,
    scheduleId,
    subject: schedule?.subject,
    labCode: schedule?.labCode,
    teacherId: schedule?.teacherId,
    status: 'ausente' as const,
    date: today,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    createdAt: now,
  }));

  await Attendance.insertMany(docs);
  return absentees.length;
}

export async function handleGetStudents(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  await connectDB();

  // F2: un docente solo ve los estudiantes inscritos en sus clases.
  if (actor.role === 'docente') {
    const scheduleIds = await getTeacherScheduleIds(actor.userId);
    if (scheduleIds.length === 0) return jsonResponse([]);
    const enrollments = await Enrollment.find({ scheduleId: { $in: scheduleIds }, active: true });
    const studentIds = enrollments.map(e => e.studentId);
    const students = await Student.find({ id: { $in: studentIds } }).sort({ createdAt: -1 });
    return jsonResponse(students);
  }

  const students = await Student.find().sort({ createdAt: -1 });
  return jsonResponse(students);
}

export async function handleCreateStudent(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (await mutationRateLimited(req, 'student')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const body = await req.json() as Record<string, unknown>;

  const parsed = studentCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const data = parsed.data;

  // F1: un docente solo puede matricular para una de sus clases.
  let scheduleForEnroll: InstanceType<typeof Schedule> | null = null;
  if (data.scheduleId) {
    scheduleForEnroll = await Schedule.findOne({ id: data.scheduleId });
    if (!scheduleForEnroll) return errorResponse('Clase no encontrada', 404);
    if (actor.role === 'docente' && scheduleForEnroll.teacherId !== actor.userId) {
      return errorResponse('Solo puedes registrar estudiantes en tus propias clases', 403);
    }
  } else if (actor.role === 'docente') {
    return errorResponse('Un docente debe indicar la clase (scheduleId) para registrar un estudiante', 400);
  }

  const inheritedLab = scheduleForEnroll?.labCode;
  const studentLab = data.lab || inheritedLab || '';
  if (actor.role === 'docente' && !studentLab) {
    return errorResponse('El laboratorio es requerido (o indica la clase para heredarlo)', 400);
  }

  // El estudiante hereda el laboratorio (y labs permitidos) de la clase del
  // docente cuando existe; si no, el lab queda vacío hasta su inscripción.
  // Los permisos de acceso por horario se derivan de los Schedules en los que
  // queda inscrito (canAccessLab valida día + ventana + clase en curso).
  const studentId = data.id || `student-${uuidv4().slice(0, 8)}`;
  const inheritedLabs = inheritedLab && (!data.labs || data.labs.length === 0)
    ? [inheritedLab]
    : data.labs;
  const student = await Student.create({
    ...data,
    id: studentId,
    lab: studentLab || data.lab || 'LAB-02',
    labs: inheritedLabs,
  });

  // Fase 3: el registro del estudiante otorga el consentimiento biométrico
  // (quién, cuándo, lab, versión y expiración).
  const { grantConsent } = await import('./consent.ts');
  await grantConsent(studentId, actor, student.lab);

  // Inscripción automática en la clase del docente (F1).
  if (scheduleForEnroll) {
    const existing = await Enrollment.findOne({ scheduleId: scheduleForEnroll.id, studentId });
    if (!existing) {
      await Enrollment.create({
        id: newEnrollmentId(),
        scheduleId: scheduleForEnroll.id,
        studentId,
        active: true,
      });
    }
  }

  await recordAudit({
    ...auditContext(actor, req),
    action: 'student.create',
    targetType: 'student',
    targetId: studentId,
    details: scheduleForEnroll
      ? `Registrado estudiante ${data.name} e inscrito en ${scheduleForEnroll.subject} (${scheduleForEnroll.labCode}) ${scheduleForEnroll.startTime}-${scheduleForEnroll.endTime}`
      : `Registrado estudiante ${data.name}`,
    after: JSON.stringify({ lab: student.lab, scheduleId: data.scheduleId || null }),
  });

  const freshStudent = await Student.findOne({ id: studentId });
  return jsonResponse(freshStudent ?? student, 201);
}

/** Verifica que el docente tenga inscrito al estudiante en alguna de sus clases. */
async function teacherOwnsStudent(teacherId: string, studentId: string): Promise<boolean> {
  const scheduleIds = await getTeacherScheduleIds(teacherId);
  if (scheduleIds.length === 0) return false;
  const enrollment = await Enrollment.findOne({ studentId, scheduleId: { $in: scheduleIds }, active: true });
  return !!enrollment;
}

export async function handleUpdateStudent(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (await mutationRateLimited(req, 'student')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const { id, ...updates } = await req.json() as { id: string; [key: string]: unknown };

  if (!id) {
    return errorResponse('ID del estudiante requerido', 400);
  }

  if (actor.role === 'docente') {
    const owns = await teacherOwnsStudent(actor.userId, id);
    if (!owns) return errorResponse('No puedes modificar estudiantes que no son de tus clases', 403);
    // Un docente no puede cambiar laboratorio, roles ni datos sensibles de ficha.
    const protectedFields = ['lab', 'labs', 'status', 'faceEmbeddingId', 'photoKey', 'photoUrl'];
    const attempted = protectedFields.filter(k => k in updates);
    if (attempted.length > 0) {
      return errorResponse(`Un docente no puede modificar: ${attempted.join(', ')}`, 403);
    }
    await Student.findOneAndUpdate({ id }, { $set: updates }, { new: true });
    await recordAudit({
      ...auditContext(actor, req),
      action: 'student.update',
      targetType: 'student',
      targetId: id,
      details: 'Docente actualizó datos del estudiante',
      before: undefined,
      after: JSON.stringify(updates),
    });
    return jsonResponse(await Student.findOne({ id }));
  }

  const student = await Student.findOneAndUpdate({ id }, { $set: updates }, { new: true });
  if (!student) {
    return errorResponse('Estudiante no encontrado', 404);
  }
  return jsonResponse(student);
}

export async function handleToggleStudent(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (await mutationRateLimited(req, 'student')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const { id } = await req.json() as { id: string };

  if (!id) {
    return errorResponse('ID del estudiante requerido', 400);
  }

  if (actor.role === 'docente') {
    const owns = await teacherOwnsStudent(actor.userId, id);
    if (!owns) return errorResponse('No puedes modificar estudiantes que no son de tus clases', 403);
  }

  const student = await Student.findOne({ id });
  if (!student) {
    return errorResponse('Estudiante no encontrado', 404);
  }

  student.status = student.status === 'allowed' ? 'denied' : 'allowed';
  await student.save();

  await recordAudit({
    ...auditContext(actor, req),
    action: 'student.toggle',
    targetType: 'student',
    targetId: id,
    details: `Estudiante ${student.name} ${student.status === 'allowed' ? 'habilitado' : 'suspendido'}`,
    before: student.status === 'allowed' ? 'denied' : 'allowed',
    after: student.status,
  });

  return jsonResponse(student);
}

export async function handleDeleteStudent(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (await mutationRateLimited(req, 'student')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const { id } = await req.json() as { id: string };

  if (!id) {
    return errorResponse('ID del estudiante requerido', 400);
  }

  if (actor.role === 'docente') {
    const owns = await teacherOwnsStudent(actor.userId, id);
    if (!owns) return errorResponse('No puedes eliminar estudiantes que no son de tus clases', 403);
  }

  const student = await Student.findOne({ id });
  if (!student) {
    return errorResponse('Estudiante no encontrado', 404);
  }

  // Fase 3: eliminación completa (MongoDB + S3 + Rekognition + evidencias +
  // accesos + incidentes + asistencia + inscripciones + historial de consentimiento).
  const { deleteStudentData } = await import('./consent.ts');
  await deleteStudentData(student);

  await recordAudit({
    ...auditContext(actor, req),
    action: 'student.delete',
    targetType: 'student',
    targetId: id,
    details: `Eliminado estudiante ${student.name}`,
    before: JSON.stringify({ name: student.name, career: student.career }),
  });

  return jsonResponse({ ok: true, message: 'Estudiante eliminado' });
}

/**
 * Revoca los datos biométricos del estudiante (Fase 3): borra la foto (S3) y
 * el embedding (Rekognition), deja la ficha académica intacta y registra el
 * evento de consentimiento. Solo admin o el docente propietario.
 */
export async function handleRevokeBiometric(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (await mutationRateLimited(req, 'student')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const { id } = await req.json() as { id?: string };
  if (!id) return errorResponse('ID del estudiante requerido', 400);

  if (actor.role === 'docente') {
    const owns = await teacherOwnsStudent(actor.userId, id);
    if (!owns) return errorResponse('No puedes revocar la biometría de estudiantes que no son de tus clases', 403);
  }

  const student = await Student.findOne({ id });
  if (!student) return errorResponse('Estudiante no encontrado', 404);

  const { revokeBiometric } = await import('./consent.ts');
  await revokeBiometric(student, actor);

  await recordAudit({
    ...auditContext(actor, req),
    action: 'student.biometric_revoke',
    targetType: 'student',
    targetId: id,
    details: `Revocados datos biométricos de ${student.name} (foto S3 + embedding Rekognition)`,
  });

  const updated = await Student.findOne({ id });
  return jsonResponse({ ok: true, student: updated });
}

/** Historial de consentimiento biométrico del estudiante. */
export async function handleGetConsentLogs(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  const url = new URL(req.url);
  const studentId = url.searchParams.get('studentId');
  if (!studentId) return errorResponse('studentId requerido', 400);

  await connectDB();
  if (actor.role === 'docente') {
    const owns = await teacherOwnsStudent(actor.userId, studentId);
    if (!owns) return errorResponse('No puedes ver el historial de estudiantes ajenos a tus clases', 403);
  }

  const { getConsentHistory } = await import('./consent.ts');
  const logs = await getConsentHistory(studentId);
  return jsonResponse(logs.map(l => ({
    id: l.id,
    action: l.action,
    version: l.version,
    labCode: l.labCode,
    grantedBy: l.grantedBy,
    expiresAt: l.expiresAt,
    createdAt: l.createdAt,
  })));
}

export async function handleGetLogs(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  await connectDB();

  const url = new URL(req.url);
  const filters: Record<string, unknown> = {};
  const lab = url.searchParams.get('lab');
  const teacherId = url.searchParams.get('teacherId');
  const subject = url.searchParams.get('subject');
  const scheduleId = url.searchParams.get('scheduleId');
  const date = url.searchParams.get('date');
  const studentId = url.searchParams.get('studentId');
  const result = url.searchParams.get('result');
  const reason = url.searchParams.get('reason');
  const kiosk = url.searchParams.get('kiosk');
  const parallel = url.searchParams.get('parallel');
  const academicTerm = url.searchParams.get('academicTerm');
  const limitParam = url.searchParams.get('limit');
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(parseInt(limitParam || '100', 10) || 100, 500);

  if (lab) filters.labCode = lab;
  if (date) filters.date = { $regex: date };
  if (studentId) filters.studentId = studentId;
  if (result) filters.result = result as 'Permitido' | 'Denegado';
  if (reason) filters.reason = reason;
  if (kiosk) filters.kioskId = kiosk;
  if (scheduleId) filters.scheduleId = scheduleId;

  // F3: un docente solo ve el historial de sus clases. Se resuelve el teacherId
  // a partir de sus clases y se restringe por scheduleId.
  if (actor.role === 'docente') {
    const scheduleIds = await getTeacherScheduleIds(actor.userId);
    if (scheduleIds.length === 0) return jsonResponse([]);
    filters.scheduleId = { $in: scheduleIds };
  } else if (teacherId && teacherId !== 'all') {
    // Admin/docente explícito: filtrar por el docente (mapea a sus clases).
    const scheduleIds = await getTeacherScheduleIds(teacherId);
    if (scheduleIds.length === 0) return jsonResponse([]);
    filters.scheduleId = { $in: scheduleIds };
  }
  if (subject && subject !== 'all') {
    const schedules = await Schedule.find({ subject: { $regex: subject, $options: 'i' } });
    const scheduleIds = schedules.map(s => s.id);
    if (scheduleIds.length === 0) return jsonResponse([]);
    filters.scheduleId = { $in: scheduleIds };
  }
  // Filtros por paralelo o período académico: resuelven los schedules candidatos.
  if ((parallel && parallel !== 'all') || (academicTerm && academicTerm !== 'all')) {
    const sFilter: Record<string, unknown> = {};
    if (parallel && parallel !== 'all') sFilter.parallel = parallel;
    if (academicTerm && academicTerm !== 'all') sFilter.academicTerm = academicTerm;
    const matched = await Schedule.find(sFilter).select('id');
    const matchedIds = matched.map(s => s.id);
    if (matchedIds.length === 0) return jsonResponse([]);
    if (typeof filters.scheduleId === 'object') {
      const existing = (filters.scheduleId as { $in?: string[] }).$in || [];
      filters.scheduleId = { $in: existing.filter(id => matchedIds.includes(id)) };
    } else {
      filters.scheduleId = { $in: matchedIds };
    }
  }

  // Paginación por cursor (ObjectId) para escalar con miles de registros.
  if (cursor) {
    try {
      const idFilter = await AccessLog.findById(cursor);
      if (idFilter) filters._id = { $lt: idFilter._id };
    } catch {
      return errorResponse('Cursor inválido', 400);
    }
  }

  const logs = await AccessLog.find(filters).sort({ _id: -1 }).limit(limit + 1);
  const hasMore = logs.length > limit;
  const page = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = page.length > 0 && hasMore ? page[page.length - 1]._id : null;

  return jsonResponse({ logs: page, nextCursor: nextCursor ? String(nextCursor) : null, hasMore });
}

export async function handleCreateLog(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const body = await req.json() as Record<string, unknown>;
  const log = await AccessLog.create({
    ...body,
    id: (body.id as string) || `log-${uuidv4().slice(0, 9)}`,
  });
  return jsonResponse(log, 201);
}

export async function handleGetStats(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  await connectDB();
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Docente: las estadísticas se limitan a sus clases (backend, nunca del cliente).
  if (actor.role === 'docente') {
    const scheduleIds = await getTeacherScheduleIds(actor.userId);
    let registered = 0;
    let todayAccesses = 0;
    let todayDenied = 0;
    let biometricsPending = 0;
    let myClasses = 0;

    if (scheduleIds.length > 0) {
      const enrollments = await Enrollment.find({ scheduleId: { $in: scheduleIds }, active: true });
      const studentIds = Array.from(new Set(enrollments.map(e => e.studentId)));
      const existingStudents = await Student.find({ id: { $in: studentIds } }).select('biometricStatus');
      registered = existingStudents.length;
      biometricsPending = existingStudents.filter(student => student.biometricStatus !== 'registered').length;
      myClasses = scheduleIds.length;
      const todayLogs = await AccessLog.find({ date: today, scheduleId: { $in: scheduleIds } });
      todayAccesses = todayLogs.filter(l => l.result === 'Permitido').length;
      todayDenied = todayLogs.filter(l => l.result === 'Denegado').length;
    }

    const alertsActive = await Alert.countDocuments({ status: 'active' });

    return jsonResponse({
      registered,
      accessesToday: todayAccesses,
      deniedToday: todayDenied,
      alertsActive,
      myClasses,
      biometricsPending,
      scope: 'docente',
    });
  }

  const [registered, todayLogs] = await Promise.all([
    Student.countDocuments(),
    AccessLog.find({ date: today }),
  ]);

  const todayAccesses = todayLogs.filter(l => l.result === 'Permitido').length;
  const todayDenied = todayLogs.filter(l => l.result === 'Denegado').length;
  const alertsActive = await Alert.countDocuments({ status: 'active' });
  const biometricsPending = await Student.countDocuments({ biometricStatus: { $ne: 'registered' } });

  return jsonResponse({
    registered,
    accessesToday: todayAccesses,
    deniedToday: todayDenied,
    alertsActive,
    biometricsPending,
    scope: 'admin',
  });
}

export async function handleGetAlerts(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (actor.role !== 'admin' && actor.role !== 'docente') {
    return errorResponse('Acceso restringido', 403);
  }

  await connectDB();
  const alerts = await Alert.find().sort({ createdAt: -1 }).limit(50);
  return jsonResponse(alerts.map(alert => ({
    ...alert.toObject(),
    id: alert.id || String(alert._id),
  })));
}

export async function handleUpdateAlert(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (actor.role !== 'admin' && actor.role !== 'docente') {
    return errorResponse('Acceso restringido', 403);
  }

  await connectDB();
  const { id, status } = await req.json() as { id: string; status: string };

  if (!id || !['active', 'acknowledged', 'resolved'].includes(status)) {
    return errorResponse('ID y status válido son requeridos', 400);
  }

  const alert = await Alert.findOneAndUpdate(
    alertIdentifierFilter(id),
    { $set: { status } },
    { new: true }
  );

  if (!alert) {
    return errorResponse('Alerta no encontrada', 404);
  }
  await recordAudit({
    ...auditContext(actor, req),
    action: 'alert.status.update',
    targetType: 'alert',
    targetId: id,
    details: `Estado de alerta actualizado a ${status}`,
    after: status,
  });
  return jsonResponse({
    ...alert.toObject(),
    id: alert.id || String(alert._id),
  });
}

export async function handleGetStudentsPublic(_req?: Request): Promise<Response> {
  const { jsonResponse } = await import('./auth.ts');
  await connectDB();
  // El kiosco necesita el mínimo de datos para el match biométrico y la pantalla.
  const students = await Student.find().select('id name career lab photoUrl matchPercentage status biometricStatus avatarInitials').sort({ createdAt: -1 });
  return jsonResponse(students);
}

export async function handleCreateLogPublic(req: Request): Promise<Response> {
  const { jsonResponse } = await import('./auth.ts');
  const { Metrics } = await import('./cloudwatch.ts');
  const { publishAlert } = await import('./sns.ts');

  await connectDB();
  const body = await req.json() as Record<string, unknown>;
  const log = await AccessLog.create({
    ...body,
    id: (body.id as string) || `log-${uuidv4().slice(0, 9)}`,
  });

  if (log.result === 'Permitido') {
    Metrics.accessGranted();
  } else {
    Metrics.accessDenied();

    const recentDenials = await AccessLog.countDocuments({
      result: 'Denegado',
      similarity: { $lt: 99 },
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    });

    const suspicious = recentDenials >= 3;

    if (suspicious) {
      await publishAlert(
        'ALERTA: Accesos denegados repetidos',
        `Se detectaron ${recentDenials} intentos de acceso denegado en los últimos 10 minutos.\nKiosco: ${log.kioskId || 'Kiosk-042'}\nHora: ${log.time} ${log.date}`
      );

      await Alert.create({
        id: `alert-${uuidv4().slice(0, 8)}`,
        severity: 'critical',
        source: 'Kiosk',
        message: `ALERTA_ACCESOS_DENEGADOS: ${recentDenials} intentos fallidos en los últimos 10 minutos.`,
        timestamp: new Date().toISOString(),
        status: 'active',
      });
    }
  }

  return jsonResponse(log, 201);
}

export async function handleGetAuditLogs(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }

  await connectDB();

  // Paginación server-side: la UI pide solo una página (por defecto 10) y el
  // buscador viaja como filtro en la consulta, sin traer todo el historial.
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10) || 10));
  const search = (url.searchParams.get('q') || '').trim();

  const result = await getAuditLogsPage(page, pageSize, search);
  return jsonResponse(result);
}

// ── Schedules (planificación de clases) ──────────────────────────────────

export async function handleGetSchedules(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  await connectDB();

  // F2: un docente solo ve sus propias clases.
  const filter = actor.role === 'docente' ? { teacherId: actor.userId } : {};
  const docs = await Schedule.find(filter).sort({ dayOfWeek: 1, startTime: 1 });
  return jsonResponse(docs.map(d => ({
    id: d.id,
    subject: d.subject,
    teacherId: d.teacherId,
    labCode: d.labCode,
    dayOfWeek: d.dayOfWeek,
    startTime: d.startTime,
    endTime: d.endTime,
    active: d.active,
    status: d.status ?? 'programada',
    parallel: d.parallel,
    campus: d.campus,
    academicTerm: d.academicTerm,
    deliveryMode: d.deliveryMode ?? 'presencial',
    requiresPhysicalAccess: d.requiresPhysicalAccess ?? true,
    activeKiosk: d.activeKiosk ?? true,
    createdAt: d.createdAt,
  })));
}

export async function handleCreateSchedule(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (actor.role !== 'admin') return errorResponse('Acceso restringido a administradores', 403);
  if (await mutationRateLimited(req, 'schedule')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const body = await req.json() as Record<string, unknown>;
  const parsed = scheduleCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const d = parsed.data;

  const lab = await Lab.findOne({ code: d.labCode });
  if (!lab) return errorResponse('Laboratorio no encontrado', 404);

  if (d.academicTerm) {
    const term = await AcademicTerm.findOne({ code: d.academicTerm });
    if (!term) return errorResponse(`Período académico ${d.academicTerm} no encontrado`, 404);
  }

  const schedule = await Schedule.create({
    id: newScheduleId(),
    subject: d.subject,
    teacherId: d.teacherId,
    labCode: d.labCode,
    dayOfWeek: d.dayOfWeek,
    startTime: d.startTime,
    endTime: d.endTime,
    active: d.active ?? true,
    status: d.status ?? 'programada',
    parallel: d.parallel,
    campus: d.campus,
    academicTerm: d.academicTerm,
    deliveryMode: d.deliveryMode ?? 'presencial',
    requiresPhysicalAccess: d.requiresPhysicalAccess ?? true,
    activeKiosk: d.activeKiosk ?? true,
  });

  await recordAudit({
    ...auditContext(actor, req),
    action: 'schedule.create',
    targetType: 'schedule',
    targetId: schedule.id,
    details: `Creada clase ${schedule.subject} en ${schedule.labCode}`,
    after: JSON.stringify({ subject: schedule.subject, labCode: schedule.labCode }),
  });

  return jsonResponse({ schedule }, 201);
}

export async function handleUpdateSchedule(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (await mutationRateLimited(req, 'schedule')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const body = await req.json() as Record<string, unknown>;

  const parsed = scheduleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const { id, ...updates } = parsed.data;

  const schedule = await Schedule.findOne({ id });
  if (!schedule) return errorResponse('Clase no encontrada', 404);

  // F1/F2: un docente solo puede iniciar/finalizar/cancelar sesión en sus clases,
  // nunca modificar laboratorio, horario ni docente asignado.
  if (actor.role === 'docente') {
    if (schedule.teacherId !== actor.userId) {
      return errorResponse('Solo puedes gestionar tus propias clases', 403);
    }
    const protectedKeys = ['subject', 'teacherId', 'labCode', 'dayOfWeek', 'startTime', 'endTime'];
    if (protectedKeys.some(k => k in updates)) {
      return errorResponse('Un docente no puede modificar materia, laboratorio ni horario', 403);
    }
    if (!updates.status) {
      return errorResponse('Un docente solo puede cambiar el estado de sesión de la clase', 400);
    }
  }

  // A7: la cancelación es terminal; una clase cancelada no se puede re-iniciar
  // ni modificar.
  if (schedule.status === 'cancelada') {
    return errorResponse('Una clase cancelada no puede modificarse', 400);
  }

  const updated = await Schedule.findOneAndUpdate({ id }, { $set: updates }, { new: true });
  if (!updated) return errorResponse('Clase no encontrada', 404);

  // F10: al finalizar la clase, marcar ausentes a los que no registraron asistencia.
  if (updates.status === 'finalizada') {
    try {
      const marked = await markAbsentees(id);
      if (marked > 0) {
        console.log(`[Attendance] ${marked} ausentes marcados al finalizar ${updated.subject}`);
      }
    } catch (e) {
      console.error('[Attendance] Error marcando ausentes:', e);
    }
  }

  await recordAudit({
    ...auditContext(actor, req),
    action: updates.status === 'cancelada' ? 'schedule.cancel' : 'schedule.update',
    targetType: 'schedule',
    targetId: id,
    details: `Clase ${updated.subject} ${updates.status ? `→ estado ${updates.status}` : 'actualizada'}`,
    before: JSON.stringify({ status: schedule.status }),
    after: JSON.stringify({ status: updated.status }),
  });

  return jsonResponse({ schedule: updated });
}

export async function handleDeleteSchedule(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (actor.role !== 'admin') return errorResponse('Acceso restringido a administradores', 403);
  if (await mutationRateLimited(req, 'schedule')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const { id } = await req.json() as { id?: string };
  if (!id) return errorResponse('ID de la clase requerido', 400);

  const target = await Schedule.findOne({ id });
  await Enrollment.deleteMany({ scheduleId: id });
  const deleted = await Schedule.findOneAndDelete({ id });
  if (!deleted) return errorResponse('Clase no encontrada', 404);

  await recordAudit({
    ...auditContext(actor, req),
    action: 'schedule.delete',
    targetType: 'schedule',
    targetId: id,
    details: `Eliminada clase ${target?.subject ?? id}`,
    before: JSON.stringify({ subject: target?.subject, labCode: target?.labCode }),
  });

  return jsonResponse({ ok: true, message: 'Clase eliminada' });
}

// ── Enrollments (estudiante ↔ clase) ─────────────────────────────────────

export async function handleGetEnrollments(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  await connectDB();

  // F2: un docente solo ve las inscripciones de sus clases.
  const filter = actor.role === 'docente'
    ? { scheduleId: { $in: await getTeacherScheduleIds(actor.userId) } }
    : {};
  const docs = await Enrollment.find(filter).sort({ createdAt: -1 });
  const existingStudentIds = new Set(await getExistingStudentIds(docs.map(d => d.studentId)));
  return jsonResponse(docs.map(d => ({
    id: d.id,
    scheduleId: d.scheduleId,
    studentId: d.studentId,
    active: d.active,
    createdAt: d.createdAt,
  })).filter(d => existingStudentIds.has(d.studentId)));
}

export async function handleCreateEnrollment(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (await mutationRateLimited(req, 'enrollment')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const body = await req.json() as Record<string, unknown>;
  const parsed = enrollmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const { scheduleId, studentId } = parsed.data;

  // F1: un docente solo puede inscribir en sus propias clases.
  const schedule = await Schedule.findOne({ id: scheduleId });
  if (!schedule) return errorResponse('Clase no encontrada', 404);
  if (actor.role === 'docente' && schedule.teacherId !== actor.userId) {
    return errorResponse('Solo puedes inscribir estudiantes en tus propias clases', 403);
  }
  const student = await Student.findOne({ id: studentId }).select('id');
  if (!student) return errorResponse('Estudiante no encontrado', 404);

  const existing = await Enrollment.findOne({ scheduleId, studentId });
  if (existing) return errorResponse('El estudiante ya está inscrito en esta clase', 409);

  const enrollment = await Enrollment.create({ id: newEnrollmentId(), scheduleId, studentId, active: true });

  await recordAudit({
    ...auditContext(actor, req),
    action: 'enrollment.create',
    targetType: 'enrollment',
    targetId: enrollment.id,
    details: `Estudiante ${studentId} inscrito en ${schedule.subject} (${schedule.labCode})`,
    after: JSON.stringify({ scheduleId, studentId }),
  });

  return jsonResponse({ enrollment }, 201);
}

export async function handleDeleteEnrollment(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (await mutationRateLimited(req, 'enrollment')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const { id } = await req.json() as { id?: string };
  if (!id) return errorResponse('ID de la inscripción requerido', 400);

  const enrollment = await Enrollment.findOne({ id });
  if (!enrollment) return errorResponse('Inscripción no encontrada', 404);

  // F1: un docente solo puede eliminar inscripciones de sus clases.
  if (actor.role === 'docente') {
    const schedule = await Schedule.findOne({ id: enrollment.scheduleId });
    if (!schedule || schedule.teacherId !== actor.userId) {
      return errorResponse('Solo puedes gestionar inscripciones de tus propias clases', 403);
    }
  }

  await Enrollment.deleteOne({ id });

  await recordAudit({
    ...auditContext(actor, req),
    action: 'enrollment.delete',
    targetType: 'enrollment',
    targetId: id,
    details: `Inscripción eliminada de la clase ${enrollment.scheduleId}`,
    before: JSON.stringify({ scheduleId: enrollment.scheduleId, studentId: enrollment.studentId }),
  });

  return jsonResponse({ ok: true, message: 'Inscripción eliminada' });
}


// ── Evidencia de accesos denegados ───────────────────────────────────────

export async function handleCreateEvidence(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import("./auth.ts");
  const { publishAlert } = await import("./sns.ts");
  const { uploadImage } = await import("./s3.ts");

  const body = await req.json() as Record<string, unknown>;
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : null;
  const { reason, confidence, date, time, labCode, kioskId, studentId } = body as {
    reason?: string; confidence?: number; date?: string; time?: string;
    labCode?: string; kioskId?: string; studentId?: string;
  };

  if (!imageBase64 || !reason) {
    return errorResponse("imageBase64 y reason son requeridos", 400);
  }

  // Subir la foto de evidencia al bucket S3 privado.
  const photoKey = `evidence/${new Date().toISOString().slice(0, 10)}/${uuidv4()}.jpg`;
  await uploadImage(photoKey, imageBase64);

  await connectDB();
  const { incident } = await recordDenialEvidence({
    photoKey,
    reason,
    confidence: confidence ?? 0,
    date: date || "",
    time: time || "",
    labCode,
    kioskId,
    studentId,
  });

  if (incident.incidentCreated) {
    await publishAlert(
      "ALERTA DE SEGURIDAD: Incidente de accesos denegados",
      `Se abrio un incidente de seguridad: ${incident.count} rechazos en la ventana configurada.\n` +
        `Kiosco: ${kioskId || "Kiosk-042"}\nLaboratorio: ${labCode || "-"}\n` +
        `Motivo: ${reason}\nIncidente: ${incident.incidentId}`
    );
  }

  return jsonResponse({ ok: true, incident, photoKey }, 201);
}

export async function handleGetEvidence(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import("./auth.ts");
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse("No autorizado", 401);

  await connectDB();

  // F2: un docente solo ve evidencias vinculadas a sus clases (por estudiante).
  let filter: Record<string, unknown> = {};
  if (actor.role === 'docente') {
    const scheduleIds = await getTeacherScheduleIds(actor.userId);
    if (scheduleIds.length === 0) return jsonResponse([]);
    const enrollments = await Enrollment.find({ scheduleId: { $in: scheduleIds }, active: true });
    const studentIds = await getExistingStudentIds(enrollments.map(e => e.studentId));
    filter = { studentId: { $in: studentIds } };
  }

  const docs = await DenialEvidence.find(filter).sort({ createdAt: -1 }).limit(100);
  return jsonResponse(docs.map(d => ({
    id: d.id,
    photoKey: d.photoKey,
    reason: d.reason,
    confidence: d.confidence,
    date: d.date,
    time: d.time,
    labCode: d.labCode,
    kioskId: d.kioskId,
    studentId: d.studentId,
    createdAt: d.createdAt,
  })));
}

export async function handleGetEvidencePhoto(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import("./auth.ts");
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse("No autorizado", 401);

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return errorResponse("key requerido", 400);

  try {
    const { canReadPhoto } = await import('./photo-access.ts');
    await connectDB();
    if (!(await canReadPhoto(actor, key))) {
      return errorResponse('Acceso restringido', 403);
    }
    const presigned = await getPresignedUrl(key, 3600);
    return jsonResponse({ url: presigned });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "No se pudo generar la URL", 500);
  }
}

// ── Incidentes de seguridad ──────────────────────────────────────────────

export async function handleGetIncidents(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import("./auth.ts");
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse("No autorizado", 401);

  await connectDB();

  // F2: un docente solo ve incidentes de sus clases (por estudiante involucrado).
  let filter: Record<string, unknown> = {};
  if (actor.role === 'docente') {
    const scheduleIds = await getTeacherScheduleIds(actor.userId);
    if (scheduleIds.length === 0) return jsonResponse([]);
    const enrollments = await Enrollment.find({ scheduleId: { $in: scheduleIds }, active: true });
    const studentIds = await getExistingStudentIds(enrollments.map(e => e.studentId));
    filter = { studentId: { $in: studentIds } };
  }

  const docs = await Incident.find(filter).sort({ createdAt: -1 }).limit(100);
  return jsonResponse(docs.map(d => ({
    id: d.id,
    type: d.type,
    status: d.status,
    reason: d.reason,
    labCode: d.labCode,
    kioskId: d.kioskId,
    studentId: d.studentId,
    evidenceIds: d.evidenceIds,
    count: d.count,
    windowMinutes: d.windowMinutes,
    firstSeen: d.firstSeen,
    lastSeen: d.lastSeen,
    closedAt: d.closedAt,
    createdAt: d.createdAt,
  })));
}

export async function handleUpdateIncident(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import("./auth.ts");
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse("No autorizado", 401);
  if (actor.role !== 'admin') return errorResponse("Acceso restringido a administradores", 403);
  if (await mutationRateLimited(req, 'incident')) return errorResponse("Demasiadas solicitudes. Espera un minuto.", 429);

  await connectDB();
  const body = await req.json() as Record<string, unknown>;
  const parsed = incidentCloseSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Datos invalidos", 400);

  const incident = await Incident.findOneAndUpdate(
    { id: parsed.data.id },
    { $set: { status: "closed", closedAt: new Date() } },
    { new: true }
  );
  if (!incident) return errorResponse("Incidente no encontrado", 404);

  await recordAudit({
    ...auditContext(actor, req),
    action: 'incident.close',
    targetType: 'incident',
    targetId: incident.id,
    details: `Cerrado incidente de seguridad (${incident.count} rechazos)`,
    before: 'open',
    after: 'closed',
  });

  return jsonResponse({ ok: true, incident });
}

// ── Control de asistencia (Funcionalidad 5) ──────────────────────────────

export async function handleCreateAttendance(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  await connectDB();
  const body = await req.json() as Record<string, unknown>;

  const parsed = attendanceCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const { studentId, scheduleId, subject, labCode, teacherId, status } = parsed.data;

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');

  const attendance = await Attendance.create({
    id: `att-${uuidv4().slice(0, 8)}`,
    studentId,
    scheduleId,
    subject,
    labCode,
    teacherId,
    status,
    date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    createdAt: now,
  });

  return jsonResponse(attendance, 201);
}

export async function handleGetAttendance(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse("No autorizado", 401);

  await connectDB();

  // F2: un docente solo ve la asistencia de sus clases.
  const filter: Record<string, unknown> = {};
  if (actor.role === 'docente') {
    const scheduleIds = await getTeacherScheduleIds(actor.userId);
    if (scheduleIds.length === 0) return jsonResponse([]);
    filter.scheduleId = { $in: scheduleIds };
  }

  const docs = await Attendance.find(filter).sort({ createdAt: -1 }).limit(300);
  return jsonResponse(docs.map(d => ({
    id: d.id,
    studentId: d.studentId,
    scheduleId: d.scheduleId,
    subject: d.subject,
    labCode: d.labCode,
    teacherId: d.teacherId,
    status: d.status,
    date: d.date,
    time: d.time,
    createdAt: d.createdAt,
  })));
}

// ── Sesión del kiosco (Funcionalidad 7) ──────────────────────────────────

export async function handleGetKioskSession(req: Request): Promise<Response> {
  const { jsonResponse } = await import('./auth.ts');
  await connectDB();

  // Observabilidad: alerta por kiosco sin actividad (throttle interno).
  void import('./monitoring.ts').then(({ checkKioskInactivity }) => checkKioskInactivity());

  const url = new URL(req.url);
  // La ubicación física no se acepta desde el navegador. Se resuelve con la
  // misma configuración server-side usada para crear el intento del kiosco.
  void url;
  const labCode = process.env.KIOSK_LAB || process.env.NEXT_PUBLIC_KIOSK_LAB || 'LAB-02';
  if (!labCode) return jsonResponse({ session: null });

    const day = new Date().getDay();
    const now = new Date();
    const schedules = await getSchedulesForLab(labCode, true).then(list =>
      list.filter(s => s.dayOfWeek === day && isClassNow(s, now) && s.activeKiosk !== false)
    );

  if (schedules.length === 0) return jsonResponse({ session: null });

  const schedule = schedules[0];
  const teacher = schedule.teacherId ? await User.findById(schedule.teacherId) : null;

  return jsonResponse({
    session: {
      subject: schedule.subject,
      teacherName: teacher?.name || null,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: schedule.status ?? 'programada',
    },
  });
}

// ── Reportes académicos (Funcionalidad 6) ────────────────────────────────

export async function handleGetAttendanceReport(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  await connectDB();
  const report = await getAttendanceReport(actor.role === 'docente' ? actor.userId : undefined);
  return jsonResponse(report);
}

export async function handleExportAttendanceReport(req: Request): Promise<Response> {
  const { errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  await connectDB();
  const report = await getAttendanceReport(actor.role === 'docente' ? actor.userId : undefined);

  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'excel';

  const esc = (v: unknown) => String(v ?? '').replace(/"/g, '""');
  const dateStr = new Date().toISOString().slice(0, 10);

  if (format === 'excel') {
    const rows: string[] = [];
    rows.push('Reporte de Asistencia - FaceAccess Lab');
    rows.push('Materia,Docente,Lab,Inscritos,Presentes,Ausentes,% Asistencia');
    report.byClass.forEach(r => rows.push(
      `"${esc(r.subject)}","${esc(r.teacherName)}",${esc(r.labCode)},${r.expected},${r.present},${r.absent},${r.attendanceRate}`
    ));
    rows.push('');
    rows.push('Alumnos con más rechazos');
    rows.push('Estudiante,Cantidad');
    report.topDenials.forEach(t => rows.push(`"${esc(t.studentName)}",${t.count}`));
    rows.push('');
    rows.push('Incidentes por laboratorio');
    rows.push('Laboratorio,Abiertos,Cerrados');
    report.incidentsByLab.forEach(i => rows.push(`${esc(i.labCode)},${i.open},${i.closed}`));

    const csv = '\uFEFF' + rows.join('\r\n');
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="asistencia-${dateStr}.csv"`,
      },
    });
  }

  // PDF: documento HTML imprimible con formato institucional.
  const rowsHtml = report.byClass.map(r => `
    <tr>
      <td>${esc(r.subject)}</td>
      <td>${esc(r.teacherName)}</td>
      <td>${esc(r.labCode)}</td>
      <td class="num">${r.expected}</td>
      <td class="num">${r.present}</td>
      <td class="num">${r.absent}</td>
      <td class="num">${r.attendanceRate}%</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<title>Reporte de Asistencia - FaceAccess Lab</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #18181b; margin: 40px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 2px solid #18181b; padding-bottom: 4px; }
  p.sub { color: #71717a; font-size: 12px; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e4e4e7; }
  th { background: #f4f4f5; font-size: 11px; text-transform: uppercase; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  footer { margin-top: 32px; font-size: 10px; color: #a1a1aa; }
</style></head>
<body>
  <h1>Reporte de Asistencia</h1>
  <p class="sub">FaceAccess Lab · Generado ${new Date().toLocaleString('es-EC')} · Tiempo promedio de reconocimiento: ${report.avgRecognitionMs ? Math.round(report.avgRecognitionMs) + ' ms' : '—'}</p>
  <h2>Asistencia por clase</h2>
  <table>
    <thead><tr><th>Materia</th><th>Docente</th><th>Lab</th><th class="num">Inscritos</th><th class="num">Presentes</th><th class="num">Ausentes</th><th class="num">% Asist.</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="7">Sin datos</td></tr>'}</tbody>
  </table>
  <footer>Reporte generado automáticamente por FaceAccess Lab.</footer>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="asistencia-${dateStr}.html"`,
    },
  });
}

// ── Dashboard del laboratorio (Funcionalidad 4) ──────────────────────────

export async function handleGetLabDashboard(req: Request, labCode: string): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (actor.role !== 'admin' && actor.role !== 'docente') {
    return errorResponse('Acceso restringido', 403);
  }

  if (!labCode) return errorResponse('Código de laboratorio requerido', 400);

  await connectDB();
  if (actor.role === 'docente') {
    const ownsLab = await Schedule.exists({ teacherId: actor.userId, labCode });
    if (!ownsLab) return errorResponse('No puedes consultar laboratorios ajenos a tus clases', 403);
  }
  const dashboard = await getLabDashboard(labCode);
  return jsonResponse(dashboard);
}

// ── Períodos académicos (AcademicTerm) ───────────────────────────────────

export async function handleGetAcademicTerms(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  await connectDB();
  const terms = await AcademicTerm.find().sort({ code: -1 });
  return jsonResponse(terms.map(t => ({
    id: t.id,
    code: t.code,
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate,
    isActive: t.isActive,
    createdAt: t.createdAt,
  })));
}

export async function handleCreateAcademicTerm(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);
  if (actor.role !== 'admin') return errorResponse('Acceso restringido a administradores', 403);
  if (await mutationRateLimited(req, 'term')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const body = await req.json() as Record<string, unknown>;
  const parsed = academicTermCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(first ? first.message : 'Datos inválidos', 400);
  }
  const { code, name, startDate, endDate, isActive } = parsed.data;

  const existing = await AcademicTerm.findOne({ code });
  if (existing) {
    return errorResponse(`El período académico ${code} ya existe`, 409);
  }

  const term = await AcademicTerm.create({
    id: `term-${uuidv4().slice(0, 8)}`,
    code,
    name,
    startDate,
    endDate,
    isActive: isActive ?? true,
  });

  await recordAudit({
    ...auditContext(actor, req),
    action: 'term.create',
    targetType: 'academicTerm',
    targetId: term.id,
    details: `Creado período académico ${code} (${name})`,
  });

  return jsonResponse(term, 201);
}

// ── Registro biométrico desde el panel (re-registro) ─────────────────────

/**
 * Actualiza el Student tras registrar su biometría (foto en S3 + cara en
 * Rekognition). Permite que el docente marque como 'registered' a sus propios
 * estudiantes sin exponer los campos protegidos vía PUT /api/students.
 */
export async function handleRegisterBiometric(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const { indexFace } = await import('./rekognition.ts');
  const { uploadImage } = await import('./s3.ts');

  const actor = await tryAuthenticate(req);
  if (!actor || (actor.role !== 'admin' && actor.role !== 'docente')) {
    return errorResponse('Acceso restringido a administradores y docentes', 403);
  }
  if (await mutationRateLimited(req, 'biometric')) return errorResponse('Demasiadas solicitudes. Espera un minuto.', 429);

  await connectDB();
  const body = await req.json() as {
    studentId?: string;
    imageBase64?: string;
    photoUrl?: string;
    photoKey?: string;
    matchPercentage?: number;
  };

  const { studentId, imageBase64, photoUrl, photoKey } = body;
  if (!studentId || (!imageBase64 && !photoKey)) {
    return errorResponse('studentId e imagen son requeridos', 400);
  }

  const student = await Student.findOne({ id: studentId });
  if (!student) return errorResponse('Estudiante no encontrado', 404);

  // Un docente solo puede registrar biometría de sus propios estudiantes.
  if (actor.role === 'docente') {
    const owns = await teacherOwnsStudent(actor.userId, studentId);
    if (!owns) return errorResponse('No puedes registrar biometría de estudiantes que no son de tus clases', 403);
  }

  let faceId: string | null = null;
  let s3Url = photoUrl;
  let s3Key = photoKey;

  // Si se envía la imagen en base64, subir a S3 e indexar en Rekognition.
  if (imageBase64) {
    s3Key = `students/${studentId}.jpg`;
    await uploadImage(s3Key, imageBase64);
    s3Url = s3Key;

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));
    faceId = await indexFace(imageBytes, studentId);
    if (!faceId) {
      return errorResponse('No se detectó ningún rostro en la imagen. Verifica iluminación y encuadre.', 400);
    }
  }

  student.faceEmbeddingId = faceId || student.faceEmbeddingId;
  student.photoUrl = s3Url || student.photoUrl;
  student.photoKey = s3Key || student.photoKey;
  student.matchPercentage = typeof body.matchPercentage === 'number' ? body.matchPercentage : (student.matchPercentage || 85);
  student.biometricStatus = 'registered';
  student.biometricUpdatedAt = new Date();
  await student.save();

  // El consentimiento se renueva en cada captura facial (Fase 3).
  const { refreshConsent } = await import('./consent.ts');
  await refreshConsent(studentId, actor, student.lab);

  await recordAudit({
    ...auditContext(actor, req),
    action: 'student.biometric.register',
    targetType: 'student',
    targetId: studentId,
    details: `Biometría registrada para ${student.name} (faceId ${faceId || 'existente'})`,
    before: 'pending',
    after: 'registered',
  });

  return jsonResponse({
    ok: true,
    message: 'Biometría registrada correctamente',
    student: {
      id: student.id,
      name: student.name,
      biometricStatus: student.biometricStatus,
      faceEmbeddingId: student.faceEmbeddingId,
      photoUrl: student.photoUrl,
      matchPercentage: student.matchPercentage,
    },
  });
}

// ── Dashboard académico por rol ───────────────────────────────────────────

export async function handleGetDashboard(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  const actor = await tryAuthenticate(req);
  if (!actor) return errorResponse('No autorizado', 401);

  await connectDB();
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Docente: todo limitado a sus clases.
  if (actor.role === 'docente') {
    const scheduleIds = await getTeacherScheduleIds(actor.userId);
    if (scheduleIds.length === 0) {
      return jsonResponse({
        scope: 'docente',
        classes: 0,
        students: 0,
        biometricsPending: 0,
        todayAccesses: 0,
        todayDenied: 0,
        activeIncidents: 0,
        upcomingSchedules: [],
      });
    }

    const [schedules, enrollments, todayLogs] = await Promise.all([
      Schedule.find({ id: { $in: scheduleIds } }).sort({ dayOfWeek: 1, startTime: 1 }),
      Enrollment.find({ scheduleId: { $in: scheduleIds }, active: true }),
      AccessLog.find({ date: today, scheduleId: { $in: scheduleIds } }),
    ]);

    const studentIds = await getExistingStudentIds(enrollments.map(e => e.studentId));
    const students = await Student.find({ id: { $in: studentIds } });
    const incidents = await Incident.find({ studentId: { $in: studentIds }, status: 'open' });

    return jsonResponse({
      scope: 'docente',
      classes: schedules.length,
      // Cuenta únicamente estudiantes que existen y están matriculados en las
      // clases del docente; Enrollment huérfanos no alteran el KPI.
      students: students.length,
      biometricsPending: students.filter(s => s.biometricStatus !== 'registered').length,
      todayAccesses: todayLogs.filter(l => l.result === 'Permitido').length,
      todayDenied: todayLogs.filter(l => l.result === 'Denegado').length,
      activeIncidents: incidents.length,
      upcomingSchedules: schedules.map(s => ({
        id: s.id,
        subject: s.subject,
        labCode: s.labCode,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
      })),
    });
  }

  // Admin: estadísticas globales.
  const [students, schedules, logsToday, labs, incidents, docentes] = await Promise.all([
    Student.find(),
    Schedule.find(),
    AccessLog.find({ date: today }),
    Lab.find({ active: true }),
    Incident.find({ status: 'open' }),
    // status puede faltar en usuarios creados antes del campo → se tratan como activos.
    User.find({ role: 'docente', $or: [{ status: 'active' }, { status: { $exists: false } }] }),
  ]);

  const pendingBio = students.filter(s => s.biometricStatus !== 'registered').length;
  const classesActive = schedules.filter(s => s.status === 'en_curso').length;
  const labOccupancy = labs.map(l => ({
    code: l.code,
    name: l.name,
    activeClasses: schedules.filter(s => s.labCode === l.code && s.status === 'en_curso').length,
  }));

  return jsonResponse({
    scope: 'admin',
    docentes: docentes.length,
    students: students.length,
    labs: labs.length,
    classesTotal: schedules.length,
    classesActive,
    biometricsPending: pendingBio,
    todayAccesses: logsToday.filter(l => l.result === 'Permitido').length,
    todayDenied: logsToday.filter(l => l.result === 'Denegado').length,
    activeIncidents: incidents.length,
    labOccupancy,
  });
}
