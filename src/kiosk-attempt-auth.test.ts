import { describe, expect, it } from 'vitest';
import {
  createKioskAttemptToken,
  hashKioskAttemptToken,
  matchesKioskAttemptToken,
} from '../lib/kiosk-attempt-auth.ts';

describe('credencial efímera del intento de kiosco', () => {
  it('genera un secreto aleatorio y almacena únicamente su hash', () => {
    const first = createKioskAttemptToken();
    const second = createKioskAttemptToken();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashKioskAttemptToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
  });

  it('acepta únicamente el secreto correspondiente al intento', () => {
    const attempt = createKioskAttemptToken();

    expect(matchesKioskAttemptToken(attempt.token, attempt.tokenHash)).toBe(true);
    expect(matchesKioskAttemptToken('token-de-otro-intento', attempt.tokenHash)).toBe(false);
  });
});
