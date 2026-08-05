# Evolución Académica — FaceAccess-Lab

> Plan de arquitectura para convertir el sistema en un flujo operativo de universidad real.
> **Restricciones:** no cambiar stack (Next.js + MongoDB + Rekognition + S3 + SNS + CloudWatch), no reescribir, integrar con el patrón actual (modelos → handlers → rutas → vistas).

---

## 1. Flujo actual (verificado en código)

```
[Admin] crea clase (Schedule) → inscribe estudiantes (Enrollment)
   ↓
[Kiosco] encuadre → liveness → compare (Rekognition) → match
   ↓
[Kiosco] /api/authorize → canAccessLab(studentId, labCode) → clase activa hoy + inscrito
   ↓
  permitido → AccessLog (Permitido) + Attendance? (no existe aún)
  denegado → DenialEvidence (S3 privado + Mongo) + Incident (≥umbral) + SNS
```

**Modelos actuales:** `User` (admin/docente/estudiante + MFA), `Student`, `Lab`, `Schedule`, `Enrollment`, `AccessLog`, `DenialEvidence`, `Incident`, `Alert`, `AuditLog`.

**Roles:** `admin` y `docente`. El docente hoy **no puede matricular** (solo admin); ve el panel global completo.

**Gaps detectados (fundamento):**
- `handleCreateStudent` exige `requireAdmin` → el docente no puede matricular.
- No existe `Attendance` (asistencia) — el `AccessLog` no distingue ingreso válido de clase.
- El panel de docente es el mismo que el de admin (filtros no condicionados por rol).
- `Schedule` no tiene estado de sesión (solo horario) — la recomendación de "En curso/Cancelada" lo resuelve.

---

## 2. Flujo propuesto

```
[Docente] crea clase (solo propias) → inscribe estudiantes (solo propios) → inicia sesión ("En curso")
   ↓
[Kiosco] muestra lab + materia + docente + horario
   ↓
  liveness → compare → match → /api/authorize (clase "En curso" + inscrito + horario)
   ↓
  permitido → AccessLog + Attendance (hora, clase, lab, docente, "Presente")
  fuera de horario → Attendance "Fuera de horario" (no válida)
  denegado → DenialEvidence + Incident + motivo específico (No inscrito, Clase finalizada, etc.)
```

---

## 3. Cambios necesarios (por funcionalidad)

### F1 — Registro de estudiantes por el docente
- **Condición:** el docente solo ve/crea estudiantes para sus clases (`teacherId` = su `userId`).
- **Heredar:** al matricular, crear `Enrollment` con el `scheduleId` de la clase; el `labCode` y horario se derivan del `Schedule`.
- **Auditoría:** `AuditLog` con `action: 'student.create'`, actor = docente, `details` con clase.

### F2 — Dashboard personalizado por docente
- Filtrar clases, estudiantes, logs, evidencias e incidentes por `teacherId` cuando `role === 'docente'`.
- El docente no ve los tabs de administración (solo admin).

### F3 — Historial filtrado
- `handleGetLogs` acepta filtros query: `lab`, `teacherId`, `subject`, `scheduleId`, `date`, `studentId`, `result`, `reason`, `kioskId`.
- Si `role === 'docente'`, se inyecta `teacherId` automáticamente (no puede ver otros docentes).

### F4 — Dashboard del laboratorio
- Nuevo `GET /api/labs/{code}/dashboard` con KPIs en tiempo real: esperados (enrollments × schedule vigente), presentes, ausentes, ingresos, rechazos, incidentes, latencia promedio, estado del kiosco, última sincronización.

### F5 — Control de asistencia
- Nuevo modelo `Attendance`: `studentId`, `scheduleId`, `date`, `checkInTime`, `status` (`presente` | `fuera_de_horario` | `ausente`), `labCode`, `teacherId`.
- Se registra al conceder acceso (si clase "En curso") o como "Fuera de horario" (si fuera).

