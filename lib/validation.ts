import { z } from 'zod';

const email = z.string().trim().email().max(120);
const name = z.string().trim().min(2).max(100);

export const studentCreateSchema = z.object({
  id: z.string().min(1).max(60).optional(),
  name: z.string().trim().min(2).max(100),
  lastName: z.string().trim().max(100).optional(),
  documentId: z.string().trim().regex(/^\d{6,10}$/).optional().or(z.literal('').transform(() => undefined)),
  email: email.optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().trim().regex(/^\d{7,10}$/).optional().or(z.literal('').transform(() => undefined)),
  career: z.string().trim().min(2).max(100),
  /** Se hereda de la clase (scheduleId) cuando el docente matricula. */
  lab: z.string().trim().min(1).max(30).optional(),
  labs: z.array(z.string().min(1).max(30)).max(20).optional(),
  photoUrl: z.string().max(500).optional(),
  photoKey: z.string().max(500).optional(),
  matchPercentage: z.number().min(0).max(100).optional(),
  status: z.enum(['allowed', 'denied']).optional(),
  avatarInitials: z.string().trim().min(1).max(4),
  faceEmbeddingId: z.string().max(200).optional(),
  biometricStatus: z.enum(['pending', 'registered']).optional(),
  /** Si el docente registra el estudiante, lo inscribe de inmediato en su clase. */
  scheduleId: z.string().min(1).optional(),
}).strict();

export const userCreateSchema = z.object({
  email: email,
  password: z.string().min(6).max(128),
  name: name,
  /** Lab/aula asignado al docente (LAB-02, AULA-B4, VIRTUAL, ...). */
  labCode: z.string().trim().max(30).optional(),
}).strict();

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  email: email.optional(),
  password: z.string().min(6).max(128).optional(),
  name: name.optional(),
  labCode: z.string().trim().max(30).optional(),
}).strict();

export const labCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().regex(/^[A-Za-z0-9-]{2,12}$/),
  description: z.string().trim().max(200).optional(),
  active: z.boolean().optional(),
}).strict();

export const labUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().regex(/^[A-Za-z0-9-]{2,12}$/).optional(),
  description: z.string().trim().max(200).optional(),
  active: z.boolean().optional(),
}).strict();

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const scheduleCreateSchema = z.object({
  subject: z.string().trim().min(2).max(120),
  teacherId: z.string().min(1),
  labCode: z.string().trim().min(1).max(30),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: hhmm,
  endTime: hhmm,
  active: z.boolean().optional(),
  status: z.enum(['programada', 'en_curso', 'finalizada', 'cancelada']).optional(),
  parallel: z.string().trim().max(10).optional(),
  campus: z.string().trim().max(30).optional(),
  academicTerm: z.string().trim().max(20).optional(),
  deliveryMode: z.enum(['presencial', 'virtual']).optional(),
  requiresPhysicalAccess: z.boolean().optional(),
  activeKiosk: z.boolean().optional(),
}).strict().refine(d => d.endTime > d.startTime, {
  message: 'La hora de fin debe ser posterior a la de inicio',
  path: ['endTime'],
});

export const scheduleUpdateSchema = z.object({
  id: z.string().min(1),
  subject: z.string().trim().min(2).max(120).optional(),
  teacherId: z.string().min(1).optional(),
  labCode: z.string().trim().min(1).max(30).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
  active: z.boolean().optional(),
  status: z.enum(['programada', 'en_curso', 'finalizada', 'cancelada']).optional(),
  parallel: z.string().trim().max(10).optional(),
  campus: z.string().trim().max(30).optional(),
  academicTerm: z.string().trim().max(20).optional(),
  deliveryMode: z.enum(['presencial', 'virtual']).optional(),
  requiresPhysicalAccess: z.boolean().optional(),
  activeKiosk: z.boolean().optional(),
}).strict();

export const academicTermCreateSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  startDate: z.string().trim().max(30).optional(),
  endDate: z.string().trim().max(30).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const enrollmentCreateSchema = z.object({
  scheduleId: z.string().min(1),
  studentId: z.string().min(1),
}).strict();

export const loginSchema = z.object({
  email: email,
  password: z.string().min(1).max(128),
  mfaToken: z.string().regex(/^\d{6}$/).optional(),
}).strict();

export const registerSchema = z.object({
  email: email,
  password: z.string().min(6).max(128),
  name: name,
  role: z.enum(['docente', 'estudiante']),
}).strict();

export const denialEvidenceSchema = z.object({
  photoKey: z.string().min(1),
  reason: z.string().trim().min(1).max(50),
  confidence: z.number().min(0).max(100).optional(),
  date: z.string().min(1),
  time: z.string().min(1),
  labCode: z.string().trim().max(30).optional(),
  kioskId: z.string().trim().max(60).optional(),
  studentId: z.string().max(60).optional(),
}).strict();

export const incidentCloseSchema = z.object({
  id: z.string().min(1),
}).strict();

/** Registro de asistencia creado por el kiosco tras conceder/denegar acceso. */
export const attendanceCreateSchema = z.object({
  studentId: z.string().min(1),
  scheduleId: z.string().min(1),
  subject: z.string().trim().max(120).optional(),
  labCode: z.string().trim().max(30).optional(),
  teacherId: z.string().max(60).optional(),
  status: z.enum(['presente', 'ausente']),
}).strict();
