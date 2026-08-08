# Contrato de implementación y revisión

Documento de trabajo para el flujo **implementador / revisor**. El implementador propone y escribe el código. El revisor valida contra los hechos verificados de este documento antes de aceptar cada fase.

Base: informe `INFORME-ISSUES-PRESENTACION.md` (22 issues, 3 corregidos y 19 pendientes).

---

## 1. Estado de partida (verificado el 7 de agosto de 2026)

| Elemento | Valor comprobado |
|----------|------------------|
| Ruta local | `Proyectos UIDE 8/Acceso-Facial-Lab/proyecto-septimo-ciclo-nube` |
| Remoto `origin` | `https://github.com/Ismael-1105/proyecto-septimo-ciclo-nube.git` |
| Commit actual | `79776f4` ("Mejoras MVP"), sincronizado con `origin/main` |
| Rama local | `feat/hci-kiosco`, siguiendo a `origin/main` |
| Árbol de trabajo | Limpio. Solo queda sin seguimiento `backend/`, con dos ficheros `.pyc` de caché sin valor |
| Gestor de paquetes | El proyecto declara `pnpm@10.33.2`, pero en este equipo **pnpm no está instalado**. Se ha usado `npx` para ejecutar la batería de pruebas |

El repositorio `Ismael-1105/faceAccessLab` y `Ismael-1105/proyecto-septimo-ciclo-nube` comparten el mismo linaje y ambos apuntan a `79776f4`. Se trabaja sobre este último, que es el que está clonado localmente.

### 1.1 Línea base de pruebas

Ejecutado `npx vitest run` sobre `79776f4`, antes de tocar nada:

```
Test Files   1 failed | 23 passed (24)
Tests        1 failed | 150 passed (151)
Duration     133.25 s
```

El único fallo es **preexistente** y no lo introduce ninguna corrección de este plan:

```
FAIL src/__key_audit__.test.tsx > AdminView reproduce el warning con logs sin id
Error: Test timed out in 15000ms.
```

**Ese fallo es intermitente, no determinista (corregido el 8 de agosto de 2026).** No es un fallo fijo: es un tiempo de espera de 15 s que se agota o no según la carga de la máquina. Medido en tres ejecuciones del mismo código:

| Ejecución | Duración total | `__key_audit__` |
|-----------|----------------|-----------------|
| Línea base sobre `79776f4` | 133,25 s | Falla |
| Cierre de la fase 1 | 63,86 s | Falla |
| Cierre de la fase 2 | 12,51 s | **Pasa** |

La correlación es con la duración total, no con el código. La redacción anterior de esta regla ("debe terminar con ese mismo fallo") habría rechazado una fase legítima solo porque la máquina iba descargada.

**Regla para el revisor, en tres condiciones que se cumplen a la vez:**

1. Ningún fallo, **salvo como máximo** `src/__key_audit__.test.tsx` por tiempo de espera agotado. Que pase no es sospechoso: es la máquina yendo suelta.
2. `git diff 79776f4..HEAD -- src/__key_audit__.test.tsx` debe estar **vacío**. Esto es lo que cierra la puerta a "arreglarlo" borrándolo o subiéndole el límite: el permiso a que pase no es permiso a tocarlo.
3. El contador total de pruebas no baja respecto a la fase anterior.

Cualquier otro fallo, en cualquier otro fichero, rechaza la fase.

### 1.2 Línea base de `tsc` (corregido el 8 de agosto de 2026)

> La versión anterior de este contrato exigía `npx tsc --noEmit` **sin errores**. Era incorrecto. Verificado sobre `79776f4` intacto: hay **9 errores preexistentes**, todos derivados de que `@playwright/test` figura en `devDependencies` pero `node_modules/@playwright` no existe en este equipo.

```
e2e/auth.spec.ts          3 errores (TS2307 + TS7031)
e2e/students.spec.ts      5 errores (TS2307 + TS7031)
playwright.config.ts      1 error  (TS2307)
```

Los 9 están confinados a ficheros de Playwright, que no entran ni en la batería de vitest ni en la compilación de la aplicación. **Ni un solo error en `lib/`, `src/` o `app/`.**

