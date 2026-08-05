# Informe de Auditoría — Gestión de Usuarios, Roles y Permisos

> **FaceAccess-Lab** · Next.js 16 + MongoDB + AWS Rekognition/S3/SNS/CloudWatch
> Auditoría estática del código, modelos, APIs y verificación de integridad contra MongoDB real.
> Fecha: 2026-08-02 · **Sin cambios implementados** (solo análisis).

---

## 0. Resumen ejecutivo

**Estado general: BUENO con brechas críticas de aislamiento y de exposición pública.**

El sistema tiene una base sólida: los modelos y handlers filtran por rol en la mayoría de las consultas (`handleGetStudents`, `handleGetSchedules`, `handleGetLogs`, `handleGetIncidents`, `handleGetEvidence`), el kiosco valida correctamente la cadena completa (liveness → match → clase activa → materia presencial → inscripción → biometría → asistencia), y la integridad referencial Docente→Clase→Inscripción→Estudiante es correcta (0 duplicados, 0 clases sin docente, 0 inscripciones con scheduleId inválido).

**Sin embargo**, se encontraron **4 hallazgos críticos** que comprometen el control de acceso:

1. 🔴 **No existe middleware de protección de rutas** → cualquier ruta (`/docente`, `/admin`, `/kiosco`) es accesible sin sesión; el redireccionamiento es client-side y no bloquea.
2. 🔴 **Todos los roles redirigen a `/docente` y este muestra `AdminView` sin filtrar por rol** → un usuario `estudiante` (o un JWT alterado) vería el panel administrativo completo.
3. 🔴 **`/api/aws/credentials` emite credenciales STS sin autenticación** (solo rate limit por IP) → cualquiera puede obtener credenciales temporales de AWS.
4. 🔴 **`/api/reports/summary` no filtra por docente** → un docente puede ver los logs de **todos** los estudiantes.

Además: **80 inscripciones huérfanas** (referencias rotas a estudiantes eliminados), 51 AccessLogs huérfanos, y el rol `estudiante` existe en el modelo pero **no tiene panel ni flujo de uso**.

---

## 1. Diagrama de relaciones (verificado en modelos y BD)

```
Usuario (User)
 ├─ rol: 'admin'   → Consola de Control (AdminView, tabs admin)
 ├─ rol: 'docente' → Panel Académico (AdminView, tabs restringidos)
 └─ rol: 'estudiante' → SIN PANEL (no implementado)
          │
          ▼
Schedule (Clase) ── teacherId ──► User(docente)
   │  ├─ labCode ──► Lab
   │  └─ deliveryMode / requiresPhysicalAccess / activeKiosk
   ▼
Enrollment ── scheduleId ──► Schedule
   └── studentId ──► Student
                       ├─ biometricStatus (pending | registered)
                       └─ faceEmbeddingId ──► Rekognition
                            ▼
                        Kiosco (público, sin auth)
```

**Estado en BD:** 7 usuarios (1 admin + 6 docentes) · 30 estudiantes · 6 Schedules · 132 Enrollments · 6 Labs · 0 usuarios rol `estudiante`.

---

## 2. Auditoría del inicio de sesión

### Flujo verificado
`POST /api/auth/login` → valida email/password (bcrypt) → si MFA habilitado exige TOTP (`verifyTotp`) → emite JWT HS256 (`expiresIn: '24h'`) → `LoginView` llama `router.push('/docente')`.

