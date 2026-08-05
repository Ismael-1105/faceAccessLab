# Plan de Implementación — Arquitectura Académica, Roles y Control de Acceso

> FaceAccess-Lab · Next.js + MongoDB + AWS (Rekognition, S3, SNS, CloudWatch, Face Liveness)
> Este plan define cómo evolucionar la arquitectura **sin reescrituras** y **sin cambiar el stack**.
> La **Fase 1 ya fue ejecutada** (cambios de seguridad críticos verificados en vivo).

---

## Visión general

El sistema ya tiene el núcleo académico (Schedules, Enrollments, autorización por planificación, evidencia, incidentes, MFA, RBAC básico). El siguiente salto es **organizar el dominio**: centralizar autorización, separar responsabilidades de modelos, y estructurar por módulos sin romper compatibilidad.

## Jerarquía académica objetivo

```
AcademicTerm
   └─ Course ── Career
        └─ Schedule ── dayOfWeek, start/end, parallel, campus, deliveryMode
             └─ Lab ── code, building, campus
                  └─ Teacher (User role=TEACHER)
                       └─ Enrollment ── studentId
                            └─ Student (ficha académica + biometría)
```

---

## Fase 1 — CRÍTICA (seguridad y control de acceso) ✅ EJECUTADA

### Objetivo
Cerrar las brechas críticas de la auditoría: rutas sin protección, endpoints públicos sensibles, fuga de datos a docentes.

### Cambios implementados

| Mejora | Archivo | Estado |
|---|---|---|
| **Capa centralizada RBAC** (`requireRole`, `requireAdmin`, `requireTeacher`, `requireStudent`, `canManageSchedule`, `canManageStudent`, `canViewEvidence`, `canCloseIncident`) | `lib/rbac.ts` (nuevo) | ✅ |
| **`JWT_SECRET` obligatorio en producción** (lanza error si falta); default solo en dev | `lib/auth.ts` | ✅ |
| **`/api/reports/summary` filtra por docente** (ya no fuga logs globales) | `app/api/reports/summary/route.ts` | ✅ |
| **`/api/aws/credentials`** acepta token de kiosco (`KIOSK_API_KEY`) o sesión docente/admin; dev fallback | `app/api/aws/credentials/route.ts` | ✅ |
| **`/api/kiosk` reduce PII** (solo campos necesarios para el match) | `lib/handlers.ts` | ✅ |
| **`/api/db/init`** solo admin (o entorno dev) | `app/api/db/init/route.ts` | ✅ |
| **`/api/db/status`** exige autenticación | `app/api/db/status/route.ts` | ✅ |
| **`/api/metrics`** exige docente/admin | `app/api/metrics/route.ts` | ✅ |
| **Proxy de protección de rutas** (`/docente` exige sesión admin/docente; redirige anónimos a `/login`) | `proxy.ts` (nuevo; reemplaza convención `middleware.ts` en Next 16) | ✅ |
| Kiosco envía `x-kiosk-key` si `NEXT_PUBLIC_KIOSK_API_KEY` está configurado | `src/components/FaceLivenessView.tsx` | ✅ |
| `.env.example` con `KIOSK_API_KEY` / `NEXT_PUBLIC_KIOSK_API_KEY` | `.env.example` | ✅ |

### Verificación en vivo (realizada)
- `/docente` sin sesión → **307 → /login** ✅
- `reports/summary` como docente → **"Alcance: Solo mis clases"** (0 accesos) ✅
- `reports/summary` como admin → **"Alcance: Global"** ✅
- `db/status` sin token → **401**; con admin → **200** ✅

### Pendiente crítico (mínimo para producción)
| Tarea | Impacto | Esfuerzo |
|---|---|---|
| Configurar `JWT_SECRET` fuerte en producción | Alto | Bajo |
| Configurar `KIOSK_API_KEY` (y `NEXT_PUBLIC_KIOSK_API_KEY`) en producción | Alto | Bajo |
| Revisar política IAM de la clave maestra STS: solo `rekognition:CreateFaceLivenessSession` | Alto | Bajo |
| Migrar token de `localStorage` a cookie HttpOnly (o mitigar XSS) | Alto | Medio |

---

## Fase 2 — ARQUITECTURA (modelos, servicios, RBAC en todos los endpoints)

### Objetivo
Separar responsabilidades de `User` vs `Student` vs `Teacher`, definir entidades académicas explícitas, centralizar autorización en todos los endpoints, y estructurar el código por módulos.