**Criterio real, aplicable de la fase 2 en adelante:** `npx tsc --noEmit` puede devolver esos 9 errores y ninguno más. **Cualquier error fuera de `e2e/` o `playwright.config.ts` es una regresión y rechaza la fase.** Instalar Playwright para limpiar la salida no forma parte de ninguna fase de corrección; si se hace, va aparte.

### 1.3 Progreso por fases

| Fase | Estado | Commits | Pruebas al cerrar |
|------|--------|---------|-------------------|
| 1. ISS-04, ISS-05 | **Aceptada** (8 de agosto de 2026) | `d90ee9d`, `d3e13ac` | 161 (160 verdes, 1 fallo intermitente) |
| 2. ISS-14, ISS-13 | **Aceptada** (8 de agosto de 2026) | `69f1eb7`, `d64a5f8` | 161 (161 verdes) |
| 3. ISS-15, ISS-09, ISS-16 | **Aceptada** (8 de agosto de 2026) | `0ef1704`, `1a8bad0`, `35316a0`, `b4c0b22`, `c87ed7b` | 180 (180 verdes) |
| 4. ISS-17, ISS-18, ISS-19 | **Aceptada con verificación pendiente** (8 de agosto de 2026) | `bd3b630`, `e40e509`, `9e4a020` | 196 (196 verdes) |

> **Deuda abierta de la fase 4.** Tres comprobaciones quedaron sin ejecutar por no haber base de datos disponible: creación real del índice único sobre una base sembrada, conteo de documentos antes y después de la secuencia Finalizar/Iniciar/Finalizar, y el diagnóstico de duplicados contra la base real. **El índice único de `AttendanceSchema` no debe desplegarse a producción hasta que el diagnóstico devuelva cero duplicados**, porque con `autoIndex` activo su construcción falla al inicializar el modelo. El guion está en el reporte de la fase.
| 5. ISS-06, ISS-07, ISS-08 | **Aceptada** (8 de agosto de 2026) | `ea8201c`, `cfc6c3f`, `83090d0` | 198 (198 verdes) |
| 6. ISS-10 a ISS-12, ISS-20 a ISS-22 | **Aceptada** (8 de agosto de 2026) | `a087960`, `76dbc78`, `b56ee83`, `ad27376`, `fdce089`, `8d80429` | 226 (226 verdes) |

**Las seis fases están cerradas.** Los 19 issues pendientes del informe quedan corregidos en la rama `fix/issues-presentacion`, de 151 a 226 pruebas, sin push ni PR. Queda una condición bloqueante para desplegar (diagnóstico de duplicados, fase 4) y tres issues nuevos registrados como trabajo posterior (ISS-23, ISS-24, ISS-25).

---

## 2. Reglas del flujo

1. **Rama de trabajo.** Crear `fix/issues-presentacion` a partir de `79776f4`. No trabajar sobre `feat/hci-kiosco` ni sobre `main`.
2. **Un commit por issue.** Nada de commits que mezclen dos correcciones: impide revisar y revertir por separado.
3. **Convención de mensajes (gitmoji).** El repositorio ya la usa (`:sparkles: feat(kiosco): ...`). Formato exigido:
   ```
   :bug: fix(planificacion): permitir iniciar sesion de clase al rol administrador

   ISS-04. El boton de sesion solo se renderizaba para el rol docente.
   ```
   Emojis a usar segun el caso: `:bug:` corrección de defecto, `:lock:` seguridad, `:sparkles:` funcionalidad nueva, `:recycle:` refactor, `:white_check_mark:` pruebas, `:wrench:` configuración, `:memo:` documentación.
4. **Prohibido tocar pruebas sin declararlo.** Si una corrección invalida una prueba existente, hay que reescribirla de forma deliberada y explicar en el commit por qué el comportamiento esperado cambió. Borrar la prueba no es una opción.
5. **Verificación obligatoria antes de entregar cada fase:**
   ```
   npx tsc --noEmit
   npx eslint .
   npx vitest run
   ```
6. **Entrega para revisión.** El implementador entrega el rango de commits. El revisor lee `git diff` real, no descripciones.
7. **Nada que persista fuera del repositorio.** Ninguna tarea programada, notificación, rutina en la nube ni acción sobre servicios externos como parte de una fase. Si el trabajo pareciera necesitarlo, se propone y se espera. **Y si se pide de forma explícita algo fuera del repositorio, se confirma antes de ejecutarlo**: la petición no se toma por sí sola como autorización, porque estas acciones siguen existiendo y consumiendo después de que la fase termine. (Añadido el 8 de agosto de 2026, a propuesta del implementador.)
8. **Credenciales de producción.** El implementador no las pide ni las busca. Las comprobaciones contra la base real las ejecuta quien ya tiene acceso, siguiendo el guion que el implementador redacte.