| Verificación | Resultado | Detalle |
|---|---|---|
| ¿Puede un **admin** iniciar sesión? | ✅ Sí | Redirigido a `/docente` (equivocado: debería ir a su consola) |
| ¿Puede un **docente** iniciar sesión? | ✅ Sí | Redirigido a `/docente` ✅ |
| ¿Puede un **estudiante** iniciar sesión? | ⚠️ Técnicamente sí | El login acepta cualquier rol; no hay `User` con rol estudiante, pero si existiera, entraría a `/docente` |
| ¿Cada uno a su panel? | 🔴 **No** | **Todos** van a `/docente` (client-side), que muestra `AdminView` para cualquier usuario autenticado |
| JWT | ✅ | `jsonwebtoken`, 24h, firmado |
| Cookies | ❌ No | El token se guarda en `localStorage` (`setToken`) — vulnerable a XSS |
| Middleware de rutas | 🔴 **No existe** | Ningún `middleware.ts`; todas las páginas son accesibles sin sesión |
| Refresh token | ❌ No | Solo access token 24h; al expirar, sesión perdida (no renovable) |
| MFA | ✅ | TOTP con `crypto` nativo (`lib/totp.ts`), setup/verify/disable |
| Protección de rutas | 🔴 No | `/docente`, `/kiosco`, `/login` sin guard server-side |

### Hallazgos
- **A1 (🔴)** `/docente/page.tsx` muestra `AdminView` para cualquier `user` autenticado, sin filtrar por rol. Un JWT con `role: 'estudiante'` (o alterado) vería el panel.
- **A2 (🔴)** El token vive en `localStorage` → cualquier XSS roba la sesión. No hay HttpOnly cookies.
- **A3 (🟡)** Sin refresh token; el JWT de 24h no es revocable al hacer logout (solo se borra del cliente).

---

## 3. Auditoría de roles

### Administrador — verificado
| Permiso | ¿Implementado? | Cómo |
|---|---|---|
| Crear docentes | ✅ | `POST /api/users` (requireAdmin) |
| Crear laboratorios | ✅ | `POST /api/labs` (requireAdmin) |
| Crear clases/horarios | ✅ | `POST/PUT/DELETE /api/schedules` (role admin) |
| Registrar estudiantes | ✅ | `POST /api/students` (admin puede sin scheduleId) |
| Eliminar estudiantes | ✅ | `DELETE /api/students` |
| Ver todos los estudiantes/docentes | ✅ | `handleGetStudents`/`handleGetUsers` (sin filtro admin) |
| Modificar cualquier info | ✅ | `handleUpdateStudent`, `handleUpdateUser` (admin) |
| Cerrar incidentes | ✅ | `handleUpdateIncident` (role admin) |
| Consultar evidencias | ✅ | `handleGetEvidence` (admin ve todo) |
| Generar reportes | ✅ | `/api/reports/attendance`, `/api/reports/summary` |

### Docente — verificado
| Permiso | ¿Implementado? | Cómo |
|---|---|---|
| Iniciar sesión | ✅ | Login genérico |
| Ver sus clases/horarios | ✅ | `handleGetSchedules` filtra `{ teacherId }` |
| Ver sus laboratorios | ✅ | Vía clases |
| Registrar estudiantes de sus clases | ✅ | `handleCreateStudent` exige `scheduleId` propio (403 si ajeno) |
| Registrar biometrías | ✅ | `POST /api/rekognition/register-biometric` (valida `teacherOwnsStudent`) |
| Consultar asistencia | ✅ | `handleGetAttendance` filtra por `scheduleId` del docente |
| Consultar incidentes de sus labs | ✅ | `handleGetIncidents` filtra por estudiantes inscritos |
| Evidencias de sus estudiantes | ✅ | `handleGetEvidence` filtra por inscritos |
| Reportes de sus clases | ✅ | `handleGetAttendanceReport` → `scope: docente` |
| **NO** modificar horarios | ✅ Bloqueado | `handleUpdateSchedule`: solo `status`, protege keys |
| **NO** modificar laboratorios | ✅ Bloqueado | Ídem + `handleUpdateStudent` bloquea `lab/labs` |
| **NO** modificar otros docentes | ✅ | `/api/users` solo admin |
| **NO** modificar otros estudiantes | ✅ | `teacherOwnsStudent` en update/toggle/delete |
| **NO** ver info de otros docentes | ✅ | Filtros por `teacherId` en consultas principales |

