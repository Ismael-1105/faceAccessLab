import { describe, expect, it } from 'vitest';
import { isConsentActive, consentExpiry, CONSENT_VERSION, CONSENT_DAYS } from '../../lib/biometrics.ts';

const future = () => new Date(Date.now() + 30 * 86400000);
const past = () => new Date(Date.now() - 1000);

describe('biometrics: consentimiento', () => {
  it('considera vigente un consentimiento sin revocar ni expirar', () => {
    expect(isConsentActive({ consentVersion: CONSENT_VERSION, consentGrantedAt: new Date(), consentExpiresAt: future() })).toBe(true);
  });

  it('rechaza sin versión o sin fecha de otorgamiento', () => {
    expect(isConsentActive({ consentExpiresAt: future() })).toBe(false);
    expect(isConsentActive({ consentVersion: CONSENT_VERSION })).toBe(false);
  });

  it('rechaza un consentimiento revocado', () => {
    expect(isConsentActive({ consentVersion: CONSENT_VERSION, consentGrantedAt: new Date(), consentRevokedAt: new Date() })).toBe(false);
  });

  it('rechaza un consentimiento expirado', () => {
    expect(isConsentActive({ consentVersion: CONSENT_VERSION, consentGrantedAt: past(), consentExpiresAt: past() })).toBe(false);
  });

  it('calcula la expiración según CONSENT_DAYS', () => {
    const base = new Date('2026-08-05T00:00:00Z');
    const exp = consentExpiry(base);
    expect(exp.getTime() - base.getTime()).toBe(CONSENT_DAYS * 86400000);
  });
});