---

## 3. Inventario de símbolos verificados

Esta es la parte central del contrato. Todas las firmas siguientes se han leído directamente del código en `79776f4`. **El implementador debe usarlas exactamente así.** Cualquier llamada a algo que no figure aquí, o con una firma distinta, es motivo de rechazo en revisión.

### 3.1 Funciones que SÍ existen

| Símbolo | Fichero | Firma exacta |
|---------|---------|--------------|
| `canAccessLab` | `lib/scheduling.ts:103` | `(studentId: string, labCode: string, now = new Date()) => Promise<AuthResult>` |
| `getSchedulesForLab` | `lib/scheduling.ts:56` | `(labCode: string, activeOnly = true) => Promise<ScheduleView[]>` |
| `getSchedulesForTeacher` | `lib/scheduling.ts:51` | `(teacherId: string) => Promise<ScheduleView[]>` |
| `isClassNow` | `lib/scheduling.ts:78` | `(schedule: { startTime: string; endTime: string }, now = new Date()) => boolean` |
| `toMinutes` | `lib/scheduling.ts:72` | `(t: string) => number` |
| `getExistingStudentIds` | `lib/scheduling.ts:64` | `(studentIds: string[]) => Promise<string[]>` |
| `attendanceRecordId` | `lib/attendance-idempotency.ts:4` | `(studentId: string, scheduleId: string, date: string) => string` |
| `isMongoDuplicateKeyError` | `lib/attendance-idempotency.ts:12` | `(error: unknown) => boolean` |
| `markAbsentees` | `lib/handlers.ts:473` | `(scheduleId: string) => Promise<number>` |
| `getPresignedUrl` | `lib/s3.ts:71` | `(key: string, expiresIn = 300) => Promise<string>` |
| `canReadPhoto` | `lib/photo-access.ts:11` | `(actor: TokenPayload, key: string) => Promise<boolean>` |
| `isManagedPhotoKey` | `lib/photo-access.ts:6` | `(key: string) => boolean` |
| `getActor` | `lib/rbac.ts:28` | `(req: Request) => TokenPayload \| null` |
| `requireTeacher` | `lib/rbac.ts` | `(req: Request) => TokenPayload` lanza `UnauthorizedError` o `ForbiddenError` |
| `getTokenFromRequest` | `lib/auth.ts:56` | `(req: Request) => string \| null` **solo lee la cabecera `Authorization`** |
| `verifyToken` | `lib/auth.ts:51` | `(token: string) => TokenPayload` lanza si es inválido |
| `ACCESS_COOKIE` | `lib/auth.ts:76` | constante con valor `'token'` |
| `verifyTotp` | `lib/totp.ts:64` | `(secret: string, token: string, window = 1) => boolean` |
| `checkDistributedRateLimit` | `lib/distributed-rate-limit.ts:16` | `(key: string, maxRequests: number, windowMs = 60000) => Promise<boolean>` devuelve `true` si SE PERMITE |
| `getClientAddress` | `lib/distributed-rate-limit.ts:6` | `(req: Request) => string` |
| `searchFace` | `lib/rekognition.ts:90` | `(imageBytes: Uint8Array) => Promise<FaceMatchResult>` |
| `getAttendanceReport` | `lib/reports.ts:180` | `(teacherId?: string) => Promise<AttendanceReport>` |
| `getLabAttendanceReport` | `lib/reports.ts:193` | `(labCode: string) => Promise<AttendanceReport>` |
| `finishDenied` | `src/hooks/useKioskFlow.ts:236` | `(reason: DenialReason, conf: number, student: Student \| null = null) => void` |
| `changeStatus` | `src/components/SchedulesView.tsx:166` | `(schedule: Schedule, status: Schedule['status']) => Promise<void>` |