### Estudiante
- El rol **existe en el modelo** (`'estudiante'` en `IUser.role`) y en el tipo `UserRole`, **pero no se usa en ninguna parte**:
  - `handleRegister` permite crear usuarios `estudiante` (solo admin), pero no hay panel, rutas ni flujo.
  - **0 usuarios** con rol estudiante en la BD.
  - **Recomendación:** es conveniente implementarlo (portal del estudiante: ver su horario, su asistencia, sus clases) pero **no es crítico** para el flujo actual de kiosco, que usa `Student` (ficha biométrica) sin login. Prioridad media.

---

## 4. Relación Docente → Clase → Estudiantes (verificada en BD)

```
Teacher → Schedule.teacherId → Enrollment.scheduleId → Student
```

| Verificación | Resultado |
|---|---|
| ¿Cada clase tiene un docente? | ✅ 0 clases sin docente (6/6 con `teacherId` válido) |
| ¿Cada inscripción pertenece a una clase? | ✅ 0 con `scheduleId` inválido |
| ¿Cada estudiante en sus clases? | ✅ Todos los 30 estudiantes tienen inscripciones |
| ¿Un estudiante en varias materias? | ✅ Sí (p.ej. Estalin en 4 materias; Madeleine en 3) |
| ¿Docente ve estudiantes de otro docente? | ✅ No — `handleGetStudents` filtra por sus `scheduleIds` |
| ¿Estudiantes huérfanos? | ✅ 0 sin inscripción |
| ¿Clases sin docente? | ✅ 0 |
| ¿Inscripciones inválidas? | ⚠️ **80 con `studentId` inexistente** (huérfanas de estudiantes eliminados) |

**Hallazgo D1 (🟡):** 80 inscripciones apuntan a estudiantes que fueron eliminados (ficticios de fases previas). No rompen el flujo actual (los `Enrollment` huérfanos no generan autorización porque el `Student` no existe en el match), pero ensucian conteos y reportes.

---

## 5. Registro de estudiantes

### Por administrador
1. `POST /api/students` (sin `scheduleId` → no auto-inscribe) + `POST /api/enrollments` por clase. ✅
2. Biometría: solo si se captura foto en `EnrollmentView` (sube a S3 + Rekognition). Si no, `biometricStatus` queda `pending`. ✅
3. Auditoría: `student.create` con actor. ✅

### Por docente
| Paso | ¿OK? | Detalle |
|---|---|---|
| Solo sus clases | ✅ | `handleCreateStudent` valida `scheduleForEnroll.teacherId === actor.userId` |
| Inscripción automática | ✅ | Crea `Enrollment` al matricular con `scheduleId` |
| Laboratorio heredado | ✅ | `lab`/`labs` desde el `Schedule.labCode` |
| Horario heredado | ✅ | Definido por la clase (`canAccessLab`) |
| Auditoría | ✅ | `student.create` con `after: { lab, scheduleId }` |

---

## 6. Seguridad de APIs (matriz completa)

