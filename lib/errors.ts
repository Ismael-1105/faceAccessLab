/**
 * Error responses sanitizadas: nunca se filtra el mensaje interno de AWS,
 * MongoDB o cualquier excepción inesperada al cliente.
 */

/** Mensajes intencionales y seguros para el usuario (no internos). */
const SAFE_PATTERNS = [
  /^La imagen /i,
  /^Formato de imagen/i,
  /^La solicitud/i,
  /^El cuerpo de la solicitud/i,
  /^Intentos de verificación/i,
  /^No se pudo/i,
  /^intento|^credencial|^token/i,
];

export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    if (SAFE_PATTERNS.some(p => p.test(error.message))) {
      return error.message;
    }
    console.error('[API] Error interno:', error);
  }
  return 'Error interno del servidor';
}

export function isSanitizable(message: string): boolean {
  return SAFE_PATTERNS.some(p => p.test(message));
}
