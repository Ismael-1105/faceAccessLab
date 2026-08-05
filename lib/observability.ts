/**
 * Observabilidad: logging estructurado en JSON con requestId y correlación.
 *
 * REGLAS DE PRIVACIDAD (Fase 3/6): NUNCA registrar imágenes, credenciales,
 * tokens de sesión, vectores faciales ni datos personales sensibles. `log`
 * sanea las claves conocidas como medida de defensa.
 */
import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  attemptId?: string;
  kioskId?: string;
  labCode?: string;
  studentId?: string;
  [key: string]: unknown;
}

/** Claves que jamás se vuelcan a los logs (defensa en profundidad). */
const FORBIDDEN_KEYS = new Set([
  'password', 'passwordHash', 'token', 'refreshToken', 'refresh_token',
  'accessToken', 'access_token', 'csrf', 'csrfToken', 'csrf_token',
  'imageBase64', 'image', 'photo', 'photoUrl', 'photoKey', 'faceEmbeddingId',
  'faceId', 'embedding', 'vector', 'secret', 'attemptTokenHash',
]);

/** Claves con valores binarios o base64 que tampoco deben registrarse. */
const FORBIDDEN_VALUE = /^(data:image|i?vb|eyJ|base64)/i;

export function newRequestId(): string {
  return randomUUID();
}

/** RequestId desde cabecera X-Request-Id o generado. */
export function getRequestId(req: Request): string {
  return req.headers.get('x-request-id') || randomUUID();
}

function sanitize(context: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (typeof value === 'string' && FORBIDDEN_VALUE.test(value)) continue;
    out[key] = value;
  }
  return out;
}

export function log(level: LogLevel, event: string, context: LogContext = {}): void {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitize(context),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, context?: LogContext) => log('debug', event, context),
  info: (event: string, context?: LogContext) => log('info', event, context),
  warn: (event: string, context?: LogContext) => log('warn', event, context),
  error: (event: string, context?: LogContext) => log('error', event, context),
};