| Endpoint | Auth | Rol | Permisos | Riesgo |
|---|---|---|---|---|
| `POST /api/auth/login` | No | — | Rate limit IP | 🟢 Bajo |
| `POST /api/auth/logout` | Sí | Cualquiera | Auditoría | 🟢 |
| `POST /api/auth/register` | Sí | Admin | Crea usuario (docente/estudiante) | 🟢 |
| `POST /api/auth/mfa` | Mixto | Autenticado + acción pública 'login' | TOTP | 🟢 |
| `GET /api/users` | Sí | Admin | — | 🟢 |
| `POST/PUT/DELETE /api/users` | Sí | Admin | — | 🟢 |
| `GET /api/labs` | Sí | Cualquiera auth | — | 🟢 |
| `POST/PUT/DELETE /api/labs` | Sí | Admin | — | 🟢 |
| `GET /api/schedules` | Sí | Cualquiera | Docente ve solo los suyos | 🟢 |
| `POST/DELETE /api/schedules` | Sí | Admin | — | 🟢 |
| `PUT /api/schedules` | Sí | Admin/Docente | Docente solo `status` de sus clases | 🟢 |
| `GET/POST /api/enrollments` | Sí | Admin/Docente | Docente solo sus clases | 🟢 |
| `DELETE /api/enrollments` | Sí | Admin/Docente | Docente solo sus clases | 🟢 |
| `GET /api/students` | Sí | Admin/Docente | Docente filtra por inscritos | 🟢 |
| `POST /api/students` | Sí | Admin/Docente | Docente exige su `scheduleId` | 🟢 |
| `PUT/DELETE /api/students`, `/toggle` | Sí | Admin/Docente | Docente `teacherOwnsStudent` | 🟢 |
| `GET /api/logs` | Sí | Admin/Docente | Docente filtra por sus clases | 🟢 |
| `GET /api/stats` | Sí | Cualquiera | **No filtra por rol** | 🟡 Medio |
| `GET /api/alerts` | Sí | Cualquiera | — | 🟢 |
| `GET /api/audit` | Sí | Admin | — | 🟢 |
| `GET /api/evidence` | Sí | Admin/Docente | Docente filtra por inscritos | 🟢 |
| `POST /api/evidence` | **No** | Público | Rate limit IP; sube foto a S3 privado | 🟡 Medio (spam de bucket) |
| `GET /api/evidence/photo?key=` | Sí | Cualquiera auth | Presigned 1h | 🟡 (cualquier auth lee fotos con key) |
| `GET/PUT /api/incidents` | Sí | GET: auth · PUT: admin | Docente filtra por inscritos | 🟢 |
| `GET /api/attendance` | Sí | Admin/Docente | Docente filtra por sus clases | 🟢 |
| `POST /api/attendance` | **No** | Público | Kiosco registra asistencia | 🟡 (spoofing de asistencia) |
| `GET /api/reports/attendance` | Sí | Admin/Docente | Docente → solo sus clases | 🟢 |
| `GET /api/reports/attendance/export` | Sí | Admin/Docente | Docente → solo sus clases | 🟢 |
| `GET /api/reports/summary` | Sí | Admin/Docente | 🔴 **NO filtra por docente** (ve todos los logs) | 🔴 **Crítico** |
| `GET /api/labs/[code]/dashboard` | Sí | Cualquiera auth | — | 🟡 (expone métricas de cualquier lab) |
| `GET /api/health` | Sí | Cualquiera auth | — | 🟢 |
| `GET /api/db/status` | **No** | Público | Expone conteos de colecciones | 🟡 Medio |
| `GET /api/db/init` | **No** | Público | **Seed admin+docente si BD vacía** | 🟠 Alto (crea admin conocido) |
| `GET /api/metrics` | **No** | Público | Expone métricas CloudWatch | 🟡 Medio |
| `GET /api/aws/credentials` | **No** | Público | 🔴 **Emite credenciales STS** | 🔴 **Crítico** |
| `GET /api/kiosk` | **No** | Público | Lista **todos los estudiantes** | 🟠 **Alto (fuga de PII)** |
| `POST /api/kiosk` | **No** | Público | Crea AccessLog arbitrario | 🟡 (spoofing) |
| `POST /api/rekognition/compare` | **No** | Público | Busca rostro en colección | 🟡 (uso de API costosa sin auth) |
| `POST /api/rekognition/register` | Sí | Admin/Docente | Indexa rostro | 🟢 |
| `POST /api/rekognition/register-biometric` | Sí | Admin/Docente | Docente solo su estudiante | 🟢 |
| `POST /api/rekognition/init` | **No** | Público | Crea colección | 🟢 |
| `POST /api/rekognition/liveness` | **No** | Público | Sesión liveness | 🟢 (necesario para kiosco) |
| `POST /api/authorize` | **No** | Público | Valida clase+inscripción+biometría | 🟡 (enumeración) |
| `POST /api/upload` | Sí | Admin/Docente | Sube a S3 | 🟢 |
| `POST /api/terms`, `GET /api/terms` | POST admin · GET auth | — | — | 🟢 |

