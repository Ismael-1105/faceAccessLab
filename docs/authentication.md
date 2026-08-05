# Autenticación — FaceAccess Lab

Cómo se autentican los usuarios del portal (docente/admin) y cómo se protegen las rutas y las APIs.

## Flujo de login

1. El usuario envía `POST /api/auth/login` con `email` + `password`.
2. Se aplica **rate limiting por IP** (`lib/rate-limit.ts`, `RATE_LIMITS.login`, por defecto 5 intentos/minuto).
3. `lib/handlers.ts` (`handleLogin`) valida las credenciales con **bcrypt** (`comparePassword`).
4. Si la cuenta está **suspendida o inactiva**, el login responde `403` con mensaje claro.
5. Si el usuario tiene **MFA** activo, el login responde con un indicador `mfaRequired` y se continúa en `/api/auth/mfa` (TOTP).
6. En éxito se emite un **JWT** (`lib/auth.ts`) con payload `{ userId, email, role, labCode }`, expiración **24 h**.

El token se envía al navegador como cookie `token` y también se acepta vía header `Authorization: Bearer <token>`.

## JWT

- Algoritmo: HMAC (biblioteca `jsonwebtoken`), secreto `JWT_SECRET`.
- **`JWT_SECRET` es obligatorio en producción**; en desarrollo hay un valor por defecto que nunca debe usarse en un entorno real (`lib/auth.ts`).
- Revalidación: `verifyToken` / `getAuthPayload` en cada request.

## RBAC

`lib/rbac.ts` centraliza la autorización. Toda API usa estas funciones en lugar de validar roles manualmente.

| Función | Permite |
|---|---|
| `requireAuth(req)` | Cualquier usuario con token válido (401 si no). |
| `requireRole(req, roles)` | Roles de la lista. |
| `requireAdmin(req)` | Solo `admin`. |
| `requireTeacher(req)` | `admin` o `docente`. |
| `requireStudent(req)` | Solo `estudiante`. |
| `canManageSchedule(req, teacherId)` | Admin, o el docente propietario de la clase. |
| `canManageStudent(actor, teacherId)` | Admin, o el docente propietario del estudiante. |
| `canViewEvidence(actor, owned)` | Admin ve todo; docente solo sus evidencias. |
| `canCloseIncident(actor)` | Solo admin. |

## Protección de rutas (middleware)

`proxy.ts` es el middleware de presentación:

- `/login` — redirige al panel si ya hay sesión.
- `/docente` — exige sesión con rol `admin` o `docente`; anónimos y estudiantes → `/login`.
- `/kiosco`, `/recuperar`, `/` — públicas.

> La autorización real siempre se vuelve a validar en el backend (RBAC). El middleware solo protege la capa de presentación.

## MFA (TOTP)

- `lib/totp.ts` implementa **TOTP RFC 6238** (SHA-1, 6 dígitos, período 30 s) sin dependencias externas.
- `POST /api/auth/mfa` valida el código de 6 dígitos contra el secreto del usuario.
- El alta de MFA se hace desde el portal (`src/components/MfaSetup.tsx`): el usuario escanea un secreto manual / URL `otpauth` y confirma con un código.
- Los códigos de entrada se restringen a **solo dígitos** (6) tanto en `LoginView` como en `MfaSetup`.

## Almacenamiento del token

- **Cookie `token`** (no HttpOnly por ahora): ver `docs/security.md` para el riesgo y la mitigación recomendada (migrar a cookie HttpOnly o reforzar CSP/XSS).
- `proxy.ts` lee el token desde la cookie `token` o desde el header `Authorization`.

## Cuentas seed

El seed crea cuentas de demostración (`admin@faceaccess.lab`, `docente@faceaccess.lab`). Ver `README.md` → "Credenciales de demostración".

Ver también: `docs/security.md`, `docs/environment-variables.md`.