### F6 — Reportes
- Endpoint `GET /api/reports/attendance?scheduleId=` con agregaciones: asistencia por clase/estudiante, % asistencia, más retrasos, más rechazos, incidentes por lab, latencia.
- Exportar PDF (reutilizar el patrón de texto estructurado de `/api/reports/summary`) y Excel/CSV.

### F7 — Mejoras al kiosco
- Pre-reconocimiento: mostrar `lab`, materia, docente, horario (desde el `Schedule` vigente del kiosco).
- Post-acceso: "Bienvenido {nombre} — {materia} — {docente} — {hora} — Asistencia registrada".
- Rechazo: motivos específicos ya cubiertos por `DENIAL_REASONS` (añadir `no-class`, `class-ended`, `class-not-started`, `wrong-lab`, `suspended`).

### F8 — Auditoría completa
- Ampliar `recordAudit` para incluir `ip`, `userAgent`, `role`, `before`, `after`.
- Registrar: login, logout, crear/editar/eliminar clase, inscribir, matricular, cerrar incidente, descargar reporte.

### F9 — UX
- Reducir pasos: el docente matricula desde su clase (1 clic: seleccionar estudiante + matricular → crea Student + Enrollment + lab heredado).

### F10 — Evaluación final
- Ver sección 6.

---

## 4. Archivos afectados

| Archivo | Cambio |
|---|---|
| `lib/models.ts` | + `Attendance`; `Schedule` + `status`; `AuditLog` + `ip/userAgent/before/after` |
| `lib/validation.ts` | + schemas `attendance`, `studentCreateByTeacher`, `scheduleStatus` |
| `lib/scheduling.ts` | `canAccessLab` con estado de sesión; `getSchedulesForTeacher` |
| `lib/audit.ts` | `recordAudit` extendido (ip, userAgent, before/after) |
| `lib/handlers.ts` | permisos por rol en students/schedules/enrollments; logs filtrados; attendance; reports |
| `app/api/students/route.ts` | permitir docente (solo sus clases) |
| `app/api/schedules/route.ts` | docente solo crea/edita sus clases; estado de sesión |
| `app/api/enrollments/route.ts` | docente solo sus clases |
| `app/api/logs/route.ts` | filtros query + restricción por rol |
| `app/api/attendance/route.ts` | nuevo |
| `app/api/labs/[code]/dashboard/route.ts` | nuevo |
| `app/api/reports/attendance/route.ts` | nuevo |
| `src/components/AdminView.tsx` | sidebar condicional por rol; tabs docente |
| `src/components/SchedulesView.tsx` | docente ve solo sus clases; iniciar/finalizar sesión |
| `src/components/StudentsView.tsx` | nuevo (docente ve/matricula sus estudiantes) |
| `src/components/AttendanceView.tsx` | nuevo |
| `src/components/ReportsView.tsx` | filtros + export PDF/Excel |
| `src/hooks/useKioskFlow.ts` | mostrar info de clase pre/post acceso |
| `src/lib/kiosk-feedback.ts` | nuevos motivos de rechazo |

---

## 5. Modelos afectados

| Modelo | Campo nuevo | Tipo |
|---|---|---|
| `Schedule` | `status` | `'programada' | 'en_curso' | 'finalizada' | 'cancelada'` |
| `Attendance` | (nuevo) | `studentId, scheduleId, date, checkInTime, status, labCode, teacherId` |
| `AuditLog` | `ip, userAgent, role, before, after` | `string / any` |

---

## 6. APIs afectadas

- `GET /api/logs` — filtros `?lab&teacherId&subject&scheduleId&date&studentId&result&reason&kioskId`.
- `POST /api/students` — permitir docente (valida que la clase sea suya).
- `POST/PUT /api/schedules` — docente solo sus clases; `PUT` acepta `status`.
- `POST/DELETE /api/enrollments` — docente solo sus clases.
- `GET /api/labs/{code}/dashboard` — nuevo.
- `POST /api/attendance` — nuevo (kiosco).
- `GET /api/reports/attendance` — nuevo.
- `GET /api/reports/summary` — aceptar filtros por docente.