### Resumen de riesgos
- 🔴 **Crítico (2):** `/api/aws/credentials` (STS sin auth), `/api/reports/summary` (no filtra por docente).
- 🟠 **Alto (2):** `/api/kiosk` GET (fuga de todos los estudiantes), `/api/db/init` (seed público de admin).
- 🟡 **Medio (7):** `/api/stats`, `/api/evidence` POST, `/api/evidence/photo`, `/api/attendance` POST, `/api/labs/[code]/dashboard`, `/api/db/status`, `/api/metrics`, `/api/kiosk` POST, `/api/rekognition/compare`.

---

## 7. Dashboard

- **Admin:** `AdminView` con todos los tabs (users, labs, schedules, evidence, incidents, attendance, labdash, acadreports, audit, config). ✅
- **Docente:** `AdminView` con `PRIMARY_ITEMS` restringidos (solo docente: schedules, attendance, acadreports, evidence, incidents). ✅ Los handlers correspondientes filtran por `teacherId`. ✅
- 🔴 **Problema:** el filtrado del dashboard depende del **rol del JWT en el cliente** (`user?.role`). Si un usuario con JWT `estudiante` o alterado carga `/docente`, `isAdmin=false` e `isDocente=false` → no se muestran ni tabs admin ni docente, pero el sidebar se renderiza parcialmente y algunos tabs (evidence/incidents/schedules/attendance) no tienen guard de rol en el render (`{activeTab === 'schedules' && (<SchedulesView/>)}` sin `isAdmin/isDocente`). Es decir, un cliente puede forzar `activeTab` a cualquiera. **La seguridad real está solo en el backend** (que sí filtra), pero la UI expone componentes a roles no autorizados.

---

## 8. Historial (filtros)

| Filtro | Admin | Docente |
|---|---|---|
| `GET /api/logs` con `?lab&teacherId&subject&scheduleId&date&studentId&result&reason&kiosk` | ✅ Todo | ✅ Filtro automático por `scheduleId ∈ sus clases` |
| `GET /api/reports/summary` | ✅ Todo | 🔴 **Ve TODO** (no filtra) |

- **Hallazgo H1 (🔴):** el "Reporte de Accesos" (`/api/reports/summary`) y su vista `ReportsView` muestran logs globales sin restricción por docente.
- **Hallazgo H2 (🟡):** `handleGetStats` no discrimina por rol (devuelve conteos globales a cualquier autenticado).

---

## 9. Flujo del kiosco (verificado)

Cadena en `useKioskFlow.ts` + `canAccessLab`:

```
Frame → Liveness (Rekognition DetectFaces/retos) → match (SearchFacesByImage)
  → candidate = students.find(id)  [datos locales cargados de GET /api/kiosk]
  → candidate.status !== 'allowed' → permissions (R04)
  → POST /api/authorize {studentId, labCode}
       canAccessLab:
         - clase activa hoy + activeKiosk
         - deliveryMode presencial / requiresPhysicalAccess (si virtual → 'virtual' R13)
         - clase 'en_curso' (programada → R09, finalizada → R10, cancelada → R11)
         - inscripción activa (no → R03)
         - biometría registered (no → R14)
  → autorizado → finishGranted → AccessLog + Attendance
```

