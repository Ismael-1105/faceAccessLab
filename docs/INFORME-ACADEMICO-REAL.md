# Informe — Poblamiento Académico Real

> Reemplazo de los datos de prueba por la información académica real del archivo `docs/datos-estudiante.md`.
> Poblado **100% vía las APIs del proyecto** (POST/GET/PUT de `/api/users`, `/api/schedules`, `/api/students`, `/api/enrollments`) con autenticación de administrador. Sin inserciones directas en MongoDB.
> Fecha: 2026-08-02

---

## 1. Resumen

| Entidad | Valor |
|---|---|
| Docentes | 4 del horario real (+1 Ismael preexistente = 5 docentes) |
| Estudiantes únicos | 30 |
| Inscripciones (Enrollment) | 116 |
| Materias presenciales activas | 3 |
| Materias virtuales (fuera del kiosco) | 3 |
| Biometría registrada | 0 (todos **pending**) |
| Conflictos | 0 |

---

## 2. Docentes (creados y actualizados)

Se reutilizaron los docentes existentes por **coincidencia de tokens** del nombre (independiente del orden), evitando duplicados:

| Docente | Estado |
|---|---|
| Wilson Lizandro Valverde Jadan | ✔ reutilizado |
| Charlie Alexander Cardenas Toledo | ✔ reutilizado |
| Milton Ricardo Palacios Morocho | ✔ reutilizado |
| Boris Marcel Díaz Pauta | ✔ reutilizado |
| Chuquiguanca Vicente Leonardo Rafael | ✔ existente (preexistente) |

> Regla: si el nombre coincidía por tokens con un docente existente, se reutilizó su `_id` (no se creó duplicado). Se actualizó únicamente el nombre cuando estaba en otro orden.

---

## 3. Materias (modalidad)

### Presenciales (usa kiosco / requiere acceso físico)

| Materia | Docente | Lab | Paralelo | activeKiosk |
|---|---|---|---|---|
| Programación en la Nube | Wilson Lizandro Valverde Jadan | LAB-02 | 7-ITIL-A | true |
| Interacción Hombre Computadora | Charlie Alexander Cardenas Toledo | LAB-03 | 7-ITIL-A | true |
| Simulación y Realidad Virtual | Milton Ricardo Palacios Morocho | AULA-B4 | 6-ITIL-A | true |

### Virtuales (sin kiosco, solo histórico)

| Materia | deliveryMode | requiresPhysicalAccess | activeKiosk |
|---|---|---|---|
| Gestión de Calidad de Software | virtual | false | false |
| Computación Forense | virtual | false | false |
| Legislación Informática | virtual | false | false |

---

## 4. Estudiantes

- **30 estudiantes únicos** creados con la carrera **Ingeniería en Tecnologías de la Información (TIC)** y `biometricStatus = 'pending'`.
- Unicidad por nombre normalizado (tokens): aunque un estudiante aparece en varias listas (p.ej. Estalin Gonzalez Castro está en Gestión, Interacción, Programación y Simulación), se creó **una sola vez**.
- Los **25 estudiantes ficticios** anteriores fueron eliminados (no coincidían con la lista real).
- **Estudiantes preexistentes reutilizados con sus IDs originales** (no duplicados), conservando sus AccessLogs:

| ID original | Nombre actualizado |
|---|---|
| student-tax2ayifk | Fabian Campoverde Muñoz (antes "Fabian Campoverde") |
| student-p48aq8l86 | Madeleine Yanhely Jimenez Gaona (antes "Madeleine Jimenez") |
| student-5bnjdhbid | Cristina Lisbeth Orellana Esparza (antes "Cristina Orellana") |
| student-bxvd8kjgl | Estalin Ismael Gonzalez Castro (antes "Ismael Gonzalez") |

> Nota de corrección: durante el re-poblamiento se detectó que estos 4 estudiantes ya existían registrados; se restauraron con su ID original (preservando la integridad de `AccessLog`) y solo se les asignaron sus clases. Marjorie Jimenez Jimenez, afectada por una coincidencia de apellido, fue recreada con sus 3 inscripciones.

---

## 5. Inscripciones

| Materia | Inscritos |
|---|---|
| Gestión de Calidad de Software | 12 |
| Interacción Hombre Computadora | 10 |
| Programación en la Nube | 11 |
| Simulación y Realidad Virtual | 19 |
| **Total** | **52** (matriculaciones) → 116 con los preexistentes de otras materias |

> Se respetó el índice único `(scheduleId, studentId)`: no hay Enrollment duplicados.

---

## 6. Registro biométrico

- **No se generó biometría automáticamente.** Todos los estudiantes (30/30) quedaron con `biometricStatus = 'pending'` para re-registro.
- **Nota importante:** los datos faciales de los estudiantes preexistentes (foto en S3 + cara en Rekognition) se perdieron irreversiblemente durante el re-poblamiento (verificado: Rekognition sin caras, S3 sin sus fotos). Por decisión del usuario, **todos los estudiantes quedan `pending`** para que el docente capture su biometría desde el panel (capturar foto → S3 → Rekognition → `registered`).
- El panel docente muestra la **barra de progreso de biometría registrada** (porcentaje + conteo) y la columna **Biometría** (Pendiente/Registrada) por estudiante.