Constantes de umbral, en `lib/biometrics.ts`: `REKOGNITION_MATCH_THRESHOLD = 85`, `LIVENESS_CONFIDENCE_THRESHOLD = 75`, `DEFAULT_MATCH_PERCENTAGE = 85`, `CONSENT_VERSION = 'v1'`, `CONSENT_DAYS`.

Cupos en `lib/rate-limit.ts`: `RATE_LIMITS.login = 5`, `.compare = 10`, `.sts = 6`, `.register = 10`.

### 3.2 Valores válidos de `DenialReason` y de `FramingIssue`

> **Corregido el 7 de agosto de 2026.** La versión anterior de esta sección era incorrecta: fusionaba dos tipos distintos del mismo fichero y omitía dos valores reales. El error se detectó al revisar el plan de implementación. Se deja constancia porque esta sección es la fuente de verdad de la regla "no inventes símbolos", y una lista mala aquí produce exactamente el fallo que la regla pretende evitar.

`src/lib/kiosk-feedback.ts` declara **dos uniones distintas que no deben mezclarse**.

**`FramingIssue`** (`src/lib/kiosk-feedback.ts:25`). Problemas de encuadre ante la cámara, previos a cualquier decisión de acceso. 7 valores:

```
no-face, multiple-faces, too-far, too-close, off-center, not-frontal, low-light
```

**`DenialReason`** (`src/lib/kiosk-feedback.ts:153-169`). Motivos de denegación de acceso. Lista cerrada de 16 valores:

```
no-match, low-confidence, no-student-record, not-enrolled, permissions,
liveness-failed, capture-failed, network-error, out-of-schedule,
class-not-started, class-ended, class-cancelled, wrong-lab, virtual,
no-biometric, consent-expired
```

Ningún valor de `FramingIssue` es un `DenialReason` válido, ni al revés. Usar uno donde va el otro no compila.

`DENIAL_REASONS` es un `Record<DenialReason, DenialInfo>` completo: **añadir un motivo nuevo obliga a añadir su entrada**, o TypeScript falla.

`KioskDenialReason` (`lib/kiosk-verification.ts:27-43`) es la lista equivalente del lado del servidor. Hoy contiene **exactamente los mismos 16 valores**, verificado. Ambas deben mantenerse alineadas: cualquier motivo nuevo se añade en los dos sitios y en `DENIAL_REASONS`.

### 3.3 Símbolos que NO existen (lista negra)

Estos nombres aparecen en las propuestas del informe pero **no están en el código**. Si el implementador los invoca sin crearlos, el código no compila:

| Nombre | Situación |
|--------|-----------|
| `getActorFromHeaderOrCookie` | No existe. Hay que **crearlo** en `lib/rbac.ts` para ISS-15 |
| `middleware.ts` | No existe y **no debe crearse**. Este proyecto usa Next.js 16, cuya convención es `proxy.ts` en la raíz con `export async function proxy(req: NextRequest)` y `export const config = { matcher: [...] }`. Ya existe y funciona |
| Índice único en `Attendance` | No existe ni en `lib/models.ts` ni en `scripts/ensure-indexes.ts`. Hay que **crearlo** para ISS-19 |
| `buildReport` | Existe en `lib/reports.ts:45` pero **no está exportado**. Si se cambia su firma, solo puede llamarse desde ese mismo fichero |
| `@testing-library/react` | **No figura en `package.json`**. No se puede escribir pruebas de componentes React con esa librería sin añadirla primero como dependencia, y añadirla es una decisión que debe justificarse aparte |
| `sessionStartedAt` en `Schedule` | No existe ni en `ISchedule` ni en `ScheduleSchema` ni en `ScheduleView`. Hay que **crearlo en los tres** para ISS-05 |

**Corrección añadida el 7 de agosto de 2026.** El alcance de ISS-13 declarado en la sección 5.3 era insuficiente. `AuthUser.password` es **obligatorio** en `src/types.ts:96`, y se asigna en `src/context/AppContext.tsx:94`, `src/LoginView.tsx:40` y `src/__key_audit__.test.tsx:26`. Eliminar el campo solo de `MOCK_AUTH_USERS` no compila. La corrección de menor radio es pasarlo a `password?: string` en `src/types.ts`, con lo que los tres consumidores siguen compilando sin tocarse, incluido el test que no se puede modificar. Además, ISS-14 debe ir **antes** que ISS-13 dentro de la fase 2: si se vacía `MOCK_AUTH_USERS` primero, `ForgotPasswordView.tsx` deja de compilar en ese commit y se pierde la capacidad de revertirlos por separado.