| Validación | ¿Existe? |
|---|---|
| Face Liveness | ✅ `liveness` (retos) / AWS Liveness |
| Reconocimiento | ✅ `compare` |
| Clase activa | ✅ `canAccessLab` |
| Materia presencial | ✅ `deliveryMode`/`requiresPhysicalAccess` |
| Laboratorio correcto | ✅ `labCode` del kiosco vs clase |
| Estudiante inscrito | ✅ Enrollment |
| Permiso (status allowed) | ✅ `candidate.status` |
| Biometría registrada | ✅ `biometricStatus === 'registered'` |
| **NO ingreso solo por estar registrado** | ✅ Requiere clase activa + inscripción + en curso |

✅ **Confirmado:** un estudiante **no puede** ingresar únicamente por tener biometría registrada; debe pertenecer a la clase activa del momento.

**Nota de diseño (🟡):** el kiosco carga todos los estudiantes vía `GET /api/kiosk` (público) para resolver el candidato. Esto es funcional pero expone la lista completa de estudiantes (PII) a un endpoint sin autenticación.

---

## 10. Integridad de datos (verificado contra MongoDB real)

| Check | Resultado |
|---|---|
| Usuarios duplicados (email) | ✅ 0 |
| Docentes duplicados (tokens) | ✅ 0 (6 docentes) |
| Estudiantes duplicados (tokens) | ✅ 0 (30) |
| Clases duplicadas (materia+docente) | ✅ 0 (6) |
| Inscripciones duplicadas | ✅ 0 |
| Clases sin docente | ✅ 0 |
| Presenciales con lab inválido | ✅ 0 |
| Inscripciones con `scheduleId` inválido | ✅ 0 |
| Inscripciones con `studentId` inexistente | 🟡 **80 huérfanas** |
| Estudiantes sin inscripción | ✅ 0 |
| AccessLogs a estudiantes inexistentes | 🟡 **51** |
| Attendance inválida | ✅ 0 |
| Evidencias/incidentes con estudiante inexistente | ✅ 0 |
| Biometría `registered` sin `faceEmbeddingId` | ✅ 0 |

**Hallazgo I1 (🟡):** 80 `Enrollment` + 51 `AccessLog` apuntan a estudiantes eliminados. Residuos de las fases de re-poblamiento. Recomendable limpieza o job de mantenimiento.

---

## 11. Auditoría de permisos / escalamiento

| Vector | ¿Explotable? | Detalle |
|---|---|---|
| Modificar URL | 🟡 Parcial | La UI permite forzar tabs, pero el backend filtra por rol (a excepción de reports/summary) |
| Consumir API directa | 🔴 Sí | `POST /api/evidence`, `POST /api/attendance`, `POST /api/kiosk`, `GET /api/aws/credentials` sin auth |
| Cambiar un ID | ✅ No | Todos los handlers autenticados re-verifican propiedad (`teacherOwnsStudent`, `schedule.teacherId`) |
| Alterar JWT | ✅ No | HS256 firmado; sin embargo, `JWT_SECRET` tiene **default en código** (`'faceaccess-lab-dev-secret-change-in-production'`) → si el secret no se sobrescribe en prod, cualquiera puede firmar tokens |
| Acceso a recursos ajenos | ✅ No (excepto reports/summary) | Filtros por `teacherId`/inscritos correctos |

**Hallazgo P1 (🔴):** `JWT_SECRET` con valor por defecto en `lib/auth.ts` → riesgo de forja de tokens si no se configura en producción.
**Hallazgo P2 (🟡):** el filtrado de la UI depende del rol del JWT leído en cliente; el backend es la única frontera real.

---

## 12. Matriz de casos de prueba

