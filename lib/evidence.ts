import { DenialEvidence, Incident } from './models.ts';
import { v4 as uuidv4 } from 'uuid';

const INCIDENT_WINDOW_MIN = Number(process.env.INCIDENT_WINDOW_MIN || 15);
const INCIDENT_THRESHOLD = Number(process.env.INCIDENT_THRESHOLD || 5);

export interface EvidenceInput {
  attemptId?: string;
  photoKey: string;
  reason: string;
  confidence: number;
  date: string;
  time: string;
  labCode?: string;
  kioskId?: string;
  studentId?: string;
}

export interface IncidentResult {
  incidentCreated: boolean;
  incidentId?: string;
  count: number;
}

export function denialEvidencePhotoKey(attemptId: string, now: Date): string {
  return `evidence/${now.toISOString().slice(0, 10)}/${attemptId}.jpg`;
}

/**
 * Registra la evidencia de un acceso denegado y evalúa si debe abrirse un
 * incidente de seguridad (rechazos repetidos en una ventana configurable).
 * Devuelve true si se creó un incidente (para que el caller dispare SNS).
 */
export async function recordDenialEvidence(input: EvidenceInput): Promise<{ incident: IncidentResult }> {
  const now = new Date();
  const evidenceId = `ev-${uuidv4().slice(0, 8)}`;
  const evidenceData = {
    id: evidenceId,
    attemptId: input.attemptId,
    photoKey: input.photoKey,
    reason: input.reason,
    confidence: input.confidence ?? 0,
    date: input.date,
    time: input.time,
    labCode: input.labCode,
    kioskId: input.kioskId || 'Kiosk-042',
    studentId: input.studentId,
    createdAt: now,
  };

  const evidence = input.attemptId
    ? await DenialEvidence.findOneAndUpdate(
      { attemptId: input.attemptId },
      { $setOnInsert: evidenceData },
      { upsert: true, new: true },
    )
    : await DenialEvidence.create(evidenceData);

  const windowStart = new Date(now.getTime() - INCIDENT_WINDOW_MIN * 60 * 1000);

  // Rechazos del mismo rostro (studentId) o del mismo kiosco en la ventana.
  const groupKey = input.studentId ? { studentId: input.studentId } : { kioskId: input.kioskId || 'Kiosk-042' };
  const recent = await DenialEvidence.countDocuments({
    ...groupKey,
    createdAt: { $gte: windowStart },
  });

  // Un reintento del mismo intento no vuelve a incrementar incidentes ni
  // dispara SNS. El primer proceso que insertó la evidencia continúa abajo.
  if (input.attemptId && evidence.id !== evidenceId) {
    return { incident: { incidentCreated: false, count: recent } };
  }

  if (recent < INCIDENT_THRESHOLD) {
    return { incident: { incidentCreated: false, count: recent } };
  }

  // Evitar incidentes duplicados abiertos en la misma ventana.
  const open = await Incident.findOne({
    type: 'repeated_denials',
    status: 'open',
    ...(input.studentId ? { studentId: input.studentId } : { kioskId: input.kioskId || 'Kiosk-042' }),
  });

  if (open) {
    open.count = recent;
    open.lastSeen = now;
    if (!open.evidenceIds.includes(evidence.id)) open.evidenceIds.push(evidence.id);
    await open.save();
    return { incident: { incidentCreated: false, incidentId: open.id, count: recent } };
  }

  const incident = await Incident.create({
    id: `inc-${uuidv4().slice(0, 8)}`,
    type: 'repeated_denials',
    status: 'open',
    reason: input.reason,
    labCode: input.labCode,
    kioskId: input.kioskId,
    studentId: input.studentId,
    evidenceIds: [evidence.id],
    count: recent,
    windowMinutes: INCIDENT_WINDOW_MIN,
    firstSeen: windowStart,
    lastSeen: now,
  });

  return { incident: { incidentCreated: true, incidentId: incident.id, count: recent } };
}
