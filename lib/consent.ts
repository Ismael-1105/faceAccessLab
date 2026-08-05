/**
 * Ciclo de vida del consentimiento y de los datos biométricos (Fase 3).
 *
 * - `grantConsent`: al matricular, se registra quién, cuándo, para qué lab,
 *   con qué versión de la política y hasta cuándo.
 * - `refreshConsent`: cada re-captura facial renueva la vigencia.
 * - `revokeBiometric`: "derecho al olvido biométrico": elimina la foto (S3),
 *   el embedding (Rekognition) y limpia los campos; conserva la ficha académica.
 * - `deleteStudentData`: eliminación completa (MongoDB + S3 + Rekognition +
 *   evidencias + referencias).
 */
import { v4 as uuidv4 } from 'uuid';
import {
  Student,
  DenialEvidence,
  AccessLog,
  Incident,
  Attendance,
  Enrollment,
  ConsentLog,
} from './models.ts';
import { CONSENT_VERSION, consentExpiry } from './biometrics.ts';
import { deleteImage } from './s3.ts';
import { deleteFace } from './rekognition.ts';

type Actor = { email?: string; role?: string };

function actorEmail(actor: Actor): string {
  return actor.email || actor.role || 'sistema';
}

/** Otorga el consentimiento al matricular (o cuando aún no existía). */
export async function grantConsent(
  studentId: string,
  actor: Actor,
  labCode: string,
): Promise<void> {
  const now = new Date();
  const expiresAt = consentExpiry(now);
  await Student.updateOne(
    { id: studentId },
    {
      $set: {
        consentVersion: CONSENT_VERSION,
        consentGrantedBy: actorEmail(actor),
        consentGrantedAt: now,
        consentLab: labCode || undefined,
        consentExpiresAt: expiresAt,
        consentRevokedAt: undefined,
      },
    },
  );
  await ConsentLog.create({
    id: `consent-${uuidv4().slice(0, 8)}`,
    studentId,
    action: 'grant',
    version: CONSENT_VERSION,
    labCode: labCode || undefined,
    grantedBy: actorEmail(actor),
    expiresAt,
    createdAt: now,
  });
}

/** Renueva el consentimiento al re-capturar la biometría. */
export async function refreshConsent(
  studentId: string,
  actor: Actor,
  labCode?: string,
): Promise<void> {
  const now = new Date();
  const expiresAt = consentExpiry(now);
  const student = await Student.findOne({ id: studentId });
  await Student.updateOne(
    { id: studentId },
    {
      $set: {
        consentVersion: CONSENT_VERSION,
        consentGrantedBy: student?.consentGrantedBy || actorEmail(actor),
        consentGrantedAt: student?.consentGrantedAt || now,
        consentLab: labCode || student?.consentLab || undefined,
        consentExpiresAt: expiresAt,
        consentRevokedAt: undefined,
      },
    },
  );
  await ConsentLog.create({
    id: `consent-${uuidv4().slice(0, 8)}`,
    studentId,
    action: 'refresh',
    version: CONSENT_VERSION,
    labCode: labCode || student?.consentLab || undefined,
    grantedBy: actorEmail(actor),
    expiresAt,
    createdAt: now,
  });
}

/**
 * Revoca la biometría: elimina la foto (S3) y el embedding (Rekognition),
 * deja la ficha académica intacta y registra el evento. Es la acción del botón
 * "Revocar datos biométricos".
 */
export async function revokeBiometric(student: InstanceType<typeof Student>, actor: Actor): Promise<void> {
  const { photoKey, faceEmbeddingId } = student;
  if (photoKey) {
    try { await deleteImage(photoKey); } catch (e) { console.error('[Consent] Error al borrar foto S3:', e); }
  }
  if (faceEmbeddingId) {
    try { await deleteFace(faceEmbeddingId); } catch (e) { console.error('[Consent] Error al borrar embedding Rekognition:', e); }
  }

  const now = new Date();
  await Student.updateOne(
    { id: student.id },
    {
      $set: {
        biometricStatus: 'pending',
        biometricUpdatedAt: undefined,
        faceEmbeddingId: undefined,
        photoKey: undefined,
        photoUrl: '/images/default-avatar.jpg',
        consentRevokedAt: now,
      },
    },
  );
  await ConsentLog.create({
    id: `consent-${uuidv4().slice(0, 8)}`,
    studentId: student.id,
    action: 'revoke',
    version: student.consentVersion || CONSENT_VERSION,
    labCode: student.consentLab || student.lab,
    grantedBy: actorEmail(actor),
    createdAt: now,
  });
}

/** Historial de consentimiento del estudiante. */
export async function getConsentHistory(studentId: string) {
  return ConsentLog.find({ studentId }).sort({ createdAt: -1 }).limit(100);
}

/**
 * Eliminación completa del estudiante: ficha, foto, embedding, evidencias,
 * accesos, incidentes, asistencia, inscripciones e historial de consentimiento.
 */
export async function deleteStudentData(student: InstanceType<typeof Student>): Promise<void> {
  // Evidencias de acceso denegado (documentos + objetos S3).
  const evidenceDocs = await DenialEvidence.find({ studentId: student.id });
  for (const ev of evidenceDocs) {
    try { await deleteImage(ev.photoKey); } catch (e) { console.error('[Delete] Error al borrar evidencia S3:', e); }
  }
  await DenialEvidence.deleteMany({ studentId: student.id });

  // Foto y embedding del estudiante.
  if (student.photoKey) {
    try { await deleteImage(student.photoKey); } catch (e) { console.error('[Delete] Error al borrar foto S3:', e); }
  }
  if (student.faceEmbeddingId) {
    try { await deleteFace(student.faceEmbeddingId); } catch (e) { console.error('[Delete] Error al borrar embedding Rekognition:', e); }
  }

  // Referencias.
  await Promise.all([
    AccessLog.deleteMany({ studentId: student.id }),
    Incident.deleteMany({ studentId: student.id }),
    Attendance.deleteMany({ studentId: student.id }),
    Enrollment.deleteMany({ studentId: student.id }),
    ConsentLog.deleteMany({ studentId: student.id }),
    Student.deleteOne({ id: student.id }),
  ]);
}
