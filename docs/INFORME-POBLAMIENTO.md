# Informe de Poblamiento — Horario Oficial 2026-A

> Poblado **100% vía las APIs del proyecto** (POST/GET de `/api/users`, `/api/labs`, `/api/terms`, `/api/schedules`, `/api/students`, `/api/enrollments`) con autenticación de administrador. **No se insertó ningún documento directamente** en MongoDB.
> Fecha: 2026-08-02 · Verificado contra BD real (MongoDB Atlas).

---

## 1. Resumen

| Entidad | Cantidad |
|---|---|
| Docentes del horario | 5 |
| Docentes totales (con preexistente) | 6 |
| Laboratorios del horario | 5 (LAB-02 y LAB-03 reutilizados) |
| Laboratorios totales | 6 |
| Materias (clases) | 6 |
| Período académico | 1 (`2026-A`) |
| Estudiantes ficticios | 20 (+5 preexistentes = 25) |
| Inscripciones (Enrollment) | 63 |
| Conflictos detectados | **0** |

---

## 2. Docentes creados

Se intentó crear cada docente por la API `POST /api/users`; si el email ya existía, **no se duplicó** (idempotencia).

| Docente | Email generado | Estado |
|---|---|---|
| Valverde Jadán Wilson Lizandro | valverde.jadan.wilson.lizandro@faceaccess.lab | ✔ existía |
| Palacios Morocho Milton Ricardo | palacios.morocho.milton.ricardo@faceaccess.lab | ✔ existía |
| Cárdenas Toledo Charlie Alexander | cardenas.toledo.charlie.alexander@faceaccess.lab | ✔ existía |
| Chuquiguanca Vicente Leonardo Rafael | chuquiguanca.vicente.leonardo.rafael@faceaccess.lab | ✔ existía |
| Díaz Pauta Boris Marcel | diaz.pauta.boris.marcel@faceaccess.lab | ✔ existía |

> Contraseña asignada por el flujo estándar: `docente123` (hash bcrypt vía `hashPassword`).

---

## 3. Laboratorios creados

Los ya existentes `LAB-02` y `LAB-03` se **reutilizaron** (decisión acordada: "LAB 2"→LAB-02, "LAB 3"→LAB-03). Los nuevos se crearon con `POST /api/labs` manteniendo el modelo `Lab`.

| Código | Nombre | Estado |
|---|---|---|
| LAB-02 | Sistemas Operativos | ✔ existía (reutilizado) |
| LAB-03 | Psicologia | ✔ existía (reutilizado) |
| AULA-B4 | Aula B4 | ✔ creado/existía |
| VIRTUAL-L1 | Virtual L-1 | ✔ creado/existía |
| VIRTUAL | Virtual | ✔ creado/existía |

---

## 4. Materias y horarios creados (Schedules)

Cada materia del horario oficial se creó como un `Schedule` con la API `POST /api/schedules`, con **bloque único de 3h (15:00–18:00)**, un día por materia, paralelo A, campus UIO y término `2026-A`. No se dividió ningún bloque.

| Materia | Docente | Lab | Día | Hora | Paralelo | Campus | Término | Duración |
|---|---|---|---|---|---|---|---|---|
| Programación en la Nube | Valverde Jadán Wilson Lizandro | LAB-02 | Lunes (1) | 15:00–18:00 | A | UIO | 2026-A | 3h |
| Simulación y Realidad Virtual | Palacios Morocho Milton Ricardo | AULA-B4 | Martes (2) | 15:00–18:00 | A | UIO | 2026-A | 3h |
| Interacción Hombre Computadora | Cárdenas Toledo Charlie Alexander | LAB-03 | Miércoles (3) | 15:00–18:00 | A | UIO | 2026-A | 3h |
| Computación Forense | Chuquiguanca Vicente Leonardo Rafael | VIRTUAL-L1 | Jueves (4) | 15:00–18:00 | A | UIO | 2026-A | 3h |
| Gestión de Calidad de Software | Díaz Pauta Boris Marcel | VIRTUAL | Viernes (5) | 15:00–18:00 | A | UIO | 2026-A | 3h |
| Legislación Informática | Chuquiguanca Vicente Leonardo Rafael | VIRTUAL | Sábado (6) | 15:00–18:00 | A | UIO | 2026-A | 3h |

**Nota sobre la asignación horaria:** el horario oficial entregado solo especificaba Materia/Docente/Laboratorio. Por decisión acordada se propuso un bloque estándar de 3h por materia en días consecutivos (Lun–Sáb), sin traslapes. Los días/horas son fácilmente ajustables vía `PUT /api/schedules` si el usuario dispone del horario real.

---

## 5. Relaciones generadas

- **Docente → Clase:** cada `Schedule.teacherId` apunta al `_id` del usuario docente correcto (verificado en la tabla de la sección 4).
- **Clase → Laboratorio:** cada `Schedule.labCode` apunta a un `Lab` existente.
- **Clase → Período:** cada `Schedule.academicTerm = "2026-A"` (con índice en MongoDB).
- **Estudiante → Clase:** 63 `Enrollment` activos creados vía `POST /api/enrollments`, distribuyendo los 20 estudiantes ficticios entre las 6 materias.

---

## 6. Estudiantes ficticios (20)

Creados vía `POST /api/students` con el flujo real (el handler **hereda el lab de la clase** vía `scheduleId` e **inscribe automáticamente**). Cada uno inscrito en 2–6 materias.

