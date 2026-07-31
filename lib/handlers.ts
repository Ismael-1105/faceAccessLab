import { connectDB } from './db.ts';
import { User, Student, AccessLog, Alert } from './models.ts';
import { hashPassword, comparePassword, generateToken, verifyToken, getTokenFromRequest } from './auth.ts';
import { v4 as uuidv4 } from 'uuid';
import { deleteImage } from './s3.ts';
import { deleteFace } from './rekognition.ts';

export async function handleLogin(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  await connectDB();

  const { email, password } = await req.json() as { email?: string; password?: string };
  if (!email || !password) {
    return errorResponse('Email y contraseña son requeridos', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return errorResponse('Credenciales inválidas', 401);
  }

  const validPassword = await comparePassword(password, user.passwordHash);
  if (!validPassword) {
    return errorResponse('Credenciales inválidas', 401);
  }

  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    studentId: user.studentId,
  });

  return jsonResponse({
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      studentId: user.studentId,
    },
  });
}

export async function handleRegister(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }

  await connectDB();

  const { email, password, name, role } = await req.json() as {
    email?: string; password?: string; name?: string; role?: string;
  };

  if (!email || !password || !name || !role) {
    return errorResponse('Todos los campos son requeridos', 400);
  }

  if (!['docente', 'estudiante'].includes(role)) {
    return errorResponse('Rol inválido', 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return errorResponse('El email ya está registrado', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email: email.toLowerCase(), passwordHash, name, role });

  return jsonResponse({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  }, 201);
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
    createdAt: u.createdAt,
  }));
  return jsonResponse(safe);
}

export async function handleCreateUser(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }

  const { email, password, name } = await req.json() as {
    email?: string; password?: string; name?: string;
  };

  if (!email || !password || !name) {
    return errorResponse('Email, contraseña y nombre son requeridos', 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return errorResponse('El email ya está registrado', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email: email.toLowerCase(), passwordHash, name, role: 'docente' });

  return jsonResponse({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
  }, 201);
}

export async function handleUpdateUser(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }

  await connectDB();
  const { id, email, password, name } = await req.json() as {
    id?: string; email?: string; password?: string; name?: string;
  };

  if (!id) {
    return errorResponse('ID del docente requerido', 400);
  }

  const updates: { email?: string; name?: string; passwordHash?: string } = {};
  if (email && typeof email === 'string') updates.email = email.toLowerCase();
  if (name && typeof name === 'string') updates.name = name;
  if (password && typeof password === 'string') updates.passwordHash = await hashPassword(password);

  if (Object.keys(updates).length === 0) {
    return errorResponse('No hay cambios para aplicar', 400);
  }

  const user = await User.findOneAndUpdate({ _id: id }, { $set: updates }, { new: true });
  if (!user) {
    return errorResponse('Docente no encontrado', 404);
  }

  return jsonResponse({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
}

export async function handleDeleteUser(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await requireAdmin(req);
  } catch {
    return errorResponse('Acceso restringido a administradores', 403);
  }

  await connectDB();
  const { id } = await req.json() as { id?: string };

  if (!id) {
    return errorResponse('ID del docente requerido', 400);
  }

  const deleted = await User.findOneAndDelete({ _id: id, role: 'docente' });
  if (!deleted) {
    return errorResponse('Docente no encontrado', 404);
  }

  return jsonResponse({ ok: true, message: 'Docente eliminado' });
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

export async function handleGetStudents(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const students = await Student.find().sort({ createdAt: -1 });
  return jsonResponse(students);
}

export async function handleCreateStudent(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const body = await req.json() as Record<string, unknown>;
  const student = await Student.create({
    ...body,
    id: (body.id as string) || `student-${uuidv4().slice(0, 8)}`,
  });
  return jsonResponse(student, 201);
}

export async function handleUpdateStudent(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const { id, ...updates } = await req.json() as { id: string; [key: string]: unknown };

  if (!id) {
    return errorResponse('ID del estudiante requerido', 400);
  }

  const student = await Student.findOneAndUpdate({ id }, { $set: updates }, { new: true });
  if (!student) {
    return errorResponse('Estudiante no encontrado', 404);
  }
  return jsonResponse(student);
}

export async function handleToggleStudent(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const { id } = await req.json() as { id: string };

  if (!id) {
    return errorResponse('ID del estudiante requerido', 400);
  }

  const student = await Student.findOne({ id });
  if (!student) {
    return errorResponse('Estudiante no encontrado', 404);
  }

  student.status = student.status === 'allowed' ? 'denied' : 'allowed';
  await student.save();
  return jsonResponse(student);
}

export async function handleDeleteStudent(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const { id } = await req.json() as { id: string };

  if (!id) {
    return errorResponse('ID del estudiante requerido', 400);
  }

  const student = await Student.findOne({ id });
  if (!student) {
    return errorResponse('Estudiante no encontrado', 404);
  }

  if (student.photoKey) {
    try { await deleteImage(student.photoKey); } catch (e) { console.error('[Delete] Error al eliminar imagen:', e); }
  }

  if (student.faceEmbeddingId) {
    try { await deleteFace(student.faceEmbeddingId); } catch (e) { console.error('[Delete] Error al eliminar rostro:', e); }
  }

  await Student.deleteOne({ id });
  return jsonResponse({ ok: true, message: 'Estudiante eliminado' });
}

export async function handleGetLogs(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const logs = await AccessLog.find().sort({ createdAt: -1 }).limit(500);
  return jsonResponse(logs);
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
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();

  const [registered, todayLogs] = await Promise.all([
    Student.countDocuments(),
    AccessLog.find({
      date: { $regex: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
    }),
  ]);

  const todayAccesses = todayLogs.filter(l => l.result === 'Permitido').length;
  const todayDenied = todayLogs.filter(l => l.result === 'Denegado').length;
  const alertsActive = await Alert.countDocuments({ status: 'active' });

  return jsonResponse({
    registered,
    accessesToday: todayAccesses,
    deniedToday: todayDenied,
    alertsActive,
  });
}

export async function handleGetAlerts(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const alerts = await Alert.find().sort({ createdAt: -1 }).limit(50);
  return jsonResponse(alerts);
}

export async function handleUpdateAlert(req: Request): Promise<Response> {
  const { jsonResponse, errorResponse } = await import('./auth.ts');
  try {
    await authenticate(req);
  } catch {
    return errorResponse('No autorizado', 401);
  }

  await connectDB();
  const { id, status } = await req.json() as { id: string; status: string };

  if (!id || !status) {
    return errorResponse('ID y status son requeridos', 400);
  }

  const alert = await Alert.findOneAndUpdate(
    { id },
    { $set: { status } },
    { new: true }
  );

  if (!alert) {
    return errorResponse('Alerta no encontrada', 404);
  }
  return jsonResponse(alert);
}

export async function handleGetStudentsPublic(_req?: Request): Promise<Response> {
  const { jsonResponse } = await import('./auth.ts');
  await connectDB();
  const students = await Student.find().select('-__v').sort({ createdAt: -1 });
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

    if (recentDenials >= 3) {
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
