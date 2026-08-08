/**
 * Capa centralizada de autorización (RBAC).
 *
 * Todas las rutas y handlers deben pasar por estas funciones. Elimina las
 * verificaciones duplicadas de rol y centraliza la lógica de permisos.
 */
import { ACCESS_COOKIE, getTokenFromRequest, verifyToken, type TokenPayload } from './auth.ts';

export type AppRole = 'admin' | 'docente' | 'estudiante';

/** Resultado de una verificación de autorización. */
export class ForbiddenError extends Error {
  status: number;
  constructor(message = 'Acceso restringido', status = 403) {
    super(message);
    this.status = status;
  }
}

export class UnauthorizedError extends Error {
  status: number;
  constructor(message = 'No autorizado') {
    super(message);
    this.status = 401;
  }
}

/** Resuelve el payload del token desde la request. */
export function getActor(req: Request): TokenPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

/** Lee una cookie del header `Cookie`. Devuelve null si no está o no decodifica. */
function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('Cookie');
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) {
      try {
        return decodeURIComponent(rawValue.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Excepción ÚNICA a la regla de `lib/auth.ts` ("nunca por cookie"): resuelve el
 * actor por cabecera Authorization y, si no la hay, por la cookie de acceso.
 *
 * Existe porque una etiqueta `<img>` no puede enviar cabeceras: el navegador
 * nunca añade Authorization a la petición de una imagen, así que el proxy de
 * fotografías devolvía 401 para toda foto alojada en S3.
 *
 * SOLO debe usarla `app/api/photos/[key]/route.ts`. El resto de la API sigue
 * exigiendo la cabecera. La cookie es HttpOnly y SameSite=Strict, y el token se
 * valida igual con `verifyToken`, así que no se relaja la verificación: solo se
 * amplía de dónde se lee. La autorización por recurso la sigue haciendo
 * `canReadPhoto`, que no se toca.
 */
export function getActorFromHeaderOrCookie(req: Request): TokenPayload | null {
  const fromHeader = getActor(req);
  if (fromHeader) return fromHeader;

  const token = readCookie(req, ACCESS_COOKIE);
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

/** Exige un usuario autenticado. Lanza UnauthorizedError si no hay sesión. */
export function requireAuth(req: Request): TokenPayload {
  const actor = getActor(req);
  if (!actor) throw new UnauthorizedError();
  return actor;
}

/** Exige un usuario autenticado, o devuelve null (para rutas opcionales). */
export function tryAuth(req: Request): TokenPayload | null {
  return getActor(req);
}

/** Exige que el rol esté en la lista permitida. */
export function requireRole(req: Request, roles: AppRole[]): TokenPayload {
  const actor = requireAuth(req);
  if (!roles.includes(actor.role as AppRole)) {
    throw new ForbiddenError();
  }
  return actor;
}

/** Exige rol administrador. */
export function requireAdmin(req: Request): TokenPayload {
  return requireRole(req, ['admin']);
}

/** Exige rol administrador o docente. */
export function requireTeacher(req: Request): TokenPayload {
  return requireRole(req, ['admin', 'docente']);
}

/** Exige rol estudiante. */
export function requireStudent(req: Request): TokenPayload {
  return requireRole(req, ['estudiante']);
}

/** Exige que el actor sea admin, o el docente propietario de la clase. */
export function canManageSchedule(req: Request, scheduleTeacherId: string): TokenPayload {
  const actor = requireAuth(req);
  if (actor.role === 'admin') return actor;
  if (actor.role === 'docente' && actor.userId === scheduleTeacherId) return actor;
  throw new ForbiddenError();
}

/** Exige que el actor sea admin, o el docente propietario del estudiante. */
export function canManageStudent(actor: TokenPayload, studentOwnedByTeacherId?: string): TokenPayload {
  if (actor.role === 'admin') return actor;
  if (actor.role === 'docente' && studentOwnedByTeacherId && actor.userId === studentOwnedByTeacherId) return actor;
  throw new ForbiddenError();
}

/** Exige que el actor pueda ver evidencias (admin ve todo; docente solo suyo). */
export function canViewEvidence(actor: TokenPayload, isOwnedByTeacher: boolean): boolean {
  if (actor.role === 'admin') return true;
  if (actor.role === 'docente') return isOwnedByTeacher;
  return false;
}

/** Exige que el actor pueda cerrar incidentes (solo admin). */
export function canCloseIncident(actor: TokenPayload): boolean {
  return actor.role === 'admin';
}
