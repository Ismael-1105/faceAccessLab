import { v4 as uuidv4 } from 'uuid';
import { connectDB } from './db.ts';
import { createLivenessSession, getLivenessResult } from './liveness.ts';
import { searchFace } from './rekognition.ts';
import { canAccessLab, type AuthResult } from './scheduling.ts';
import { uploadImage } from './s3.ts';
import { denialEvidencePhotoKey, recordDenialEvidence } from './evidence.ts';
import { publishAlert } from './sns.ts';
import { Metrics } from './cloudwatch.ts';
import { createKioskAttemptToken, matchesKioskAttemptToken } from './kiosk-attempt-auth.ts';
import { attendanceRecordId, isMongoDuplicateKeyError } from './attendance-idempotency.ts';
import {
  AccessLog,
  Alert,
  Attendance,
  KioskAttempt,
  Lab,
  Schedule,
  Student,
} from './models.ts';

const ATTEMPT_TTL_MS = 3 * 60 * 1000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const LIVENESS_THRESHOLD = 75;

export type KioskDenialReason =
  | 'no-match'
  | 'low-confidence'
  | 'not-enrolled'
  | 'permissions'
  | 'liveness-failed'
  | 'capture-failed'
  | 'network-error'
  | 'out-of-schedule'
  | 'class-not-started'
  | 'class-ended'
  | 'class-cancelled'
  | 'wrong-lab'
  | 'virtual'
  | 'no-biometric';

export interface KioskVerificationResult {
  attemptId: string;
  allowed: boolean;
  reason: KioskDenialReason | null;
  confidence: number;
  student: { id: string; name: string; career: string; avatarInitials: string } | null;
  schedule: { id: string; subject: string; startTime: string; endTime: string } | null;
}

function serverKioskConfig() {
  return {
    kioskId: process.env.KIOSK_ID || 'Kiosk-042',
    labCode: process.env.KIOSK_LAB || process.env.NEXT_PUBLIC_KIOSK_LAB || 'LAB-02',
  };
}

function decodeImage(imageBase64: string): Uint8Array {
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageBase64)) {
    throw new Error('Formato de imagen no permitido');
  }
  const raw = imageBase64.replace(/^data:image\/\w+;base64,/i, '');
  const bytes = Uint8Array.from(Buffer.from(raw, 'base64'));
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error('La imagen está vacía o supera el límite permitido');
  }
  return bytes;
}

function clock(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  };
}

function mapScheduleReason(result: Exclude<AuthResult, { allowed: true }>): KioskDenialReason {
  if (result.reason === 'no-class') return 'out-of-schedule';
  return result.reason;
}

export async function createKioskAttempt() {
  await connectDB();
  const { kioskId, labCode } = serverKioskConfig();
  const liveness = await createLivenessSession();
  const id = `kat-${uuidv4()}`;
  const { token: attemptToken, tokenHash: attemptTokenHash } = createKioskAttemptToken();
  const expiresAt = new Date(Math.min(liveness.expiry, Date.now() + ATTEMPT_TTL_MS));

  await KioskAttempt.create({
    id,
    kioskId,
    labCode,
    livenessSessionId: liveness.sessionId,
    attemptTokenHash,
    status: 'pending',
    expiresAt,
  });

  return { attemptId: id, attemptToken, sessionId: liveness.sessionId, expiresAt: expiresAt.toISOString() };
}

