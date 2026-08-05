import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth.ts', () => ({
  getAuthPayload: vi.fn().mockReturnValue(null),
}));

import { GET } from '../app/api/health/route.ts';

describe('health: ping público del kiosco', () => {
  it('responde 200 con liveness ligero sin sesión (sin tocar DB/AWS)', async () => {
    const res = await GET(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('api');
    expect(body.timestamp).toBeTruthy();
  });
});
