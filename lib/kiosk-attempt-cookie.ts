export const KIOSK_ATTEMPT_COOKIE = 'faceaccess_kiosk_attempt';

const MAX_AGE_SECONDS = 3 * 60;

export function serializeKioskAttemptCookie(token: string, production = process.env.NODE_ENV === 'production'): string {
  return [
    `${KIOSK_ATTEMPT_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/api',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Strict',
    production ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function getKioskAttemptToken(req: Request): string | null {
  const cookie = req.headers.get('cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === KIOSK_ATTEMPT_COOKIE) {
      try {
        return decodeURIComponent(rawValue.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}