---

## 4. Fases propuestas

Orden pensado para que cada fase sea revisable de forma independiente y para que lo que más impacto tiene en la próxima demostración entre primero.

| Fase | Issues | Objetivo | Riesgo de regresión |
|------|--------|----------|---------------------|
| 1 | ISS-04, ISS-05 | Desbloquear el flujo de la demostración | **Alto**: ISS-05 rompe pruebas existentes (ver 5.2) |
| 2 | ISS-13, ISS-14 | Retirar credenciales del navegador y cerrar la pantalla falsa | Bajo |
| 3 | ISS-15, ISS-09, ISS-16 | Corregir lo visible en pantalla: fotos, similitud, MFA | Medio |
| 4 | ISS-17, ISS-18, ISS-19 | Integridad de asistencia y reportes | Medio |
| 5 | ISS-06, ISS-07, ISS-08 | Robustez del kiosco | Bajo |
| 6 | ISS-10, ISS-11, ISS-12, ISS-20, ISS-21, ISS-22 | Infraestructura, sesión y despliegue | Medio |

---

## 5. Especificación por issue

### 5.1 ISS-04. Botón de sesión para el rol administrador

**Ancla exacta.** `src/components/SchedulesView.tsx`, líneas 333 a 337. Texto actual a sustituir:

```tsx
{isTeacher && status !== 'cancelada' && (
```

**Qué cambia.** La condición pasa a `{status !== 'cancelada' && (`. La variable `isTeacher` (línea 280) sigue usándose para el resto de controles, no se elimina.

**Verificado.** El backend ya lo permite: `handleUpdateSchedule` (`lib/handlers.ts:1201`) solo restringe por propietario cuando `actor.role === 'docente'`. Un administrador puede cambiar el estado sin cambio alguno en el servidor.

**Criterio de aceptación.**
- Con sesión de administrador, la tarjeta de una clase `programada` muestra "Iniciar sesión"; una `en_curso` muestra "Finalizar".
- Con sesión de docente, el comportamiento es idéntico al actual.
- Una clase `cancelada` no muestra ninguno de los dos botones, en ningún rol.

**No hacer.** No tocar `lib/handlers.ts` en este issue.

---

### 5.2 ISS-05. La ventana horaria deja de gobernar la autorización

**Anclas exactas.**
- `lib/scheduling.ts`, líneas 109 a 124, dentro de `canAccessLab`.
- `lib/handlers.ts`, líneas 1626 a 1632, dentro de `handleGetKioskSession`.

**Qué cambia.** El estado de sesión pasa a mandar. El orden correcto es: buscar entre las clases activas del laboratorio una con `status === 'en_curso'`, sin filtrar antes por `dayOfWeek` ni por `isClassNow`. Solo si hay varias candidatas se usa `isClassNow` para desempatar. Los filtros por `activeKiosk !== false` y por `deliveryMode` se mantienen intactos.

**Aviso al implementador: esto rompe dos pruebas existentes.** En `src/lib/scheduling.test.ts`:

- línea 97, `'deniega antes de la ventana de la clase'`
- línea 103, `'deniega después de la ventana'`

Ambas afirman exactamente el comportamiento que este issue elimina. **No se borran.** Se reescriben para que sigan cubriendo la denegación por el motivo correcto: fijar la clase en `status: 'programada'` y comprobar que el resultado es `class-not-started`, que es la regla que de verdad debe protegerse. Hay que añadir además una prueba nueva que verifique el caso que motiva el cambio: clase `en_curso` fuera de su franja horaria devuelve `allowed: true`.

**Criterio de aceptación.**
- Clase `en_curso` fuera de su franja y en otro día de la semana: autoriza.
- Clase `programada` dentro de su franja: deniega con `class-not-started`.
- Clase `finalizada`: deniega con `class-ended`. Clase `cancelada`: deniega con `class-cancelled`.
- Los motivos `not-enrolled`, `no-biometric` y `consent-expired` siguen funcionando igual.
- `handleGetKioskSession` devuelve la clase en curso aunque sea fuera de horario.
- Las 8 pruebas restantes de `describe('scheduling: canAccessLab')` siguen en verde sin modificarse.

