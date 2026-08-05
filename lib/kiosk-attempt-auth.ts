import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function createKioskAttemptToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashKioskAttemptToken(token) };
}

export function hashKioskAttemptToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function matchesKioskAttemptToken(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashKioskAttemptToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