export async function assertKioskAttemptForCredentials(attemptId: string, attemptToken: string) {
  await connectDB();
  const attempt = await KioskAttempt.findOne({
    id: attemptId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).select('+attemptTokenHash');
  return !!attempt?.attemptTokenHash && matchesKioskAttemptToken(attemptToken, attempt.attemptTokenHash);
}

async function persistResult(attemptId: string, result: KioskVerificationResult) {
  await KioskAttempt.updateOne(
    { id: attemptId },
    {
      $set: {
        status: result.allowed ? 'granted' : 'denied',
        allowed: result.allowed,
        reason: result.reason || undefined,
        confidence: result.confidence,
        studentId: result.student?.id,
        scheduleId: result.schedule?.id,
        resultPayload: JSON.stringify(result),
        consumedAt: new Date(),
      },
    },
  );
}

async function saveAccess(
  attempt: InstanceType<typeof KioskAttempt>,
  result: Omit<KioskVerificationResult, 'attemptId'>,
  recognitionMs: number,
) {
  const now = new Date();
  const t = clock(now);
  const log = await AccessLog.findOneAndUpdate({ attemptId: attempt.id }, { $setOnInsert: {
    attemptId: attempt.id,
    studentId: result.student?.id || 'unknown',
    studentName: result.student?.name || 'No identificado',
    avatarInitials: result.student?.avatarInitials || '?',
    date: t.date,
    time: t.time,
    result: result.allowed ? 'Permitido' : 'Denegado',
    similarity: result.confidence,
    kioskId: attempt.kioskId,
    labCode: attempt.labCode,
    reason: result.reason || undefined,
    scheduleId: result.schedule?.id,
    recognitionMs,
  } }, { upsert: true, new: true });
  await KioskAttempt.updateOne({ id: attempt.id }, { $set: { accessLogId: String(log._id) } });
  return { now, t };
}

async function saveDeniedEvidence(
  attempt: InstanceType<typeof KioskAttempt>,
  imageBase64: string,
  result: Omit<KioskVerificationResult, 'attemptId'>,
  now: Date,
  t: { date: string; time: string },
) {
  // Clave estable: un reintento sobrescribe el mismo objeto y no deja archivos
  // huérfanos con UUID diferentes.
  const photoKey = denialEvidencePhotoKey(attempt.id, now);
  await uploadImage(photoKey, imageBase64);
  const { incident } = await recordDenialEvidence({
    attemptId: attempt.id,
    photoKey,
    reason: result.reason || 'network-error',
    confidence: result.confidence,
    date: t.date,
    time: t.time,
    labCode: attempt.labCode,
    kioskId: attempt.kioskId,
    studentId: result.student?.id,
  });

  if (incident.incidentCreated) {
    await Alert.create({
      id: `alert-${uuidv4().slice(0, 8)}`,
      severity: 'critical',
      source: 'Kiosk',
      message: `Incidente de accesos denegados en ${attempt.labCode} (${incident.count} intentos).`,
      timestamp: now.toISOString(),
      status: 'active',
    });
    await publishAlert(
      'ALERTA DE SEGURIDAD: Incidente de accesos denegados',
      `Se abrió el incidente ${incident.incidentId} en ${attempt.labCode} (${incident.count} rechazos).`,
    );
  }
}

export async function verifyKioskAttempt(attemptId: string, attemptToken: string, imageBase64: string): Promise<KioskVerificationResult> {
  await connectDB();

  const authorizedAttempt = await KioskAttempt.findOne({ id: attemptId, expiresAt: { $gt: new Date() } })
    .select('+attemptTokenHash');
  if (!authorizedAttempt?.attemptTokenHash || !matchesKioskAttemptToken(attemptToken, authorizedAttempt.attemptTokenHash)) {
    throw new Error('Credencial de intento inválida');
  }

  const completed = await KioskAttempt.findOne({ id: attemptId, status: { $in: ['granted', 'denied'] } });
  if (completed?.resultPayload) return JSON.parse(completed.resultPayload) as KioskVerificationResult;

  const attempt = await KioskAttempt.findOneAndUpdate(
    { id: attemptId, status: { $in: ['pending', 'failed'] }, expiresAt: { $gt: new Date() } },
    { $set: { status: 'processing', processingStartedAt: new Date() } },
    { new: true },
  );
  if (!attempt) throw new Error('Intento inválido, expirado o ya consumido');

  const startedAt = Date.now();
  try {
    decodeImage(imageBase64);
    const liveness = await getLivenessResult(attempt.livenessSessionId);
    const trustedReferenceImage = liveness.referenceImageBytes
      ? `data:image/jpeg;base64,${Buffer.from(liveness.referenceImageBytes).toString('base64')}`
      : null;

    let result: Omit<KioskVerificationResult, 'attemptId'>;
    if (liveness.status !== 'SUCCEEDED' || liveness.confidence < LIVENESS_THRESHOLD || !liveness.referenceImageBytes) {
      Metrics.livenessFailed();
      result = { allowed: false, reason: 'liveness-failed', confidence: liveness.confidence, student: null, schedule: null };
    } else {
      Metrics.livenessChecked();
      // La identidad se resuelve con la imagen de referencia producida por la
      // misma sesión AWS Face Liveness. La captura enviada por el navegador se
      // conserva únicamente como evidencia y nunca puede elegir la identidad.
      const match = await searchFace(liveness.referenceImageBytes);
      if (!match.studentId) {
        result = { allowed: false, reason: 'no-match', confidence: 0, student: null, schedule: null };
      } else {
        const student = await Student.findOne({ id: match.studentId });
        const safeStudent = student
          ? { id: student.id, name: student.name, career: student.career, avatarInitials: student.avatarInitials }
          : null;

        if (!student) {
          result = { allowed: false, reason: 'not-enrolled', confidence: match.confidence, student: null, schedule: null };
        } else if (match.confidence < (student.matchPercentage || 85)) {
          result = { allowed: false, reason: 'low-confidence', confidence: match.confidence, student: safeStudent, schedule: null };
        } else if (student.status !== 'allowed') {
          result = { allowed: false, reason: 'permissions', confidence: match.confidence, student: safeStudent, schedule: null };
        } else {
          const lab = await Lab.findOne({ code: attempt.labCode, active: true });
          if (!lab) {
            result = { allowed: false, reason: 'wrong-lab', confidence: match.confidence, student: safeStudent, schedule: null };
          } else {
            const auth = await canAccessLab(student.id, attempt.labCode);
            const schedule = auth.schedule
              ? { id: auth.schedule.id, subject: auth.schedule.subject, startTime: auth.schedule.startTime, endTime: auth.schedule.endTime }
              : null;
            result = auth.allowed
              ? { allowed: true, reason: null, confidence: match.confidence, student: safeStudent, schedule }
              : { allowed: false, reason: mapScheduleReason(auth), confidence: match.confidence, student: safeStudent, schedule };
          }
        }
      }
    }

    const timing = await saveAccess(attempt, result, Date.now() - startedAt);
    if (result.allowed && result.student && result.schedule) {
      const attendanceSchedule = await Schedule.findOne({ id: result.schedule.id }).select('teacherId');
      try {
        await Attendance.findOneAndUpdate(
          { studentId: result.student.id, scheduleId: result.schedule.id, date: timing.t.date },
          {
            $set: {
              subject: result.schedule.subject,
              labCode: attempt.labCode,
              teacherId: attendanceSchedule?.teacherId,
              status: 'presente',
              time: timing.t.time,
            },
            $setOnInsert: {
              id: attendanceRecordId(result.student.id, result.schedule.id, timing.t.date),
              createdAt: timing.now,
            },
          },
          { upsert: true, new: true },
        );
      } catch (error) {
        // Dos instancias pueden intentar insertar a la vez. El ID determinista
        // hace que una gane y la otra continúe con el mismo resultado funcional.
        if (!isMongoDuplicateKeyError(error)) throw error;
      }
      Metrics.accessGranted();
    } else {
      // La evidencia también proviene de AWS Face Liveness; la captura del
      // navegador nunca determina qué imagen queda asociada al incidente.
      if (trustedReferenceImage) {
        await saveDeniedEvidence(attempt, trustedReferenceImage, result, timing.now, timing.t);
      }
      Metrics.accessDenied();
    }

    const response: KioskVerificationResult = { attemptId, ...result };
    await persistResult(attemptId, response);
    return response;
  } catch (error) {
    await KioskAttempt.updateOne(
      { id: attemptId, status: 'processing' },
      { $set: { status: 'failed', consumedAt: new Date(), reason: 'network-error' } },
    );
    throw error;
  }
}