| # | Caso | Resultado esperado | Cómo verificar |
|---|---|---|---|
| 1 | Admin consulta estudiantes de cualquier clase | ✅ Ve todos (30) | `GET /api/students` con token admin |
| 2 | Docente consulta clase ajena | ❌ 403 / no aparece | `GET /api/schedules` con token de otro docente |
| 3 | Docente registra estudiante en clase ajena | ❌ 403 | `POST /api/students` con `scheduleId` de otro docente |
| 4 | Estudiante intenta acceder al panel admin | ⚠️ No bloqueado por UI (sin middleware) | Navegar a `/docente` con token de estudiante |
| 5 | Estudiante inscrito en dos materias | ✅ Puede entrar solo en la clase activa de hoy | `POST /api/authorize` en el día/hora correcto de cada clase |
| 6 | Estudiante sin biometría | ❌ `no-biometric` (R14) | `POST /api/authorize` con `biometricStatus=pending` |
| 7 | Docente sin materias asignadas | ✅ Lista vacía en su panel | `GET /api/schedules` con docente sin clases |
| 8 | Clase cancelada | ❌ `class-cancelled` (R11) | Clase con `status='cancelada'` |
| 9 | Materia virtual | ❌ `virtual` (R13), sin asistencia | `POST /api/authorize` en materia `activeKiosk=false` |
| 10 | Horario finalizado | ❌ `class-ended` (R10) | Clase `status='finalizada'` |
| 11 | Acceso fuera del horario | ❌ `no-class`/`class-not-started`/`class-ended` | Authorize en día/hora fuera de la ventana |
| 12 | Acceso en laboratorio incorrecto | ❌ `wrong-lab` (R12) | Kiosco con labCode distinto al de la clase |
| 13 | Estudiante con biometría pero sin clase activa | ❌ Denegado (no ingresa solo por estar registrado) | Authorize fuera del horario de su clase |

---

## 13. Problemas encontrados (ordenados por criticidad)

### 🔴 Críticos
| ID | Problema | Archivo |
|---|---|---|
| C1 | Sin middleware de protección de rutas; todas las páginas accesibles sin sesión | *(no existe `middleware.ts`)*, `app/docente/page.tsx` |
| C2 | Todos los roles redirigen a `/docente` y `AdminView` no filtra por rol en la UI | `src/LoginView.tsx:45`, `app/docente/page.tsx`, `src/components/AdminView.tsx` |
| C3 | `GET /api/aws/credentials` emite credenciales STS sin autenticación | `app/api/aws/credentials/route.ts` |
| C4 | `GET /api/reports/summary` no filtra por docente (fuga de logs globales) | `app/api/reports/summary/route.ts:20` |
| C5 | `JWT_SECRET` con valor por defecto en el código (forja de tokens si no se configura) | `lib/auth.ts:4` |

### 🟠 Altos
| ID | Problema | Archivo |
|---|---|---|
| H3 | `GET /api/kiosk` expone todos los estudiantes (PII) sin auth | `app/api/kiosk/route.ts`, `lib/handlers.ts` (`handleGetStudentsPublic`) |
| H4 | `GET /api/db/init` permite seed público de admin+docente si la BD está vacía | `app/api/db/init/route.ts` |
| H5 | Token en `localStorage` (XSS → robo de sesión); sin cookies HttpOnly | `src/lib/api.ts:9` |

### 🟡 Medios
| ID | Problema | Archivo |
|---|---|---|
| M1 | 80 Enrollments + 51 AccessLogs huérfanos (referencias rotas) | BD |
| M2 | `POST /api/evidence`, `POST /api/attendance`, `POST /api/kiosk`, `POST /api/rekognition/compare` sin auth (spoofing/spam) | rutas API |
| M3 | `GET /api/stats`, `/api/db/status`, `/api/metrics`, `/api/labs/[code]/dashboard` expuestos sin restricción de rol | rutas API |
| M4 | Sin refresh token; logout no revoca el JWT | `lib/auth.ts` |
| M5 | Rol `estudiante` sin panel ni flujo (existe en modelo) | UI |

### 🟢 Bajos
- `POST /api/evidence` y `POST /api/attendance` dependen del `x-forwarded-for` (spoofeable).
- CORS `Access-Control-Allow-Origin: *` en varias rutas.

---

## 14. Riesgos de seguridad (resumen)