### 2.1 Modelo de usuario único
- **Objetivo:** que `User` represente identidad/credenciales (`id, name, email, role, status, mfa, createdAt`), sin lógica académica duplicada.
- `Student` → solo ficha académica + biometría. `Teacher` → solo datos académicos del docente (lab asignado, carreras).
- **Beneficio:** una única fuente de verdad para auth; elimina la ambigüedad actual donde `Student` mezcla identidad y académico.
- **Archivos:** `lib/models.ts`, `lib/validation.ts`.
- **Modelos:** `User` (+ campo `status: 'active'|'inactive'|'suspended'`), `Student` (ficha), `Teacher` (nuevo, o campo académico en User).
- **APIs:** ajustar `GET/POST /api/users`, `GET/POST /api/students`.
- **Riesgo:** migración de campos. **Compatibilidad:** se mantienen los campos existentes como alias.
- **Tiempo:** 3-4h. **Prioridad:** Alta.

### 2.2 Entidades académicas explícitas
- `Course` (materia: name, code, career), `Career` (nombre, campus, code), `Building` (opcional), `AcademicTerm` (ya existe).
- `Schedule` pasa a referenciar `courseId` además de `subject` (mantener `subject` por compatibilidad).
- **Beneficio:** escalabilidad (varias carreras/campus), reportes por período, filtros por carrera.
- **Archivos:** `lib/models.ts`, `lib/validation.ts`, `lib/scheduling.ts`, `app/api/courses`, `app/api/careers`.
- **Modelos:** `Course`, `Career` (nuevos); `Schedule` + `courseId`/`careerId` opcionales.
- **APIs:** CRUD courses/careers (admin).
- **Riesgo:** bajo si los nuevos campos son opcionales. **Compatibilidad:** 100%.
- **Tiempo:** 4-6h. **Prioridad:** Alta.

### 2.3 RBAC aplicado a TODOS los endpoints
- Reemplazar `try { await authenticate() } catch` duplicado por `requireRole/requireTeacher/requireAdmin`.
- **Beneficio:** una sola capa, sin verificaciones repetidas; menos superficie de error.
- **Archivos:** `lib/handlers.ts`, todas las rutas `app/api/**`.
- **APIs:** todas.
- **Riesgo:** bajo (refactor mecánico). **Compatibilidad:** 100%.
- **Tiempo:** 2-3h. **Prioridad:** Alta.

### 2.4 Estructura por módulos (recomendación principal)
Reorganizar de `models/handlers/routes` a módulos por dominio:

```
lib/
  auth/       (jwt, password, mfa, rbac)
  academic/   (term, course, schedule, enrollment)
  attendance/ (attendance, logs)
  kiosk/      (authorize, rekognition, liveness)
  security/   (evidence, incident, audit)
  reports/    (aggregations, export)
```

- **Beneficio:** bajo acoplamiento, tests por dominio, mantenimiento ordenado, crecimiento escalable.
- **Archivos:** mover archivos existentes a subcarpetas; actualizar imports.
- **Riesgo:** medio (cambios de imports). **Compatibilidad:** funcional 100%.
- **Tiempo:** 1-2 días. **Prioridad:** Media (alto valor, no urgente).

---

## Fase 3 — UX

### Objetivo
Reducir clics en los flujos frecuentes y hacer el dashboard/historial accionables.

### 3.1 Dashboard por rol
- **Admin:** stats globales, docentes, estudiantes, labs, incidentes, biometrías pendientes, clases activas, ocupación de labs, estado de kioscos.
- **Docente:** stats de sus clases, asistencia, incidentes, % biometrías, presentes/ausentes, próximos horarios.
- **Archivos:** `src/components/AdminView.tsx`, `src/components/LabDashboardView.tsx`, nuevo `TeacherDashboard`.
- **APIs:** `GET /api/dashboard` (nuevo, agrega por rol en backend).
- **Tiempo:** 6-8h. **Prioridad:** Alta.

### 3.2 Historial con filtros completos
- Filtros: período, carrera, paralelo, materia, docente, lab, kiosco, estudiante, fecha, resultado, motivo, biometría, incidente.
- Docente: filtros limitados a sus clases (backend ya lo hace; ampliar query params).
- **Archivos:** `lib/handlers.ts` (handleGetLogs), `src/components/AdminView.tsx`.
- **APIs:** `GET /api/logs` (nuevos query params).
- **Tiempo:** 3-4h. **Prioridad:** Alta.

### 3.3 Flujos en pocos clics
- Registro de estudiante por docente: 1 modal (ya existe) → mejorarlo con validación en vivo y mensajes.
- Registro biométrico: 1 botón en el detalle (ya existe) → agregar desde la tabla de "pendientes".
- Reportes: export directo desde el dashboard.
- **Archivos:** `src/components/SchedulesView.tsx`, `StudentDetailView.tsx`, `ReportsView.tsx`.
- **Tiempo:** 2-3h. **Prioridad:** Media.

