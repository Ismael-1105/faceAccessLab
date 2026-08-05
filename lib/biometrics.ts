/**
 * Configuración central de datos biométricos: umbrales de comparación y
 * política de consentimiento (Fase 3 — privacidad).
 *
 * Los umbrales se documentan en `docs/PRIVACIDAD.md`; aquí viven como única
 * fuente de verdad para el código.
 */

/** Umbral de similitud exigido por Rekognition para devolver un candidato. */
export const REKOGNITION_MATCH_THRESHOLD = 85;

/** Umbral de confianza de la prueba de vida (AWS Face Liveness). */
export const LIVENESS_CONFIDENCE_THRESHOLD = 75;

/** Similitud mínima por defecto exigida al comparar (por estudiante). */
export const DEFAULT_MATCH_PERCENTAGE = 85;

/** Versión vigente del consentimiento biométrico. */
export const CONSENT_VERSION = 'v1';

/** Días de vigencia del consentimiento desde su otorgamiento. */
export const CONSENT_DAYS = Number(process.env.CONSENT_DAYS || 365);

export function consentExpiry(base = new Date()): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + CONSENT_DAYS);
  return d;
}

export interface ConsentSnapshot {
  consentVersion?: string;
  consentGrantedBy?: string;
  consentGrantedAt?: Date;
  consentLab?: string;
  consentExpiresAt?: Date;
  consentRevokedAt?: Date;
}

/**
 * El consentimiento está activo si existe, no fue revocado y no ha expirado.
 * Un consentimiento expirado invalida la biometría (motivo `consent-expired`).
 */
export function isConsentActive(consent: ConsentSnapshot): boolean {
  if (!consent.consentVersion || !consent.consentGrantedAt) return false;
  if (consent.consentRevokedAt) return false;
  if (consent.consentExpiresAt && consent.consentExpiresAt.getTime() < Date.now()) return false;
  return true;
}
