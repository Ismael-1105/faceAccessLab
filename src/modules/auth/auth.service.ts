/**
 * Service del módulo de autenticación: orquesta login, logout, refresh y
 * registro. No toca HTTP (eso lo hace la ruta con sendJson) ni conoce la
 * persistencia (eso lo hace auth.repository).
 */
import {
  generateToken,
  serializeAccessCookie,
  serializeRefreshCookie,
  clearAuthCookies,
  readRefreshToken,
  comparePassword,
} from '@/lib/auth';
import { generateCsrfToken, serializeCsrfCookie, isCsrfValid } from '@/lib/csrf';
import { generateRefreshToken, createSession, rotateSession, revokeSession, revokeAllSessions } from '@/lib/sessions';
import { verifyTotp } from '@/lib/totp';
import { recordAudit } from '@/lib/audit';
import type { TokenPayload } from '@/lib/auth';
import * as authRepository from './auth.repository';
import type { AuthResult, AuthUserDTO, LoginInput, RegisterInput } from './auth.types';

function toDTO(user: { _id: unknown; email: string; name: string; role: string; studentId?: string; labCode?: string }): AuthUserDTO {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    studentId: user.studentId,
    labCode: user.labCode,
  };
}

function auditContext(actor: { email: string; role: string }, req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return {
    actor: actor.email,
    actorEmail: actor.email,
    actorRole: actor.role,
    ip,
    userAgent: req.headers.get('user-agent')?.slice(0, 300) || '',
  };
}

export async function login(req: Request, input: LoginInput): Promise<AuthResult> {
  const user = await authRepository.findUserByEmail(input.email);
  if (!user) return { status: 401, body: { error: 'Credenciales inválidas' } };

  if (user.status && user.status !== 'active') {
    return {
      status: 403,
      body: { error: user.status === 'suspended' ? 'Cuenta suspendida. Contacta al administrador.' : 'Cuenta inactiva. Contacta al administrador.' },
    };
  }

  const validPassword = await comparePassword(input.password, user.passwordHash);
  if (!validPassword) return { status: 401, body: { error: 'Credenciales inválidas' } };

  if (user.mfaEnabled) {
    if (!input.mfaToken || !user.mfaSecret || !verifyTotp(user.mfaSecret, input.mfaToken)) {
      return { status: 200, body: { mfaRequired: true, user: toDTO(user) } };
    }
  }

  const payload: TokenPayload = {
    userId: String(user._id),
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    labCode: user.labCode,
  };
  const accessToken = generateToken(payload);
  const refreshToken = generateRefreshToken();
  await createSession(String(user._id), refreshToken, req);

  await recordAudit({
    ...auditContext({ email: user.email, role: user.role }, req),
    action: 'auth.login',
    targetType: 'user',
    targetId: String(user._id),
    details: 'Inicio de sesión exitoso',
  });

  return {
    status: 200,
    body: { token: accessToken, user: toDTO(user) },
    cookies: [
      serializeAccessCookie(accessToken),
      serializeRefreshCookie(refreshToken),
      serializeCsrfCookie(generateCsrfToken()),
    ],
  };
}

export async function logout(req: Request): Promise<AuthResult> {
  if (!isCsrfValid(req)) return { status: 403, body: { error: 'Solicitud no válida' } };

  const refreshToken = readRefreshToken(req);
  if (refreshToken) {
    await revokeSession(refreshToken);
  }
  return { status: 200, body: { ok: true, message: 'Sesión cerrada' }, cookies: clearAuthCookies() };
}

export async function refresh(req: Request): Promise<AuthResult> {
  if (!isCsrfValid(req)) return { status: 403, body: { error: 'Solicitud no válida' } };

  const oldRefresh = readRefreshToken(req);
  if (!oldRefresh) return { status: 401, body: { error: 'No autorizado' } };

  const rotated = await rotateSession(oldRefresh, req);
  if (!rotated) return { status: 401, body: { error: 'Sesión expirada' }, cookies: clearAuthCookies() };

  const user = await authRepository.findUserById(rotated.userId);
  if (!user || (user.status && user.status !== 'active')) {
    return { status: 401, body: { error: 'No autorizado' }, cookies: clearAuthCookies() };
  }

  const accessToken = generateToken({
    userId: String(user._id),
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    labCode: user.labCode,
  });

  return {
    status: 200,
    body: { token: accessToken, user: toDTO(user) },
    cookies: [serializeAccessCookie(accessToken), serializeRefreshCookie(rotated.newRefreshToken)],
  };
}

export async function register(actor: TokenPayload, input: RegisterInput): Promise<AuthResult> {
  if (actor.role !== 'admin') return { status: 403, body: { error: 'Acceso restringido a administradores' } };

  const existing = await authRepository.findUserByEmail(input.email);
  if (existing) return { status: 409, body: { error: 'El email ya está registrado' } };

  const { hashPassword } = await import('@/lib/auth');
  const passwordHash = await hashPassword(input.password);
  const user = await authRepository.createUser({ email: input.email, passwordHash, name: input.name, role: input.role });
  return { status: 201, body: { user: toDTO(user) } };
}

export const authService = { login, logout, refresh, register };