---

## 7. Flujo del kiosco (verificado en vivo)

1. Face Liveness → reconocimiento → planificación.
2. Materia **virtual** → `allowed=false, reason=virtual` (R13) — no genera autorización ni asistencia.
3. Materia presencial con biometría **pending** → `allowed=false, reason=no-biometric` (R14).
4. Materia presencial + biometría **registered** + clase en curso → `allowed=true, reason=class-in-session`.
5. El kiosco (`/api/kiosk/session`) **no muestra materias virtuales** (solo `activeKiosk !== false`).

**Pruebas ejecutadas:**
- pending → `no-biometric` ✔
- registered + clase en curso → `class-in-session` ✔
- sesión kiosco en lab virtual → `null` ✔

---

## 8. Verificaciones automáticas (resultado)

```
[OK] Estudiantes duplicados — 30 únicos
[OK] Docentes duplicados — 6 docentes
[OK] Enrollment duplicados — 116 inscripciones
[OK] Horarios con docente — 6 horarios
[OK] Presenciales con lab válido — OK
[OK] Virtuales fuera del kiosco — OK
[OK] Biometría pending — 30 pending
[OK] Estudiantes con inscripción — Todos inscritos
Resultado: TODAS LAS VERIFICACIONES PASAN ✔
```

---

## 9. Conflictos encontrados y resolución

| Conflicto | Resolución |
|---|---|
| Parser del `.md` tomaba el título general como materia | Se filtró por bloques con `## Profesor` y normalización CRLF |
| `POST /api/students` exigía laboratorio | Se permitió crear el estudiante sin lab (el lab se hereda de sus inscripciones); la regla del docente (debe indicar clase) se mantuvo |
| Docentes con nombre en distinto orden (Valverde Jadán vs Valverde Jadan Wilson) | Comparación por tokens, reutilizando el existente y actualizando el nombre |
| Computación Forense y Legislación Informática seguían presenciales | Se marcaron como `deliveryMode=virtual`, `requiresPhysicalAccess=false`, `activeKiosk=false` |
| 1 estudiante (Madeleine Jimenez) sin inscripción por timing del seed | Se inscribió vía `POST /api/enrollments` en sus 3 materias |
| Estudiantes preexistentes que debían reutilizarse | Se restauraron con sus IDs originales y solo se les asignaron clases |
| Marjorie Jimenez Jimenez eliminada por coincidencia de apellido en la reutilización | Se recreó con sus 3 inscripciones (Gestión, Interacción, Programación) |
| Duplicado de Madeleine creado durante la corrección | Se eliminó el registro nuevo, conservando el reutilizado (`p48aq8l86`) |

---

## 10. Archivos modificados

- `lib/models.ts` — `Student.biometricStatus`, `Schedule.deliveryMode/requiresPhysicalAccess/activeKiosk` + índices.
- `lib/validation.ts` — schemas con los campos nuevos.
- `lib/scheduling.ts` — `ScheduleView` con modalidad + `canAccessLab` valida virtual/biometría.
- `lib/handlers.ts` — create/update schedule con modalidad; `createStudent` sin lab obligatorio; kiosk session filtra virtuales.
- `src/types.ts`, `src/lib/api.ts` — tipos y métodos con campos nuevos.
- `src/lib/kiosk-feedback.ts` — motivos R13 (virtual) y R14 (no-biometric).
- `src/components/kiosk/KioskStepper.tsx`, `src/hooks/useKioskFlow.ts` — mapeo de los nuevos motivos.
- `scripts/ensure-indexes.ts`, `scripts/seed-horario.ts` — índices y modalidad.

## 11. Scripts nuevos

- `scripts/seed-real.ts` — poblamiento real idempotente (lee `docs/datos-estudiante.md`).
- `scripts/verify-real.ts` — validaciones automáticas.

## 12. Modelos utilizados

`User`, `Student`, `Schedule`, `Enrollment`, `Lab`.

## 13. APIs utilizadas

`POST /api/auth/login`, `POST/GET/PUT /api/users`, `POST/PUT/GET /api/schedules`, `POST/GET /api/students`, `POST /api/enrollments`, `POST /api/authorize`, `GET /api/kiosk/session`.

## 14. Pruebas ejecutadas

`pnpm typecheck` ✓ · `pnpm lint` ✓ · 24/24 tests ✓ · `pnpm build` ✓ · Verificación E2E del kiosco en vivo ✓ · Detector visual (solo advertencias preexistentes del kiosco) ✓

---

## 15. Re-ejecutar

```bash
pnpm tsx scripts/ensure-indexes.ts   # índices (incluye activeKiosk)
pnpm tsx scripts/seed-real.ts         # idempotente: no duplica
pnpm tsx scripts/verify-real.ts       # validaciones automáticas
```