---

## 7. Cambios en MongoDB

- Nueva colección `attendances`.
- Índices: `Attendance {scheduleId, date}`, `Attendance {studentId, date}`, `Schedule {teacherId, status}`.
- `Schedule.status` con valor por defecto `'programada'` (migración idempotente).

---

## 8. Cambios en la UI

- **Sidebar admin/docente:** el docente ve Vista, Mis Clases, Mis Estudiantes, Historial (filtrado), Evidencia, Incidentes, Asistencia, Reportes. No ve Docentes/Laboratorios/Planificación global/Calibración/Auditoría.
- **SchedulesView:** para docente, botón "Iniciar sesión" / "Finalizar sesión" por clase; ocultar edición de lab/horario.
- **Nueva StudentsView docente:** matrícula con 1 clic (hereda clase).
- **Kiosco:** banner pre-acceso (lab/materia/docente/horario) y post-acceso (bienvenida + asistencia).
- **ReportsView:** filtros + botones Exportar PDF/Excel.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Regresión de permisos (docente ve datos ajenos) | Verificación de `teacherId` en backend (no solo UI); tests de permisos |
| Complejidad del dashboard por lab | Agregaciones agregadas con `$match`/`$group`, no lecturas N+1 |
| Migración de `Schedule.status` | Migración idempotente al arrancar; default en schema |
| Filtros en logs con datos de otro docente | Inyección automática de `teacherId` en el handler |

---

## 10. Compatibilidad con el código actual

- **100% compatible:** se agregan campos opcionales y colecciones nuevas; ningún modelo existente se rompe.
- El flujo actual sigue funcionando: `canAccessLab` solo exige `status === 'en_curso'` cuando el estado exista; si `status` no está, se trata como `programada` + horario (compatibilidad hacia atrás).
- Los handlers existentes (auth, labs, incidentes, evidencia) no se tocan salvo la adición de filtros.

---

## 11. Priorización

### 🔴 Imprescindible (Fase A)
- **F1** — Docente registra estudiantes (permisos + herencia + auditoría).
- **F2** — Dashboard personalizado por docente (restricción de datos).
- **F3** — Historial filtrado (query params + restricción por rol).
- **F8** — Auditoría extendida (ip, userAgent, before/after) + login/logout.

### 🟠 Muy recomendada (Fase B)
- **F7** — Kiosco: info de clase pre/post + motivos específicos de rechazo.
- **F5** — Control de asistencia (modelo `Attendance`).
- **Estado de sesión de clase** (recomendación adicional): `Schedule.status` + iniciar/finalizar.

### 🟡 Recomendada (Fase C)
- **F6** — Reportes automáticos con export PDF/Excel.
- **F4** — Dashboard del laboratorio en tiempo real.
- **F9** — Reducción de pasos en flujos frecuentes.

### 🟢 Opcional (Fase D)
- **F10** — automatizaciones adicionales (ver sección 12).

---

## 12. Evaluación final y recomendaciones

**¿El flujo representará un sistema universitario real?** Sí, cuando se implementen F1–F5 + estado de sesión: la autorización deja de ser "por horario fijo" y pasa a ser "por sesión iniciada por el docente", que es como operan los laboratorios reales.

**Procesos manuales aún automatizables (sin complejidad innecesaria):**
1. **Marcación automática de ausentes** al finalizar la clase (job o trigger al cerrar sesión).
2. **Notificación al docente** (SNS) cuando la asistencia de su clase < umbral.
3. **Agrupación de rechazos por clase** en incidentes (ya existe, extender a `scheduleId`).
4. **Exportación programada** de reportes semanales por email (SES).

**Recomendación adicional (valor alto):**
> **Estado de sesión de clase** (`Programada / En curso / Finalizada / Cancelada`) con inicio/finalización desde el panel del docente. El kiosco solo registra asistencia cuando `status === 'en_curso'`, además de validar horario. Evita asistencia antes de que llegue el docente o después de terminar la clase, y representa mejor la operación real.

