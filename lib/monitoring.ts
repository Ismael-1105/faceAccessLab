/**
 * Observabilidad: alertas operativas (Fase 6).
 *
 * Cubre:
 * - Aumento de errores 5xx (ventana de 60 s, umbral configurable).
 * - Latencia elevada en endpoints sensibles.
 * - Kiosco sin actividad.
 * - Múltiples rechazos por persona: ya cubierto por `lib/evidence.ts`
 *   (incidente `repeated_denials` → Alert crítica + SNS).
 * - Consumo AWS inesperado: requiere alarma de presupuesto en CloudWatch
 *   (Ceiling/Actual Spend); el código expone métricas para alimentarla.
 *
 * Todas las alertas se deduplican: solo se crea si no existe una activa con
 * el mismo mensaje.
 */
import { logger } from './observability.ts';
import { v4 as uuidv4 } from 'uuid';

const HTTP_5XX_THRESHOLD = Number(process.env.ALERT_5XX_THRESHOLD || 20);
const HTTP_5XX_WINDOW_MS = 60_000;
const LATENCY_THRESHOLD_MS = Number(process.env.ALERT_LATENCY_MS || 2000);
const KIOSK_INACTIVITY_MIN = Number(process.env.ALERT_KIOSK_IDLE_MIN || 15);

const fiveXxWindowStart = new Map<string, number>();
const fiveXxCount = new Map<string, number>();
let lastInactivityCheck = 0;

async function createAlert(message: string, severity: 'warning' | 'critical' = 'warning'): Promise<void> {
  const { connectDB } = await import('./db.ts');
  const { Alert } = await import('./models.ts');
  const { publishAlert } = await import('./sns.ts');

  await connectDB();
  const open = await Alert.findOne({ message, status: 'active' });
  if (open) return; // dedupe

  await Alert.create({
    id: `alert-${uuidv4().slice(0, 8)}`,
    severity,
    source: 'Monitoring',
    message,
    timestamp: new Date().toISOString(),
    status: 'active',
  });
  await publishAlert('ALERTA OPERATIVA', message).catch(() => {});
  logger.warn('monitoring.alert.created', { severity, message });
}

/** Registra un error HTTP y alerta si los 5xx superan el umbral en la ventana. */
export async function recordHttpError(endpoint: string, status: number): Promise<void> {
  if (status < 500) return;
  const now = Date.now();
  const windowStart = fiveXxWindowStart.get(endpoint) ?? now;
  if (now - windowStart > HTTP_5XX_WINDOW_MS) {
    fiveXxWindowStart.set(endpoint, now);
    fiveXxCount.set(endpoint, 1);
  } else {
    fiveXxCount.set(endpoint, (fiveXxCount.get(endpoint) ?? 0) + 1);
  }
  if (fiveXxCount.get(endpoint)! >= HTTP_5XX_THRESHOLD) {
    await createAlert(
      `Aumento de errores 5xx en ${endpoint}: ${fiveXxCount.get(endpoint)} en la ventana`,
      'critical',
    );
    fiveXxCount.set(endpoint, 0); // evita alertas repetidas hasta la siguiente ventana
  }
}

/** Registra latencia y alerta si supera el umbral. */
export async function recordLatency(endpoint: string, durationMs: number): Promise<void> {
  if (durationMs <= LATENCY_THRESHOLD_MS) return;
  await createAlert(`Latencia elevada en ${endpoint}: ${Math.round(durationMs)} ms`);
}

/**
 * Detecta kioscos sin actividad (sin intentos ni accesos) en los últimos N
 * minutos. Se evalúa con throttle interno para no pegar a MongoDB en cada poll.
 */
export async function checkKioskInactivity(): Promise<void> {
  const now = Date.now();
  if (now - lastInactivityCheck < HTTP_5XX_WINDOW_MS * 2) return;
  lastInactivityCheck = now;

  try {
    const { connectDB } = await import('./db.ts');
    const { AccessLog, KioskAttempt } = await import('./models.ts');
    await connectDB();

    const cutoff = new Date(now - KIOSK_INACTIVITY_MIN * 60_000);
    const kioskIds = await AccessLog.distinct('kioskId');
    for (const kioskId of kioskIds) {
      const lastAttempt = await KioskAttempt.findOne({ kioskId }).sort({ createdAt: -1 }).select('createdAt');
      const lastLog = await AccessLog.findOne({ kioskId }).sort({ createdAt: -1 }).select('createdAt');
      const lastActivity = lastAttempt?.createdAt || lastLog?.createdAt;
      if (!lastActivity || lastActivity.getTime() < cutoff.getTime()) {
        await createAlert(`Kiosco ${kioskId} sin actividad en ${KIOSK_INACTIVITY_MIN} min`);
      }
    }
  } catch (error) {
    logger.error('monitoring.kiosk_inactivity.failed', {
      error: error instanceof Error ? error.message : 'desconocido',
    });
  }
}