---

### 5.3 ISS-13. Credenciales fuera del paquete del navegador

**Anclas.** `src/data.ts` líneas 204 a 234 (`MOCK_AUTH_USERS`), `src/ForgotPasswordView.tsx` línea 7 (el `import`).

**Qué cambia.** Eliminar el campo `password` de todas las entradas de `MOCK_AUTH_USERS` y romper el `import` desde `ForgotPasswordView` (se resuelve junto con ISS-14).

**Antes de tocar nada, comprobar quién más lo usa:**
```
npx tsc --noEmit          # detecta cualquier uso del campo eliminado
```
Uso conocido a día de hoy: solo `ForgotPasswordView.tsx`. `src/__key_audit__.test.tsx` importa de `src/data.ts`, pero `INITIAL_STUDENTS` e `INITIAL_LOGS`, no `MOCK_AUTH_USERS`.

**Criterio de aceptación.** Tras `npx next build`, buscar `admin123` y `docente123` en `.next/static` no devuelve ninguna coincidencia.

---

### 5.4 ISS-15. Fotografías servidas desde S3

**Anclas.** `app/api/photos/[key]/route.ts` línea 12, `lib/rbac.ts` (función nueva), `src/components/kiosk/KioskStepper.tsx` línea 187.

**Qué cambia. Son dos problemas distintos, no uno.**

*Panel (admin y docente).* Crear en `lib/rbac.ts`:
```ts
export function getActorFromHeaderOrCookie(req: Request): TokenPayload | null {
  const fromHeader = getActor(req);
  if (fromHeader) return fromHeader;
  // leer ACCESS_COOKIE del header Cookie y validarlo con verifyToken
}
```
y usarla **solo** en `app/api/photos/[key]/route.ts`. La regla "nunca por cookie" de `lib/auth.ts:55` sigue vigente para el resto de la API: esta es la única excepción, y debe llevar un comentario que explique por qué (una etiqueta `<img>` no puede enviar cabeceras).

*Kiosco.* El kiosco no tiene sesión y no debe tenerla. La vía correcta es que `POST /api/kiosk/verify` incluya en su respuesta una URL firmada de corta duración, generada en el servidor con `getPresignedUrl(key, 60)`. Eso obliga a ampliar la interfaz `KioskVerificationResult` (`lib/kiosk-verification.ts:45`) con un campo nuevo, por ejemplo `studentPhotoUrl: string | null`, y a que `KioskStepper` lo use en lugar de `getPhotoSrc`.

**No hacer.** No abrir el proxy de fotos a peticiones sin autenticar, ni siquiera "solo para el kiosco". `canReadPhoto` es la barrera que impide que un docente vea fotos de alumnos que no son suyos, y debe seguir ejecutándose.

**Criterio de aceptación.**
- Un alumno con foto en S3 se muestra en la lista de alumnos y en su ficha, con respuesta 200 en la pestaña Red.
- Un docente que pide la clave de un alumno ajeno sigue recibiendo 403.
- La pantalla de acceso concedido del kiosco muestra la foto sin que el kiosco tenga sesión.
- `src/lib/rbac.test.ts` sigue en verde.

---

### 5.5 ISS-09. Similitud real de Rekognition

**Ancla.** `lib/rekognition.ts`, línea 123.

**Qué cambia.** `bestMatch.Face.Confidence` pasa a `bestMatch.Similarity`. Ambos existen en el tipo `FaceMatch` del SDK, de modo que el cambio compila sin más.

**Efecto secundario que hay que revisar.** En `lib/kiosk-verification.ts:266`, la comprobación `match.confidence < (student.matchPercentage || 85)` deja de ser inocua y empieza a rechazar de verdad. Antes de dar la fase por buena hay que confirmar con una prueba manual que un alumno registrado sigue siendo aceptado. Si el umbral por alumno resulta demasiado estricto, se ajusta el dato, no se revierte la corrección.

**Criterio de aceptación.** Dos reconocimientos distintos del mismo alumno producen porcentajes distintos y por debajo de 100. Un valor constante de 99.9 indica que la corrección no se aplicó.

---

### 5.6 ISS-16. Código MFA incorrecto

**Anclas.** `src/modules/auth/auth.service.ts` líneas 58 a 63, `src/LoginView.tsx` líneas 30 a 34.

