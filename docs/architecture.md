# Arquitectura — FaceAccess Lab

> Resumen de la arquitectura del sistema: stack, estructura del código, modelos de datos y servicios cloud.

## Visión general

Aplicación **Next.js 16** (App Router) con una sola base de código que contiene:

- **Frontend** — páginas y componentes React (kiosco, portal, login).
- **Backend** — API routes en `app/api/**` con lógica en `lib/**`.
- **Integraciones AWS** — Rekognition, S3, SNS, CloudWatch, STS y Face Liveness.

Los datos viven en **MongoDB Atlas** (Mongoose). El despliegue es **Vercel** con `output: 'standalone'` (`next.config.ts`).

```
Navegador (kiosco) ──▶ /api/kiosk/* ──▶ lib/kiosk-verification.ts ──▶ AWS Rekognition / Face Liveness
Navegador (portal) ──▶ /api/* ──▶ lib/handlers.ts ──▶ MongoDB + AWS (S3, SNS, CloudWatch)
```

## Estructura de carpetas

```
app/
  api/                    # Endpoints (route handlers de Next.js)
    auth/                 # login, logout, mfa, register
    kiosk/                # attempt, session, verify (flujo de terminal)
    rekognition/          # collection, index, list, search (gestión biométrica)
    students/ labs/ schedules/ enrollments/ terms/
    logs/ attendance/ evidence/ incidents/ alerts/ audit/
    reports/ stats/ metrics/ dashboard/
    photos/ upload/ aws/ db/ health/
  kiosco/                 # Página pública del terminal
  login/ recuperar/       # Autenticación del portal
  docente/                # Portal administrativo (protegido)
lib/
  auth.ts                 # JWT, bcrypt, helpers de respuesta
  rbac.ts                 # Capa centralizada de autorización
  models.ts               # Schemas de Mongoose
  validation.ts           # Validación de entrada
  handlers.ts             # Lógica de negocio de las APIs
  scheduling.ts           # canAccessLab (autorización por horario)
  kiosk-verification.ts   # Pipeline de verificación del kiosco
  rekognition.ts          # Cliente AWS Rekognition
  liveness.ts             # Sesiones AWS Face Liveness
  s3.ts / sns.ts / cloudwatch.ts
  totp.ts                 # MFA (RFC 6238)
  rate-limit.ts / distributed-rate-limit.ts / request-body.ts
  attendance-idempotency.ts / kiosk-attempt-auth.ts / kiosk-attempt-cookie.ts
  evidence.ts / photo-access.ts / capture.ts / alerts.ts / audit.ts / reports.ts
src/
  components/             # Vistas React del portal y del kiosco
  context/                # AppContext (sesión, temas, estado global)
  hooks/                  # useKioskFlow, useCameraPermission, useFaceFraming
  lib/                    # Cliente de API, textos de liveness, feedback del kiosco
proxy.ts                  # Middleware de protección de rutas
```

## Modelos de datos (MongoDB)

Definidos en `lib/models.ts`.

| Colección | Modelo | Descripción |
|---|---|---|
| `users` | `User` | Identidad y credenciales: `name, email, passwordHash, role (admin/docente/estudiante), status (active/inactive/suspended), mfa, labCode`. |
| `students` | `Student` | Ficha académica + biometría: `name, career, phone, email, status (allowed/denied), matchPercentage, biometricStatus`. |
| `access_logs` | `AccessLog` | Registro de cada intento: resultado, similitud, lab, kiosco, motivo, `attemptId` (idempotente). |
| `attendances` | `Attendance` | Asistencia por estudiante/clase/día; el primer acceso del día gana (idempotente). |
| `schedules` | `Schedule` | Clase: `subject, teacherId, labCode, dayOfWeek, startTime, endTime, parallel, academicTerm`. |
| `enrollments` | `Enrollment` | Matrícula estudiante↔clase. |
| `labs` | `Lab` | `code, name, description, active, building, campus`. |
| `terms` | `AcademicTerm` | Período académico. |
| `alerts` | `Alert` | Alertas con ciclo `active → acknowledged → resolved`. |
| `incidents` | `Incident` | Incidentes de accesos denegados repetidos. |
| `denial_evidence` | `DenialEvidence` | Evidencia (foto S3 + motivo) de denegados. |
| `audit_logs` | `AuditLog` | Auditoría de operaciones sensibles (TTL 365 días). |
| `kiosk_attempts` | `KioskAttempt` | Intento efímero del kiosco con token y expiración (~3 min). |
| `rate_limit_buckets` | `RateLimitBucket` | Rate limiting distribuido (compartido en MongoDB). |

## Servicios AWS

| Servicio | Uso |
|---|---|
| **Rekognition** | Colección `faceaccess-lab-students`: indexar rostros (`IndexFaces`), buscar identidad (`SearchFacesByImage`), gestionar caras. |
| **Face Liveness** | Sesión anti-suplantación (`CreateFaceLivenessSession` / `GetFaceLivenessSessionResults`). |
| **S3** | Fotos de perfil (`students/{id}.jpg`) y evidencias de denegados; servidas con presigned URLs. |
| **SNS** | Alertas push (incidentes de accesos denegados). |
| **CloudWatch** | Métricas: accesos concedidos/denegados, liveness verificados/fallidos. |
| **STS** | Credenciales temporales de corta duración para que el navegador ejecute el detalle de liveness. |

## Decisiones clave

- **El navegador nunca decide la identidad.** La verificación usa la imagen de referencia que produce AWS Face Liveness en el servidor (`lib/kiosk-verification.ts`). La captura del navegador solo se conserva como evidencia.
- **Idempotencia.** `AccessLog` y `Attendance` usan IDs deterministas (`attendance-idempotency.ts`) para que reintentos o réplicas no dupliquen registros.
- **RBAC centralizado.** Toda API pasa por `lib/rbac.ts` (`requireRole`, `requireAdmin`, `requireTeacher`, `canManageSchedule`, ...).
- **Token en cookie.** El portal usa el token JWT vía cookie `token` (ver `docs/authentication.md`).

Ver también: `docs/biometric-flow.md`, `docs/authentication.md`.
