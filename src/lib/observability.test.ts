import { describe, expect, it, vi, afterEach } from 'vitest';
import { logger, log, getRequestId, newRequestId } from '../../lib/observability.ts';

function capture(level: 'log' | 'warn' | 'error') {
  const spy = vi.spyOn(console, level).mockImplementation(() => {});
  return spy;
}

describe('observability: logging estructurado', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emite JSON con nivel, evento y timestamp', () => {
    const spy = capture('log');
    logger.info('kiosk.verification.completed', { attemptId: 'kat-1', decision: 'denied', reason: 'outside_schedule', durationMs: 842 });
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe('info');
    expect(parsed.event).toBe('kiosk.verification.completed');
    expect(parsed.attemptId).toBe('kat-1');
    expect(parsed.decision).toBe('denied');
    expect(parsed.timestamp).toBeTruthy();
  });

  it('NUNCA registra tokens, contraseñas, imágenes ni embeddings', () => {
    const spy = capture('log');
    logger.info('test.security', {
      requestId: 'r1',
      token: 'eyJ-secreto',
      password: 'pwd',
      imageBase64: 'data:image/jpeg;base64,ZmFrZQ==',
      faceEmbeddingId: 'face-123',
      photoUrl: 'https://bucket/students/x.jpg',
      attemptId: 'kat-1',
    });
    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toContain('eyJ-secreto');
    expect(line).not.toContain('pwd');
    expect(line).not.toContain('ZmFrZQ==');
    expect(line).not.toContain('face-123');
    expect(line).not.toContain('students/x.jpg');
    expect(line).toContain('kat-1');
    expect(line).toContain('requestId');
  });

  it('los errores usan console.error con el mismo formato', () => {
    const spy = capture('error');
    log('error', 'db.connection.failed', { error: 'boom' });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.event).toBe('db.connection.failed');
  });
});

describe('observability: requestId', () => {
  it('usa la cabecera X-Request-Id si existe', () => {
    const req = new Request('http://localhost/x', { headers: { 'X-Request-Id': 'abc-123' } });
    expect(getRequestId(req)).toBe('abc-123');
  });

  it('genera un requestId único cuando no hay cabecera', () => {
    const req = new Request('http://localhost/x');
    const a = getRequestId(req);
    const b = getRequestId(new Request('http://localhost/x'));
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
    expect(newRequestId()).toBeTruthy();
  });
});