---

## 13. Resumen ejecutivo

La evolución más valiosa y de menor riesgo es **F1+F2+F3+F8 + estado de sesión de clase**. Esto convierte la autorización de un sistema "por horario teórico" a uno "por sesión real del docente", añade aislamiento de datos por docente y una auditoría completa — sin cambiar el stack ni reescribir módulos. El resto (reportes, dashboard de lab, UX) añade valor de presentación y operación, priorizable después.

---

## 14. Estado de implementación (todas las fases completadas)

> Verificado: `pnpm typecheck`, `pnpm lint`, 24/24 tests, `pnpm build`, pruebas E2E contra MongoDB real. Índices creados en BD.

### Fase A (🔴) — Implementada
- **F1** Docente registra estudiantes: `POST /api/students` con `scheduleId`, hereda lab, inscripción automática, bloqueo de campos protegidos (lab, rol, ficha) con 403, auditoría con actor docente.
- **F2** Dashboard por docente: estudiantes, clases, inscripciones, logs, evidencias e incidentes filtrados por `teacherId`. Sidebar "Panel Académico" sin tabs de admin.
- **F3** Historial filtrado: `GET /api/logs?lab&teacherId&subject&scheduleId&date&studentId&result&reason&kiosk`; docente recibe filtro automático por sus clases.
- **F8** Auditoría completa: `AuditLog` con `actorRole, ip, userAgent, before, after`; login/logout, crear/editar/eliminar clase, matrícula, inscripciones, toggle de permisos, cierre de incidentes.

### Fase B (🟠) — Implementada
- **Estado de sesión de clase**: `Schedule.status` (`programada | en_curso | finalizada | cancelada`); el docente inicia/finaliza desde "Mis Clases"; el kiosco solo autoriza con clase `en_curso`. Backward-compatible con clases legacy.
- **F5** Control de asistencia: modelo `Attendance`, `POST/GET /api/attendance`, registro automático desde el kiosco (`presente`/`fuera_de_horario`), vista "Asistencia".
- **F7** Kiosco mejorado: sesión en curso pre-acceso (`/api/kiosk/session`), post-acceso con materia/docente/hora/asistencia, y motivos específicos R09–R12 (clase no iniciada, finalizada, cancelada, lab incorrecto).

### Fase C (🟡) — Implementada
- **F6** Reportes automáticos: `GET /api/reports/attendance` (asistencia por clase y por estudiante, % asistencia, más retrasos, más rechazos, incidentes por lab, latencia media desde `recognitionMs` medido por el kiosco). Export **Excel** (CSV con BOM) y **PDF** (HTML imprimible) en `/api/reports/attendance/export?format=`. UI `AttendanceReportsView`.
- **F4** Dashboard del laboratorio: `GET /api/labs/[code]/dashboard` (esperados, presentes, ausentes, ingresos, rechazos, incidentes, latencia, estado del kiosco, última sincronización) con polling de 15s. UI `LabDashboardView`.
- **F9** UX: buscador de clases (materia/lab/docente), tabs de Reportes/Dashboard en sidebar de admin y docente, inscripción en 1 clic.

### Fase D (🟢) — Implementada (automatizaciones)
- **F10** Al finalizar una clase, `markAbsentees` marca automáticamente como `ausente` a los inscritos sin asistencia del día (probado: 2 inscritos, 1 presente → 1 ausente exacto). Base lista para notificación SNS al docente por baja asistencia.

### Archivos nuevos de las fases C/D
- `lib/reports.ts` (agregaciones + dashboard), `app/api/reports/attendance{/export}`, `app/api/labs/[code]/dashboard`, `src/components/AttendanceReportsView.tsx`, `src/components/LabDashboardView.tsx`.
- `AccessLog.recognitionMs` medido por el kiosco (`useKioskFlow` → `saveAccessLog`).
