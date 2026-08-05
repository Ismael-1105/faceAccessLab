'use client';

/**
 * Cola local limitada de eventos NO biométricos (Fase 7).
 *
 * Mientras el kiosco está offline, los eventos de diagnóstico (cámara,
 * conectividad, encendido, intentos fallidos de red) se encolan en localStorage
 * con un tope. Al recuperar conexión se descargan a POST /api/telemetry.
 *
 * NUNCA se encolan imágenes, tokens ni vectores faciales: solo eventos
 * estructurados y sanitizados.
 */
const QUEUE_KEY = 'kiosk:telemetry';
const MAX_EVENTS = 50;

export interface TelemetryEvent {
  /** tipo de evento, p. ej. "kiosk.boot" | "kiosk.offline" | "kiosk.camera_error" */
  event: string;
  ts: number;
  meta?: Record<string, string | number | boolean>;
}

function readQueue(): TelemetryEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: TelemetryEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // localStorage lleno o no disponible: descartar sin romper el kiosco.
  }
}

/** Encola un evento sanitizado (tope de MAX_EVENTS). */
export function enqueueEvent(event: string, meta?: TelemetryEvent['meta']): void {
  const queue = readQueue();
  queue.push({ event, ts: Date.now(), meta });
  writeQueue(queue);
}

/** Devuelve y vacía la cola (para descargarla). */
export function drainQueue(): TelemetryEvent[] {
  const queue = readQueue();
  writeQueue([]);
  return queue;
}

export function queueSize(): number {
  return readQueue().length;
}

/** Inspección sin vaciar (página de diagnóstico). */
export function peekQueue(): TelemetryEvent[] {
  return readQueue();
}

/** Descarga la cola a /api/telemetry si hay conexión. */
export async function flushQueue(): Promise<void> {
  const queue = drainQueue();
  if (queue.length === 0) return;
  try {
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: queue }),
    });
  } catch {
    // Sigue offline: re-encolar para el próximo intento.
    enqueueMany(queue);
  }
}

function enqueueMany(events: TelemetryEvent[]): void {
  const queue = readQueue();
  writeQueue([...queue, ...events]);
}
