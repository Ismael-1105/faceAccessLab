/**
 * Sesiones y refresh tokens opacos y revocables.
 *
 * El refresh token es un secreto aleatorio guardado en una cookie HttpOnly.
 * Solo se persiste su hash SHA-256 en la colección `Session`, de modo que una
 * fuga de la base de datos no expone tokens utilizables.
 */
import { randomBytes, createHash } from 'crypto';
import { Session } from './models.ts';
import { v4 as uuidv4 } from 'uuid';

const REFRESH_TOKEN_BYTES = 48;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

export function refreshTokenExpiry(): Date {
  const days = Number(process.env.REFRESH_TOKEN_DAYS || 7);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function clientMeta(req: Request): { userAgent?: string; ip?: string } {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim();
  return {
    userAgent: req.headers.get('user-agent')?.slice(0, 300),
    ip,
  };
}

export async function createSession(userId: string, refreshToken: string, req: Request): Promise<void> {
  const { userAgent, ip } = clientMeta(req);
  await Session.create({
    id: `ses-${uuidv4().slice(0, 8)}`,
    userId,
    refreshTokenHash: hashToken(refreshToken),
    userAgent,
    ip,
    createdAt: new Date(),
    expiresAt: refreshTokenExpiry(),
  });
}

/**
 * Rota un refresh token: revoca el anterior y emite uno nuevo. Si el token ya
 * fue rotado (reutilizado), se revocan todas las sesiones del usuario
 * (posible robo). Devuelve null si no hay sesión válida.
 */
export async function rotateSession(
  oldRefreshToken: string,
  req: Request,
): Promise<{ newRefreshToken: string; userId: string } | null> {
  const session = await Session.findOne({ refreshTokenHash: hashToken(oldRefreshToken) });
  if (!session) return null;
  if (session.revokedAt) {
    await revokeAllSessions(session.userId);
    return null;
  }
  if (session.expiresAt.getTime() < Date.now()) return null;

  await Session.updateOne({ id: session.id }, { $set: { revokedAt: new Date() } });
  const newRefreshToken = generateRefreshToken();
  await createSession(session.userId, newRefreshToken, req);
  return { newRefreshToken, userId: session.userId };
}

export async function revokeSession(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  await Session.updateOne(
    { refreshTokenHash: hashToken(refreshToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await Session.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

export async function countActiveSessions(userId: string): Promise<number> {
  return Session.countDocuments({ userId, revokedAt: { $exists: false } });
}
