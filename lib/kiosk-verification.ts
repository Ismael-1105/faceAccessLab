import { v4 as uuidv4 } from 'uuid';
import { connectDB } from './db.ts';
import { createLivenessSession, getLivenessResult } from './liveness.ts';
import { searchFace } from './rekognition.ts';
import { canAccessLab, type AuthResult } from './scheduling.ts';
import { getPresignedUrl, uploadImage } from './s3.ts';
import { denialEvidencePhotoKey, recordDenialEvidence } from './evidence.ts';
import { publishAlert } from './sns.ts';
import { Metrics } from './cloudwatch.ts';
import { createKioskAttemptToken, matchesKioskAttemptToken } from './kiosk-attempt-auth.ts';
import { attendanceRecordId, isMongoDuplicateKeyError } from './attendance-idempotency.ts';
import { LIVENESS_CONFIDENCE_THRESHOLD } from './biometrics.ts';
import { logger } from './observability.ts';
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
/**
 * Vida de la URL firmada de la foto. La pantalla de resultado dura entre 6 y 12
 * segundos (RESET_MS en useKioskFlow), así que dos minutos cubren de sobra el
 * caso y dejan margen para una red lenta sin ampliar la exposición.
 */
const PHOTO_URL_TTL_SECONDS = 120;

export type KioskDenialReason =
  | 'no-match'
  | 'low-confidence'
  | 'no-student-record'
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
  | 'no-biometric'
  | 'consent-expired';

export interface KioskVerificationResult {
  attemptId: string;
  allowed: boolean;
  reason: KioskDenialReason | null;
  confidence: number;
  student: { id: string; name: string; career: string; avatarInitials: string } | null;
  schedule: { id: string; subject: string; startTime: string; endTime: string } | null;
  /**
   * URL firmada de corta duración para la foto del alumno reconocido, o null si
   * no tiene foto en S3. El kiosco es un terminal público sin sesión y no puede
   * usar /api/photos, que exige rol de personal. Se genera en el servidor y se
   * regenera en cada respuesta: nunca se sirve la que quedó en resultPayload,
   * que llegaría caducada.
   */
  studentPhotoUrl: string | null;
}

/**
 * La decisión de acceso, sin los dos campos que añade el transporte. La URL
 * firmada queda fuera a propósito: se calcula una sola vez al construir la
 * respuesta, de modo que ninguna de las ocho ramas de decisión pueda olvidarla
 * ni servir una caducada.
 */
type KioskDecision = Omit<KioskVerificationResult, 'attemptId' | 'studentPhotoUrl'>;

/** Firma la foto del alumno para la pantalla de resultado. Nunca lanza. */
async function signStudentPhoto(photoKey?: string | null): Promise<string | null> {
  if (!photoKey) return null;
  try {
    return await getPresignedUrl(photoKey, PHOTO_URL_TTL_SECONDS);
  } catch (error) {
    // Una foto que no se puede firmar no debe tumbar la verificación entera:
    // el acceso ya está decidido y la pantalla cae al fondo genérico.
    logger.warn('kiosk.photo.presign.failed', {
      error: error instanceof Error ? error.message : 'desconocido',
    });
    return null;
  }
}

function serverKioskConfig() {
  return {
    kioskId: process.env.KIOSK_ID || 'Kiosk-042',
    labCode: process.env.KIOSK_LAB || process.env.NEXT_PUBLIC_KIOSK_LAB || 'LAB-02',
  };
}

/** Fallo de captura/decodificación de imagen: motiva `capture-failed` (R06). */
class CaptureError extends Error {}

function decodeImage(imageBase64: string): Uint8Array {
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageBase64)) {
    throw new CaptureError('Formato de imagen no permitido');
  }
  const raw = imageBase64.replace(/^data:image\/\w+;base64,/i, '');
  const bytes = Uint8Array.from(Buffer.from(raw, 'base64'));
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new CaptureError('La imagen está vacía o supera el límite permitido');
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