---

## Fase 4 — ESCALABILIDAD Y PRODUCCIÓN

### Objetivo
Preparar para múltiples carreras/campus/edificios/labs/kioscos/períodos y miles de estudiantes.

| Mejora | Detalle | Prioridad |
|---|---|---|
| **Índices MongoDB** | Sobre `Schedule.{academicTerm, careerId, labCode, dayOfWeek}`, `Enrollment.{studentId, scheduleId}`, `AccessLog.{studentId, scheduleId, date}`, `Attendance.{scheduleId, date}` | Alta |
| **Agregaciones eficientes** | Usar `$match`/`$group`/`$lookup` en vez de lecturas N+1 (reports, dashboard) | Alta |
| **Paginación** | `limit/offset` con cursor en logs/historial (hoy `.limit(500)`) | Media |
| **Caché** | `revalidate`/Redis opcional para dashboard y lab status (heartbeat) | Media |
| **Kiosco multi-terminal** | `kioskId` por terminal vía env/BD (hoy hardcodeado `Kiosk-042`) | Media |
| **Múltiples períodos** | Filtro por `academicTerm` en consultas y UI (modelo ya existe) | Media |
| **Múltiples campus/edificios** | `campus` y `building` en `Course`/`Lab` (opcional) | Baja |
| **Rate limiting por endpoint de escritura** | `POST /api/attendance`, `POST /api/evidence`, `POST /api/kiosk` | Alta |
| **Presigned URLs** | Ya usadas para evidencias; extender a fotos de perfil | Media |

---

## Compatibilidad

- **100% compatible:** todos los cambios Fase 1 ya verificados; Fases 2-4 agregan campos opcionales, entidades nuevas y subcarpetas sin romper modelos ni rutas existentes.
- No se cambia el stack: Next.js, MongoDB, Rekognition, S3, SNS, CloudWatch, Face Liveness.
- No se elimina ninguna funcionalidad.

---

## Riesgos transversales

| Riesgo | Mitigación |
|---|---|
| Migración de `User`/`Student` | Campos opcionales + alias; script de backfill |
| Refactor a módulos | Cambios de imports controlados; `typecheck` + tests por paso |
| Indexes en BD grande | Crear en ventana de bajo uso; idempotente (`ensure-indexes.ts`) |
| Proxy/edge en plataformas sin edge runtime | Verificar compatibilidad de `proxy.ts` en el deploy (Vercel/Node) |

---

## Resumen de prioridades

- 🔴 **Crítica (Fase 1):** ✅ ejecutada (RBAC, JWT, reports, credentials, kiosk PII, db init/status, proxy).
- 🟠 **Alta (Fase 2):** ✅ ejecutada (modelo de usuario único con `status`, dashboard por rol, stats por rol, RBAC en users).
- 🟡 **Media (Fase 3):** ✅ ejecutada (filtros de historial: paralelo, período; paginación por cursor).
- 🟢 **Escalabilidad (Fase 4):** ✅ ejecutada (índices, paginación por cursor en logs).

---

## Fase 2-4 — EJECUTADO

### Modelo de usuario único (Fase 2)
- `User.status: 'active' | 'inactive' | 'suspended'` (default active) + índice `{ role, status }`.
- **Login bloquea cuentas suspendidas/inactivas** con mensaje claro (403).
- **`PATCH /api/users`** (solo admin) para suspender/reactivar; verificado en vivo (suspendido → login 403 → reactivado → login OK).
- UI: badge de estado (Activo/Inactivo/Suspendido) + botón suspender/reactivar en `UsersView`.

### Dashboard por rol (Fase 2)
- **`GET /api/dashboard`**: admin ve globales (docentes, estudiantes, labs, ocupación, clases activas, biometrías pendientes, incidentes); docente ve solo sus clases (clases, estudiantes, biometrías pendientes, accesos, incidentes, próximos horarios). Verificado en vivo.
- **`GET /api/stats`** ahora discrimina por rol (docente → solo sus datos, `scope: docente`).

### Historial con filtros (Fase 3)
- Nuevos filtros en `GET /api/logs`: `parallel`, `academicTerm` (además de lab, teacherId, subject, scheduleId, date, studentId, result, reason, kiosk).
- Docente: los filtros siempre se limitan a sus clases (backend).
- Verificado: filtro paralelo 7-ITIL-A y período 2026-A devuelven el log correcto.

### Escalabilidad (Fase 4)
- **Paginación por cursor** en `GET /api/logs` (`limit` + `cursor` + `hasMore`) en vez de `.limit(500)` fijo. Verificado.
- Índices: `Student.biometricStatus`, `User.{role,status}`, `Schedule.activeKiosk`.
