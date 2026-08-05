import { describe, expect, it } from 'vitest';
import {
  KIOSK_ATTEMPT_COOKIE,
  getKioskAttemptToken,
  serializeKioskAttemptCookie,
} from '../lib/kiosk-attempt-cookie.ts';

describe('cookie privada del intento de kiosco', () => {
  it('es HttpOnly, estricta, limitada a API y Secure en producción', () => {
    const cookie = serializeKioskAttemptCookie('secret-value', true);
    expect(cookie).toContain(`${KIOSK_ATTEMPT_COOKIE}=secret-value`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api');
    expect(cookie).toContain('Secure');
  });

  it('recupera el secreto sin exponerlo en el body', () => {
    const req = new Request('http://localhost/api/kiosk/verify', {
      headers: { cookie: `theme=dark; ${KIOSK_ATTEMPT_COOKIE}=token%20seguro` },
    });
    expect(getKioskAttemptToken(req)).toBe('token seguro');
  });

  it('rechaza una codificación de cookie inválida', () => {
    const req = new Request('http://localhost/api/kiosk/verify', {
      headers: { cookie: `${KIOSK_ATTEMPT_COOKIE}=%E0%A4%A` },
    });
    expect(getKioskAttemptToken(req)).toBeNull();
  });
});