| Estudiante | Carrera | Materias |
|---|---|---|
| Alejandro Morales | Ing. Sistemas | 6 (todas) |
| Sofía Villarreal | Ing. Sistemas | 3 |
| Mateo González | Ing. Sistemas | 3 |
| Valentina López | Arquitectura | 2 |
| Sebastián Ramírez | Ing. Sistemas | 2 |
| Camila Torres | Adm. Empresas | 2 |
| Nicolás Castillo | Ing. Sistemas | 6 |
| Isabella Mendoza | Arquitectura | 3 |
| Daniel Paredes | Adm. Empresas | 3 |
| Mariana Vega | Ing. Sistemas | 2 |
| Lucas Rivas | Ing. Sistemas | 2 |
| Gabriela Silva | Arquitectura | 2 |
| Diego Ortega | Ing. Sistemas | 6 |
| Renata Salazar | Adm. Empresas | 3 |
| Andrés Quintero | Ing. Sistemas | 3 |
| Carolina Navarro | Arquitectura | 2 |
| Felipe Espinoza | Ing. Sistemas | 2 |
| Daniela Roldán | Adm. Empresas | 2 |
| Santiago Cedeño | Ing. Sistemas | 6 |
| Paula Armijos | Arquitectura | 3 |

---

## 7. Verificaciones (resultado)

Ejecutado por `scripts/verify-horario.ts` contra MongoDB:

- ✔ Todos los docentes del horario existen (5/5).
- ✔ Todos los laboratorios existen (LAB-02, LAB-03, AULA-B4, VIRTUAL-L1, VIRTUAL).
- ✔ Todas las clases existen (6/6 materias).
- ✔ **No hay horarios traslapados** para el mismo docente (0 traslapes).
- ✔ **No hay laboratorios ocupados simultáneamente** (0 conflictos).
- ✔ **No hay duplicados** de clase (0 duplicados).
- ✔ Relación docente→clase correcta para las 6 materias.
- ✔ 20 estudiantes ficticios + 63 inscripciones válidas.

---

## 8. Panel docente vs panel administrador (verificado en vivo)

- **Docente (Valverde Jadán):** ve solo su materia (Programación en la Nube), 11 estudiantes inscritos, reporte con `scope: "docente"` (1 clase).
- **Docente (Chuquiguanca):** ve exactamente sus 2 materias (Computación Forense día 4, Legislación Informática día 6) — sin ver datos de otros docentes.
- **Administrador:** ve las 6 materias, 6 docentes, 6 laboratorios, el término 2026-A y los 25 estudiantes.

---

## 9. Archivos modificados/creados

### Modificados
- `lib/models.ts` — nuevo modelo `AcademicTerm` + campos `parallel`, `campus`, `academicTerm` en `Schedule` + índices.
- `lib/validation.ts` — `parallel/campus/academicTerm` en schemas de schedule + `academicTermCreateSchema`.
- `lib/scheduling.ts` — `ScheduleView` con los campos nuevos.
- `lib/handlers.ts` — handlers `handleGetAcademicTerms`, `handleCreateAcademicTerm`; `handleCreateSchedule` valida término y persiste campos nuevos; `handleGetSchedules` los devuelve.
- `app/api/terms/route.ts` — **nuevo** (GET autenticado, POST admin).
- `src/types.ts` — `AcademicTerm`, campos nuevos en `Schedule`.
- `src/lib/api.ts` — métodos `getAcademicTerms`, `createAcademicTerm`; create/update schedule con campos nuevos.
- `scripts/ensure-indexes.ts` — índice único en `AcademicTerm.code` y `Schedule.academicTerm`.

### Creados
- `scripts/seed-horario.ts` — poblamiento idempotente del horario vía APIs.
- `scripts/verify-horario.ts` — verificación de consistencia.

---

## 10. Modelos utilizados

`User` (docentes), `Lab`, `Schedule`, `AcademicTerm`, `Student`, `Enrollment`.

## 11. APIs utilizadas

- `POST /api/auth/login` (token admin)
- `POST/GET /api/users` (crear/listar docentes)
- `POST/GET /api/labs` (crear/listar laboratorios)
- `POST/GET /api/terms` (crear/listar períodos académicos)
- `POST/GET /api/schedules` (crear/listar clases)
- `POST/GET /api/students` (crear estudiantes con inscripción automática)
- `POST /api/enrollments` (inscripciones adicionales)

## 12. Validaciones ejecutadas

`userCreateSchema`, `labCreateSchema`, `academicTermCreateSchema`, `scheduleCreateSchema`, `studentCreateSchema`, `enrollmentCreateSchema` (todas con Zod). En `scheduleCreateSchema` se valida `endTime > startTime` y en el handler la existencia del lab y del término.

---

## 13. Mejora recomendada (implementada)

> **Período Académico (AcademicTerm):** implementado. Cada `Schedule` pertenece a un término (`2026-A`), con índice único en `code` y endpoints `/api/terms`. Esto permite:
> - Reutilizar la estructura en futuros ciclos (2026-B, 2027-A) sin eliminar horarios anteriores.
> - Mantener historial de asistencia y reportes por ciclo (filtrable por `academicTerm`).
> - Preparar el panel admin para filtrar por período.

---

## 14. Cómo re-ejecutar

```bash
pnpm tsx scripts/ensure-indexes.ts   # garantiza índices
pnpm tsx scripts/seed-horario.ts      # idempotente: no duplica nada
pnpm tsx scripts/verify-horario.ts    # verifica consistencia
```