export async function createKioskAttempt(requestId?: string) {
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

  void Metrics.attemptsPerKiosk(kioskId);
  logger.info('kiosk.attempt.created', { requestId, attemptId: id, kioskId, labCode });

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

async function persistResult(attemptId: string, result: KioskDecision & { attemptId: string }) {
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
  result: KioskDecision,
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
  result: KioskDecision,
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

export async function verifyKioskAttempt(attemptId: string, attemptToken: string, imageBase64: string, requestId?: string): Promise<KioskVerificationResult> {
  await connectDB();

  const authorizedAttempt = await KioskAttempt.findOne({ id: attemptId, expiresAt: { $gt: new Date() } })
    .select('+attemptTokenHash');
  if (!authorizedAttempt?.attemptTokenHash || !matchesKioskAttemptToken(attemptToken, authorizedAttempt.attemptTokenHash)) {
    throw new Error('Credencial de intento inválida');
  }

  const completed = await KioskAttempt.findOne({ id: attemptId, status: { $in: ['granted', 'denied'] } });
  if (completed?.resultPayload) {
    const cached = JSON.parse(completed.resultPayload) as KioskVerificationResult;
    // La URL firmada guardada ya habrá caducado: se regenera. El payload
    // persistido nunca se sirve tal cual en ese campo.
    const student = cached.student
      ? await Student.findOne({ id: cached.student.id }).select('photoKey')
      : null;
    return { ...cached, studentPhotoUrl: await signStudentPhoto(student?.photoKey) };
  }

  const attempt = await KioskAttempt.findOneAndUpdate(
    { id: attemptId, status: { $in: ['pending', 'failed'] }, expiresAt: { $gt: new Date() } },
    { $set: { status: 'processing', processingStartedAt: new Date() } },
    { new: true },
  );
  if (!attempt) throw new Error('Intento inválido, expirado o ya consumido');

  const startedAt = Date.now();
  logger.info('kiosk.verification.started', { requestId, attemptId, kioskId: attempt.kioskId, labCode: attempt.labCode });
  try {
    decodeImage(imageBase64);
    const livenessT0 = Date.now();
    const liveness = await getLivenessResult(attempt.livenessSessionId);
    void Metrics.livenessLatency(Date.now() - livenessT0);
    logger.info('kiosk.liveness.completed', {
      requestId, attemptId, kioskId: attempt.kioskId, labCode: attempt.labCode,
      succeeded: liveness.status === 'SUCCEEDED',
      confidence: liveness.confidence,
      durationMs: Date.now() - livenessT0,
    });
    const trustedReferenceImage = liveness.referenceImageBytes
      ? `data:image/jpeg;base64,${Buffer.from(liveness.referenceImageBytes).toString('base64')}`
      : null;

    let result: KioskDecision;
    // Clave de la foto del alumno identificado, para firmarla al responder.
    let studentPhotoKey: string | null = null;
    if (liveness.status !== 'SUCCEEDED' || liveness.confidence < LIVENESS_CONFIDENCE_THRESHOLD || !liveness.referenceImageBytes) {
      Metrics.livenessFailed();
      result = { allowed: false, reason: 'liveness-failed', confidence: liveness.confidence, student: null, schedule: null };
    } else {
      Metrics.livenessChecked();
      // La identidad se resuelve con la imagen de referencia producida por la
      // misma sesión AWS Face Liveness. La captura enviada por el navegador se
      // conserva únicamente como evidencia y nunca puede elegir la identidad.
      const match = await searchFace(liveness.referenceImageBytes);
      logger.info('kiosk.rekognition.completed', {
        requestId, attemptId, kioskId: attempt.kioskId, labCode: attempt.labCode,
        matched: Boolean(match.studentId), confidence: match.confidence,
      });
      if (!match.studentId) {
        result = { allowed: false, reason: 'no-match', confidence: 0, student: null, schedule: null };
      } else {
        const student = await Student.findOne({ id: match.studentId });
        studentPhotoKey = student?.photoKey ?? null;
        const safeStudent = student
          ? { id: student.id, name: student.name, career: student.career, avatarInitials: student.avatarInitials }
          : null;

        if (!student) {
          result = { allowed: false, reason: 'no-student-record', confidence: match.confidence, student: null, schedule: null };
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
            // Primer ingreso gana: la hora de asistencia se fija con el primer
            // acceso del día; los re-ingresos no la sobrescriben (A10).
            $set: {
              subject: result.schedule.subject,
              labCode: attempt.labCode,
              teacherId: attendanceSchedule?.teacherId,
              status: 'presente',
            },
            $setOnInsert: {
              id: attendanceRecordId(result.student.id, result.schedule.id, timing.t.date),
              time: timing.t.time,
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

    // La decisión se persiste SIN la URL firmada, que caduca y no debe quedar
    // guardada; la respuesta la lleva, firmada en este instante.
    await persistResult(attemptId, { attemptId, ...result });
    const response: KioskVerificationResult = {
      attemptId,
      ...result,
      studentPhotoUrl: await signStudentPhoto(studentPhotoKey),
    };

    // Correlación: intento → alumno → kiosco → decisión (sin imágenes ni tokens).
    if (!result.allowed) void Metrics.deniedPerKiosk(attempt.kioskId);
    const durationMs = Date.now() - startedAt;
    void import('./monitoring.ts').then(({ recordLatency }) => recordLatency('kiosk/verify', durationMs));
    logger.info('kiosk.verification.completed', {
      requestId,
      attemptId,
      kioskId: attempt.kioskId,
      labCode: attempt.labCode,
      studentId: result.student?.id,
      decision: result.allowed ? 'granted' : 'denied',
      reason: result.reason,
      durationMs,
      confidence: result.confidence,
    });

    return response;
  } catch (error) {
    // Fallos de captura/decodificación (R06) se distinguen de errores de red (R07).
    const reason = error instanceof CaptureError ? 'capture-failed' : 'network-error';
    await KioskAttempt.updateOne(
      { id: attemptId, status: 'processing' },
      { $set: { status: 'failed', consumedAt: new Date(), reason } },
    );
    logger.error('kiosk.verification.failed', {
      requestId, attemptId, reason,
      error: error instanceof Error ? error.message : 'desconocido',
    });
    throw error;
  }
}