1. **Exposición del panel sin autenticación** (C1/C2): la app depende de una capa client-side inexistente; cualquiera puede navegar a `/docente`.
2. **Fuga de credenciales AWS** (C3): el endpoint STS es el más grave — un atacante obtiene credenciales temporales que, según la política IAM de `GetSessionToken`, pueden escalar a los permisos de la clave maestra.
3. **Fuga de datos a docentes** (C4): el reporte global filtra información de todos los estudiantes a cualquier docente.
4. **Forja de JWT** (C5): secret por defecto.
5. **Exposición de PII** (H3): lista de estudiantes pública.
6. **Spoofing de evidencia/asistencia** (M2): endpoints de escritura sin auth.

---

## 15. Mejoras recomendadas (por impacto/esfuerzo)

| Prioridad | Mejora | Impacto | Esfuerzo | Archivos |
|---|---|---|---|---|
| **P0** | Middleware Next.js que valide JWT y redirija según rol (`/docente` solo admin/docente; bloquear estudiante) | 🔴 Alto | Bajo | `middleware.ts` (nuevo) |
| **P0** | Quitar `JWT_SECRET` default → exigir `process.env.JWT_SECRET` (fallo en prod si falta) | 🔴 Alto | Bajo | `lib/auth.ts` |
| **P0** | `GET /api/aws/credentials`: exigir token + rol (admin/docente) o token de sesión del kiosco | 🔴 Alto | Bajo | `app/api/aws/credentials/route.ts` |
| **P0** | `reports/summary`: filtrar por `teacherId` cuando el rol es docente | 🔴 Alto | Bajo | `app/api/reports/summary/route.ts` |
| **P1** | `GET /api/kiosk`: devolver solo campos mínimos (id, nombre, foto, status) sin PII completa | 🟠 Alto | Bajo | `lib/handlers.ts` |
| **P1** | `db/init` y `db/status`: exigir auth o restringir a entorno dev | 🟠 Alto | Bajo | rutas db |
| **P1** | Mover token a cookie HttpOnly (o al menos mitigar XSS) | 🟠 Alto | Medio | `lib/api.ts`, login |
| **P2** | Validar rol del usuario en el render de cada tab del panel (no solo en handlers) | 🟡 Medio | Bajo | `AdminView.tsx` |
| **P2** | Limpiar 80 Enrollments + 51 AccessLogs huérfanos (script de mantenimiento) | 🟡 Medio | Bajo | script |
| **P3** | Refresh token + logout que invalide la sesión en servidor | 🟡 Medio | Medio | `lib/auth.ts` |
| **P3** | `POST /api/attendance` y `POST /api/evidence`: firmar con token de kiosco (HMAC compartido) | 🟡 Medio | Medio | rutas |
| **P3** | Portal de estudiante (rol `estudiante`): ver horario/asistencia | 🟢 Opcional | Medio | UI |

---

## 16. Compatibilidad

**Todas las recomendaciones mantienen la arquitectura actual** (Next.js App Router + MongoDB + AWS Rekognition/Face Liveness/S3/CloudWatch/SNS):

- El middleware es una adición estándar de Next.js (no reescribe rutas).
- El endurecimiento de JWT, reports y credentials son cambios localizados en handlers/rutas.
- El filtrado de PII en `/api/kiosk` no altera el flujo del kiosco (el match sigue resolviendo por `id`/foto).
- No se requiere reescritura, cambio de stack ni migración de datos (excepto la limpieza opcional de huérfanos).

---

## 17. Conclusión

El **núcleo funcional y de negocio es sólido** (RBAC en backend, filtrado por docente, cadena de validación del kiosco, integridad referencial). Las brechas críticas están en la **capa de presentación (sin middleware, redirect único a `/docente`)** y en **endpoints públicos sensibles** (`/api/aws/credentials`, `/api/reports/summary`, `/api/kiosk`). Corregir los 5 hallazgos 🔴 tiene bajo esfuerzo y alto impacto, y es 100% compatible con la arquitectura.
