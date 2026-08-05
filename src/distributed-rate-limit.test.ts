import { describe, expect, it } from 'vitest';
import { getClientAddress } from '../lib/distributed-rate-limit.ts';

describe('identificación de cliente para rate limit', () => {
  it('usa únicamente la primera IP enviada por el proxy', () => {
    const req = new Request('http://localhost/api/kiosk/attempt', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.2' },
    });
    expect(getClientAddress(req)).toBe('203.0.113.10');
  });

  it('usa x-real-ip cuando no existe x-forwarded-for', () => {
    const req = new Request('http://localhost/api/kiosk/attempt', {
      headers: { 'x-real-ip': '203.0.113.20' },
    });
    expect(getClientAddress(req)).toBe('203.0.113.20');
  });
});
