# ADR — Capas de arquitectura y rutas delgadas (Fase 5)

**Estado:** Aceptado (parcialmente implementado)
**Fecha:** 2026-08-05

## Contexto

`lib/handlers.ts` acumula ~2000 líneas donde cada handler hace a la vez:
autorización, validación, persistencia, AWS, auditoría y formato de respuesta.
Esto dificulta testear, reutilizar y razonar sobre cada flujo.

## Decisión

Formalizar tres capas bajo `src/`:

1. **`src/modules/<dominio>/`** — service (orquesta), repository (persistencia),
   schemas (validación), types (contratos).
2. **`src/shared/`** — utilidades HTTP puras (`sendJson`, `sendError`) y
   cross-cutting.
3. **`src/infrastructure/`** — AWS, MongoDB y logging (hoy concentrados en
   `lib/`; se migran de forma incremental).

Las rutas API quedan **delgadas**: `requireX → schema.parse → service → sendJson`.

## Reglas

- Las rutas NO ejecutan lógica de negocio ni tocan AWS/Mongo directamente.
- Los servicios NO conocen HTTP ni el formato de respuesta (devuelven
  `{ status, body, cookies }`).
- Los repositories son la única capa que importa los modelos de Mongoose.
- La autorización SIEMPRE viaja por `lib/rbac.ts` (requerida en la ruta).

## Implementación de referencia (auth)

| Archivo | Rol |
|---|---|
| `src/modules/auth/auth.types.ts` | `LoginInput`, `RegisterInput`, `AuthResult`, DTOs |
| `src/modules/auth/auth.repository.ts` | `User` (findOne/findById/create) |
| `src/modules/auth/auth.service.ts` | login/logout/refresh/register + cookies + auditoría |
| `src/shared/http.ts` | `sendJson` / `sendError` |
| `app/api/auth/*/route.ts` | delgadas (rate limit → schema → service → sendJson) |

`lib/handlers.ts` conserva `handleLogin/handleLogout/handleRegister` como
adaptadores que delegan en `authService` (compatibilidad, sin duplicación).

## Mapeo actual → objetivo

| Hoy (`lib/`) | Módulo objetivo |
|---|---|
| `handlers.ts` (users, students, schedules, enrollments) | `modules/students` + `modules/access` |
| `scheduling.ts` (`canAccessLab`) | `modules/access` |
| `kiosk-verification.ts` | `modules/access` (pipeline kiosco) |
| `evidence.ts`, `alerts.ts`, `incidents` | `modules/incidents` |
| `consent.ts`, `biometrics.ts` | `modules/biometrics` |
| `reports.ts` | `modules/reports` |
| `s3.ts`, `rekognition.ts`, `sns.ts`, `cloudwatch.ts` | `infrastructure/aws` |
| `models.ts`, `db.ts` | `infrastructure/mongodb` |
| `audit.ts` | `infrastructure/logging` |
| `cors.ts`, `csrf.ts`, `errors.ts`, `http.ts` | `shared` |

## Consecuencias

- **Beneficios:** rutas testeables, servicios reutilizables, cobertura por
  dominio, menos acoplamiento.
- **Riesgo:** migración incremental; se conserva `lib/` como infraestructura
  hasta completar cada módulo. Sin reescrituras masivas.
- **Verificación:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