**Qué cambia.** Separar los dos casos: sin código, devolver `200 { mfaRequired: true }`; con código inválido, devolver `401 { error: 'Código de verificación incorrecto o caducado' }`.

**Dependencia ya resuelta.** ISS-02 (commit `79776f4`) excluyó `/auth/` del reintento automático, así que ese 401 llega intacto al formulario. No hace falta tocar `src/lib/api.ts`.

**Criterio de aceptación.** Un código incorrecto muestra el mensaje de error y el campo de MFA permanece visible para reintentar. `src/lib/auth.test.ts` y `src/security-routes.test.ts` siguen en verde.

---

### 5.7 ISS-17, ISS-18, ISS-19. Asistencia y reportes

Estos tres comparten fichero y conviene revisarlos juntos, pero en commits separados.

**ISS-17.** `lib/reports.ts:46`. La convención "lista vacía significa todas" debe sustituirse por `null` para "sin filtro" y `[]` para "ninguna clase". `buildReport` no está exportado, así que el cambio de firma queda contenido en el fichero. Adaptar las dos llamadas: `getAttendanceReport` (línea 180) y `getLabAttendanceReport` (línea 193).

**ISS-18.** `lib/reports.ts:94-112`. Normalizar por número de sesiones: `const sessions = new Set(classAtt.map(a => a.date)).size || 1`. El bloque `byStudent` (líneas 118 a 139) ya es correcto y **no se toca**.

**ISS-19.** `lib/handlers.ts:473-502` y `lib/models.ts:461-477` y `scripts/ensure-indexes.ts`. Añadir el índice único `{ studentId: 1, scheduleId: 1, date: 1 }` en los dos sitios, usar `attendanceRecordId(...)` en lugar de `att-${uuidv4()}`, y sustituir `insertMany` por `bulkWrite` con `updateOne` en modo `upsert` y `$setOnInsert`.

**Aviso.** El índice único nuevo puede fallar al crearse si la base de datos ya contiene duplicados de demostraciones anteriores. Hay que limpiarlos antes, y el implementador debe decir explícitamente si lo hizo y cómo.

**Criterio de aceptación conjunto.** Ningún porcentaje de asistencia supera 100. Un docente sin clases recibe `byClass: []`. Finalizar la misma clase dos veces no crea registros nuevos. `src/attendance-idempotency.test.ts` sigue en verde.

---

## 6. Guion de revisión por fase

El revisor recorre esta lista antes de aceptar. Cada punto se responde con evidencia, no con una afirmación.

1. **Compila.** `npx tsc --noEmit` sin errores.
2. **Estilo.** `npx eslint .` sin errores nuevos.
3. **Pruebas.** `npx vitest run` con 150 en verde y solo el fallo preexistente de `__key_audit__.test.tsx`.
4. **Símbolos.** Cada función, constante o campo nuevo que aparece en el diff existe de verdad. Contrastar contra la sección 3. Prestar atención especial a métodos de Mongoose, campos del SDK de AWS y claves de `DenialReason`.
5. **Alcance.** El diff toca únicamente los ficheros declarados en la especificación del issue. Cualquier fichero extra se justifica o se revierte.
6. **Pruebas modificadas.** Si el diff cambia un `.test.ts`, verificar que la prueba sigue afirmando algo, no que se relajó hasta pasar siempre.
7. **Criterio de aceptación.** Comprobado punto por punto contra la especificación del issue.
8. **Regresión de seguridad.** Ningún cambio debilita `canReadPhoto`, `canAccessLab`, `assertCsrf` ni `requireRole`.

---

## 7. Pendiente de decisión

- **Fase por la que empezar.** La recomendación es la fase 1, porque ISS-04 e ISS-05 son las que volverían a detener la próxima demostración.
- **Herramienta de commits.** No se ha encontrado una skill `gitmoji` instalada en este entorno, ni en la carpeta `.claude` del espacio de trabajo. La convención queda documentada en la sección 2 para que el implementador la aplique de todos modos; si la skill existe en su lado, que la use.
- **Base de datos de pruebas.** Varias comprobaciones (ISS-09, ISS-15, ISS-19) necesitan una base con datos reales. Conviene acordar contra qué entorno se validan antes de empezar la fase 3.
