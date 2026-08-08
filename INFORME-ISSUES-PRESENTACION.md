# Informe de Issues Detectados en la Presentación del MVP

**Proyecto:** FaceAccess Lab (Control de acceso a laboratorios con reconocimiento facial)
**Repositorio:** https://github.com/Ismael-1105/faceAccessLab.git
**Fecha de la presentación:** 6 de agosto de 2026
**Fecha del informe:** 7 de agosto de 2026
**Rama analizada:** `main` (HEAD `79776f4`)

---

## 1. Objetivo

Documentar los issues, errores y oportunidades de mejora detectados durante la presentación del proyecto final, junto con el proceso de corrección aplicado. Cada observación incluye la descripción del problema, el módulo o funcionalidad afectada, la causa técnica, la solución (implementada o propuesta) y el espacio para la evidencia gráfica del estado inicial y del resultado obtenido.

---

## 2. Resumen ejecutivo

Durante la demostración del MVP se produjo un bloqueo total del flujo principal: no fue posible poner una clase en estado "en curso" desde el módulo **Mis Clases**, y como el kiosco solo autoriza el reconocimiento facial cuando existe una clase en curso, la presentación no pudo avanzar más allá de esa pantalla.

A partir de ese incidente se realizaron dos revisiones sucesivas. La primera cubrió el recorrido crítico (login, panel del docente, inicio de sesión de clase, kiosco, prueba de vida, comparación biométrica y registro de asistencia). La segunda amplió el alcance a los módulos periféricos que también se muestran durante la defensa (recuperación de contraseña, MFA, fotografías de estudiantes, reportes de asistencia, exportaciones y despliegue).

Se identificaron **22 issues** en las dos revisiones: 3 ya corregidos el mismo día de la presentación y 19 documentados con su corrección propuesta. Durante la implementación de esas correcciones aparecieron **3 más** (ISS-23, ISS-24 e ISS-25), que elevan el total a **25**.

### 2.1 Tabla resumen

| ID | Severidad | Módulo afectado | Título | Estado |
|----|-----------|-----------------|--------|--------|
| ISS-01 | Bloqueante | Planificación de Clases / API `PUT /api/schedules` | La clase no se puede iniciar fuera de su ventana horaria | Corregido |
| ISS-02 | Alta | Autenticación / cliente API | El error de credenciales se enmascara como "Sesión expirada" | Corregido |
| ISS-03 | Alta | Rutas protegidas del docente | Al recargar `/docente` aparece "Debes iniciar sesión" con sesión válida | Corregido |
| ISS-04 | Bloqueante | Planificación de Clases (UI) | El botón "Iniciar sesión" no existe para el rol administrador | Pendiente |
| ISS-05 | Bloqueante | Autorización del kiosco | La restricción de ventana horaria sigue vigente en el kiosco | Pendiente |
| ISS-06 | Media | Kiosco / prueba de vida | Un fallo de prueba de vida continúa igual hacia la comparación | Pendiente |
| ISS-07 | Alta | Kiosco / temporizador de intento | El intento se autocancela a los 15 segundos, antes de terminar el desafío | Pendiente |
| ISS-08 | Alta | Prueba de vida (cliente) | Región AWS fijada a `us-east-1` en el componente de liveness | Pendiente |
| ISS-09 | Alta | Reconocimiento facial | Se reporta `Face.Confidence` en lugar de `Similarity` | Pendiente |
| ISS-10 | Alta | Conexión a base de datos | DNS forzado a 8.8.8.8, incompatible con redes con DNS filtrado | Pendiente |
| ISS-11 | Alta | Conexión a base de datos | Espera de conexión sin tiempo límite, deja peticiones colgadas | Pendiente |
| ISS-12 | Media | Limitación de peticiones | Todos los clientes comparten el cubo `unknown` y reciben 429 | Pendiente |
| ISS-13 | Alta | Recuperar contraseña / datos de demostración | Credenciales en texto plano dentro del paquete que recibe el navegador | Pendiente |
| ISS-14 | Media | Recuperar contraseña | La pantalla no está conectada al backend, valida contra una lista simulada | Pendiente |
| ISS-15 | Alta | Fotografías de estudiantes y evidencias | Las fotos alojadas en S3 nunca se muestran, el proxy devuelve 401 | Pendiente |
| ISS-16 | Alta | Autenticación de doble factor | Un código MFA incorrecto no produce ningún mensaje de error | Pendiente |
| ISS-17 | Alta | Reportes de asistencia | Un reporte sin clases devuelve el de toda la institución | Pendiente |
| ISS-18 | Media | Reportes de asistencia | El porcentaje de asistencia por clase puede superar el 100 por ciento | Pendiente |
| ISS-19 | Media | Asistencia | Finalizar la clase dos veces duplica los registros de ausencia | Pendiente |
| ISS-20 | Media | Autenticación / limitación de peticiones | El límite de 5 intentos de login por minuto es compartido por todos | Pendiente |
| ISS-21 | Media | Despliegue / detección de rostro | El runtime de MediaPipe no está versionado y puede faltar en producción | Pendiente |
| ISS-22 | Media | Sesión del panel | Al abrir `/docente` en una pestaña nueva tras 15 minutos se pierde la sesión | Pendiente |
| ISS-23 | Media | Protección de rutas | `/diagnostico` declara protección de rol pero el `matcher` no lo cubre | Pendiente |
| ISS-24 | Media | Inicialización de datos | Contraseñas de siembra escritas en el código y endpoint sin autenticación en desarrollo | Pendiente |
| ISS-25 | Media | Fotografías y evidencias | Las URLs firmadas del panel viven una hora y funcionan sin autenticación | Pendiente |

Los issues ISS-01 a ISS-12 proceden de la primera revisión (sección 4). Los issues ISS-13 a ISS-22 proceden de la segunda revisión ampliada (sección 5). Los issues ISS-23 e ISS-24 se detectaron durante la implementación de las correcciones y se documentan en la sección 5 bis.

---

## 3. Issues corregidos durante la sesión de trabajo posterior a la presentación

### ISS-01. La clase no se puede iniciar fuera de su ventana horaria (bloqueante principal)

| Campo | Detalle |
|-------|---------|
| **Severidad** | Bloqueante |
| **Módulo** | Planificación de Clases ("Mis Clases") y `PUT /api/schedules` |
| **Archivos** | `src/components/SchedulesView.tsx`, `lib/handlers.ts` |
| **Estado** | Corregido en el commit `79776f4` ("Mejoras MVP", 6 de agosto de 2026, 16:27) |

**Descripción del problema**

Al pulsar el botón **Iniciar sesión** sobre una clase, tanto si su estado era `programada` como `finalizada`, la operación fallaba y la tarjeta permanecía en su estado anterior. La interfaz mostraba el mensaje de error devuelto por el backend en la franja roja superior de la vista y la clase nunca pasaba a `en_curso`.

El impacto fue total, no parcial: el kiosco autoriza el acceso únicamente cuando la clase asociada está `en_curso` (ver `lib/scheduling.ts`, función `canAccessLab`). Al no poder iniciar la sesión, el reconocimiento facial devolvía siempre `class-not-started` y la demostración se detuvo en ese punto, sin poder mostrar la parte central del MVP.

**Causa técnica**

El handler `handleUpdateSchedule` incluía una regla de negocio (identificada internamente como "A8") que solo permitía transicionar a `en_curso` dentro de la franja horaria oficial de la clase, con un margen de 15 minutos antes del inicio:

```ts
// lib/handlers.ts (versión anterior al commit 79776f4)
const SESSION_START_MARGIN_MIN = 15;
if (updates.status === 'en_curso') {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = toMinutes(schedule.startTime) - SESSION_START_MARGIN_MIN;
  const endMin = toMinutes(schedule.endTime);
  if (nowMin < startMin || nowMin > endMin) {
    return errorResponse(
      `La clase solo puede iniciarse entre ${schedule.startTime} y ${schedule.endTime} (máx. 15 min antes)`,
      400,
    );
  }
}
```

Las clases sembradas para la demostración tenían horarios que no coincidían con la hora real de la presentación, de modo que la regla rechazaba el inicio con un HTTP 400 en todos los intentos.

**Solución implementada**

Se eliminó por completo el bloque de validación horaria de `handleUpdateSchedule`. El docente puede ahora iniciar la sesión de cualquiera de sus clases en el momento que lo necesite, que es el comportamiento esperado tanto para la demostración como para el uso real (una clase puede empezar tarde, adelantarse o recuperarse en otro horario).

Se conservan las validaciones que sí protegen la integridad del modelo:

- Solo el docente propietario de la clase puede cambiar su estado (`schedule.teacherId !== actor.userId` devuelve 403).
- El docente no puede modificar materia, laboratorio, día ni horario.
- La cancelación sigue siendo terminal: una clase `cancelada` no admite ningún cambio posterior.

**Evidencia**

```
Commit:  79776f4258a2f7d2816f649786df2715ac84e33e
Archivo: lib/handlers.ts
Cambio:  -18 líneas (eliminación del bloque A8 y del import de toMinutes)
```

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 01-A]` Vista Mis Clases, tarjeta en estado "Programada", franja de error roja con el texto "La clase solo puede iniciarse entre 08:00 y 10:00 (máx. 15 min antes)" | `[CAPTURA 01-B]` Misma tarjeta tras la corrección, con la etiqueta verde "En curso" y el aviso "Sesión iniciada: <materia>" |

---

### ISS-02. El error de credenciales se enmascara como "Sesión expirada"

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Módulo** | Autenticación, cliente HTTP del frontend |
| **Archivo** | `src/lib/api.ts` |
| **Estado** | Corregido en el commit `79776f4` |

**Descripción del problema**

Al escribir mal la contraseña en la pantalla de login, el usuario no recibía el mensaje "Credenciales inválidas". En su lugar se producía una llamada adicional a `/api/auth/refresh`, se borraba el token almacenado y el formulario mostraba "Sesión expirada". Durante la presentación esto generó confusión al reintentar el acceso, porque el mensaje sugería un problema de sesión y no un error de escritura.

**Causa técnica**

El interceptor genérico de respuestas trataba cualquier HTTP 401 como un access token caducado y disparaba la rotación del refresh token, incluidos los endpoints de autenticación, donde un 401 significa exactamente lo contrario: las credenciales enviadas no son válidas.

**Solución implementada**

Se excluyeron los endpoints bajo `/auth/` del reintento automático:

```ts
// src/lib/api.ts
// Endpoints de autenticación: un 401 es un error de credenciales, no una
// sesión expirada. No tiene sentido intentar rotar el refresh token.
const isAuthEndpoint = path.startsWith('/auth/');

if (res.status === 401 && !retried && !isAuthEndpoint) {
  const refreshed = await refreshAccessToken();
  ...
}
```

Con el cambio, el 401 del login llega intacto a `handleResponse` y la vista muestra el mensaje real devuelto por el servidor.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 02-A]` Formulario de login con el mensaje "Sesión expirada" tras introducir una contraseña incorrecta | `[CAPTURA 02-B]` Formulario de login mostrando el mensaje real de credenciales inválidas |

---

### ISS-03. Al recargar `/docente` aparece "Debes iniciar sesión" con sesión válida

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Módulo** | Rutas protegidas del panel del docente y del administrador |
| **Archivos** | `app/docente/page.tsx`, `app/docente/demo/page.tsx`, `app/docente/arquitectura/page.tsx`, `src/context/AppContext.tsx`, `src/components/RequireAuth.tsx` |
| **Estado** | Corregido en el commit `835b279` ("Eliminacion de COrs", 6 de agosto de 2026, 15:29) |

**Descripción del problema**

Si durante la demostración se recargaba la página del panel (F5) o se accedía directamente por URL, aparecía el texto "Debes iniciar sesión para acceder" aunque la sesión siguiera siendo válida. Había que volver al inicio y repetir el login, lo que rompía el ritmo de la presentación.

**Causa técnica**

Las páginas comprobaban `user` del contexto de forma síncrona. La restauración de la sesión desde `localStorage`, y en su caso la rotación del refresh token, son operaciones asíncronas, de modo que en el primer render `user` todavía era `null` y se pintaba el mensaje de acceso denegado sin esperar al resultado.

**Solución implementada**

1. Se añadió el indicador `sessionReady` a `AppContext`, que pasa a `true` únicamente cuando la restauración de la sesión ha terminado (con éxito o sin él).
2. Se creó el componente `RequireAuth`, que muestra un estado de carga mientras `sessionReady` es `false`, y solo redirige a `/login` cuando la restauración ha concluido y no hay usuario.
3. Las tres páginas bajo `/docente` pasaron a envolver su contenido en `RequireAuth`.

```tsx
// src/components/RequireAuth.tsx
const { user, sessionReady } = useApp();

useEffect(() => {
  if (sessionReady && !user) router.replace('/login');
}, [sessionReady, user, router]);

if (!sessionReady) return <p>Cargando sesión...</p>;
if (!user) return null;
return <>{children}</>;
```

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 03-A]` Pantalla con el texto "Debes iniciar sesión para acceder" tras recargar `/docente` con sesión activa | `[CAPTURA 03-B]` Panel del docente restaurado correctamente tras la recarga, con el estado intermedio "Cargando sesión..." |

---

## 4. Issues detectados en la revisión posterior

Los siguientes issues no llegaron a manifestarse en pantalla durante la presentación, pero pertenecen al mismo recorrido crítico y cualquiera de ellos habría producido un bloqueo equivalente. Se documentan con su corrección propuesta para incorporarlos al plan de trabajo.

### ISS-04. El botón "Iniciar sesión" no existe para el rol administrador

| Campo | Detalle |
|-------|---------|
| **Severidad** | Bloqueante |
| **Módulo** | Planificación de Clases (interfaz) |
| **Archivo** | `src/components/SchedulesView.tsx`, líneas 333 a 337 |
| **Estado** | Pendiente |

**Descripción del problema**

Los controles de sesión de clase (Iniciar y Finalizar) se renderizan únicamente cuando el rol autenticado es `docente`:

```tsx
{isTeacher && status !== 'cancelada' && (
  status === 'en_curso'
    ? <button onClick={() => changeStatus(schedule, 'finalizada')}>Finalizar</button>
    : <button onClick={() => changeStatus(schedule, 'en_curso')}>Iniciar sesión</button>
)}
```

Un administrador ve la pestaña "Planificación" con todas las clases y puede crearlas, editarlas, eliminarlas e inscribir estudiantes, pero no dispone de ninguna forma de poner una clase en curso desde la interfaz. Si la demostración se realiza con una cuenta de administrador, el flujo del kiosco es inalcanzable, exactamente el mismo síntoma de ISS-01 pero por una causa distinta.

El backend sí lo permite: `handleUpdateSchedule` restringe por propietario solo cuando `actor.role === 'docente'`, de modo que un administrador puede cambiar el estado por API. La limitación es exclusivamente de interfaz.

**Corrección propuesta**

Mostrar los controles de sesión también para el rol administrador, cambiando la condición de renderizado:

```tsx
{status !== 'cancelada' && (
  status === 'en_curso'
    ? <button onClick={() => changeStatus(schedule, 'finalizada')}>Finalizar</button>
    : <button onClick={() => changeStatus(schedule, 'en_curso')}>Iniciar sesión</button>
)}
```

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 04-A]` Vista Planificación con sesión de administrador, tarjeta sin los botones Iniciar ni Finalizar | `[CAPTURA 04-B]` Misma vista con los botones de sesión disponibles para el administrador |

---

### ISS-05. La restricción de ventana horaria sigue vigente en el kiosco

| Campo | Detalle |
|-------|---------|
| **Severidad** | Bloqueante |
| **Módulo** | Autorización del kiosco |
| **Archivos** | `lib/scheduling.ts`, líneas 109 a 124; `lib/handlers.ts`, líneas 1626 a 1632 |
| **Estado** | Pendiente |

**Descripción del problema**

La corrección de ISS-01 eliminó la restricción horaria del inicio de la clase, pero la misma restricción sigue aplicándose un paso más adelante, en la autorización del kiosco. La función `canAccessLab` exige dos condiciones antes de consultar el estado de la clase:

```ts
const day = now.getDay();
const schedules = await getSchedulesForLab(labCode, true).then(list =>
  list.filter(s => s.dayOfWeek === day && s.activeKiosk !== false)
);
if (schedules.length === 0) return { allowed: false, schedule: null, reason: 'no-class' };

const inSession = schedules.find(s => isClassNow(s, now));
if (!inSession) {
  ...
  return { allowed: false, schedule: earliest, reason };  // class-not-started o class-ended
}
```

Es decir, la clase debe estar programada para el día de la semana actual **y** la hora real debe caer dentro de su franja `startTime` a `endTime`. Si la demostración se realiza un martes con una clase configurada para los lunes, o a las 16:00 con una clase de 08:00 a 10:00, el kiosco deniega el acceso con `class-not-started` o `class-ended` aunque el docente haya iniciado la sesión correctamente.

El mismo filtro se repite en `handleGetKioskSession`, de modo que la cabecera del kiosco muestra "sin sesión activa" incluso con la clase en curso.

**Corrección propuesta**

Hacer que el estado de sesión gobierne la autorización y que la franja horaria actúe solo como criterio de desempate cuando hay varias clases candidatas:

1. En `canAccessLab`, buscar primero una clase del laboratorio con `status === 'en_curso'` sin filtrar por `dayOfWeek` ni por `isClassNow`.
2. Conservar `isClassNow` únicamente para elegir entre varias clases simultáneas en curso y para los mensajes informativos.
3. Aplicar el mismo criterio en `handleGetKioskSession` para que la cabecera refleje la clase realmente en curso.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 05-A]` Kiosco mostrando la denegación "La clase aún no ha comenzado" con la clase ya iniciada en el panel del docente | `[CAPTURA 05-B]` Kiosco autorizando el acceso con la misma clase en curso fuera de su franja horaria |

---

### ISS-06. Un fallo de prueba de vida continúa igual hacia la comparación

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Kiosco, flujo de verificación |
| **Archivo** | `src/hooks/useKioskFlow.ts`, líneas 278 a 286 |
| **Estado** | Pendiente |

**Descripción del problema**

El manejador de éxito y el de fallo de la prueba de vida ejecutan exactamente la misma acción:

```ts
const handleLivenessSuccess = useCallback(() => {
  setLivenessSessionId(null);
  performScanRef.current();
}, []);

const handleLivenessFail = useCallback((_message: string) => {
  setLivenessSessionId(null);
  performScanRef.current();
}, []);
```

El mensaje de error que produjo el fallo se descarta (`_message` no se usa) y el kiosco avanza a la fase de comparación como si el desafío hubiera tenido éxito. El usuario ve la barra de progreso completa y, segundos después, un rechazo genérico sin relación aparente con lo que ocurrió.

Conviene precisar que esto **no** es un agujero de seguridad: el backend vuelve a consultar el resultado oficial en AWS mediante `getLivenessResult` y deniega con motivo `liveness-failed` si el desafío no fue superado. El problema es de experiencia de usuario y de diagnóstico durante una demostración, donde el motivo real del rechazo queda oculto.

**Corrección propuesta**

Diferenciar ambos caminos: en el fallo, cerrar el intento directamente con el motivo `liveness-failed` y presentar el mensaje devuelto por el detector, sin gastar una llamada de comparación.

```ts
const handleLivenessFail = useCallback((message: string) => {
  setLivenessSessionId(null);
  console.warn('[Kiosk] Prueba de vida fallida:', message);
  finishDenied('liveness-failed', 0);
}, [finishDenied]);
```

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 06-A]` Kiosco tras un fallo de prueba de vida, mostrando un rechazo genérico | `[CAPTURA 06-B]` Kiosco mostrando el motivo específico "Prueba de vida no superada" |

---

### ISS-07. El intento se autocancela antes de terminar el desafío de prueba de vida

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Módulo** | Kiosco, temporizador de intento |
| **Archivo** | `src/hooks/useKioskFlow.ts`, línea 87 y líneas 428 a 448 |
| **Estado** | Pendiente |

**Descripción del problema**

El kiosco cancela automáticamente cualquier intento que supere 15 segundos:

```ts
const ATTEMPT_TIMEOUT_MS = 15000;
```

El temporizador arranca al pulsar el inicio del intento y sigue activo durante toda la fase de prueba de vida. En ese intervalo el navegador debe cargar el componente `FaceLivenessDetectorCore`, solicitar credenciales temporales a STS, abrir el canal de streaming con AWS y completar el desafío de movimiento del usuario. En un equipo lento, con un proyector conectado o con la red del campus, ese conjunto de pasos supera con facilidad los 15 segundos.

El resultado es un bucle: el intento se cancela, el kiosco reinicia a los 5 segundos, vuelve a detectar el rostro, arranca un intento nuevo y se cancela otra vez. Durante una presentación esto se percibe como una aplicación que no responde.

**Corrección propuesta**

1. Elevar el tiempo límite a 45 segundos, valor coherente con la duración real del desafío de AWS Face Liveness más la carga inicial.
2. Detener el temporizador mientras la fase activa sea `liveness`, y contabilizar el tiempo solo a partir del inicio de la comparación, que es la fase que sí debe resolverse en pocos segundos.
3. Mostrar el segundero restante en pantalla únicamente cuando queden menos de 10 segundos, para no distraer al usuario.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 07-A]` Kiosco mostrando "Intento cancelado por tiempo" en mitad del desafío de prueba de vida | `[CAPTURA 07-B]` Desafío de prueba de vida completado sin cancelación |

---

### ISS-08. Región AWS fijada a `us-east-1` en el componente de prueba de vida

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Módulo** | Prueba de vida (cliente) |
| **Archivo** | `src/components/FaceLivenessView.tsx`, línea 62 |
| **Estado** | Pendiente |

**Descripción del problema**

El componente del navegador declara la región de forma literal:

```tsx
<FaceLivenessDetectorCore
  sessionId={sessionId}
  region="us-east-1"
  ...
/>
```

En cambio, el backend crea la sesión con `process.env.AWS_REGION || 'us-east-1'` (`lib/liveness.ts`, línea 12). Si el despliegue define `AWS_REGION` con cualquier otro valor, el `sessionId` se crea en una región y se consume en otra. AWS no encuentra la sesión y **todas** las pruebas de vida fallan, sin excepción y sin mensaje claro.

Es un fallo silencioso mientras el entorno coincida con el valor por defecto, y total en cuanto deje de coincidir. Dado que el proyecto también usa recursos de S3, SNS y KMS con ARNs de región explícita, el riesgo de divergencia es real.

**Corrección propuesta**

Devolver la región desde el mismo endpoint que ya entrega las credenciales temporales y consumirla en el componente, de modo que exista una única fuente de verdad:

```ts
// app/api/aws/credentials/route.ts
return Response.json({ ok: true, region, accessKeyId, secretAccessKey, sessionToken, expiration });
```

```tsx
// src/components/FaceLivenessView.tsx
const [region, setRegion] = useState('us-east-1');
...
<FaceLivenessDetectorCore sessionId={sessionId} region={region} ... />
```

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 08-A]` Consola del navegador con el error de sesión de liveness no encontrada al usar una región distinta | `[CAPTURA 08-B]` Prueba de vida funcionando con la región resuelta dinámicamente |

---

### ISS-09. Se reporta `Face.Confidence` en lugar de `Similarity`

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Módulo** | Reconocimiento facial |
| **Archivo** | `lib/rekognition.ts`, líneas 109 a 126 |
| **Estado** | Pendiente |

**Descripción del problema**

La función `searchFace` toma el mejor resultado de `SearchFacesByImage` y devuelve como porcentaje de coincidencia el campo equivocado:

```ts
const bestMatch = result.FaceMatches?.[0];
...
return {
  studentId: bestMatch.Face.ExternalImageId || null,
  confidence: parseFloat((bestMatch.Face.Confidence ?? 0).toFixed(1)),
  ...
};
```

En la API de Rekognition, `FaceMatch.Face.Confidence` es la confianza de que la región indexada contiene un rostro, un valor que en la práctica siempre ronda 99.9 por ciento. La similitud real entre el rostro capturado y el rostro almacenado es `FaceMatch.Similarity`.

Consecuencias:

1. El porcentaje de coincidencia que se muestra en el kiosco, en el historial de accesos y en el comprobante de entrada no refleja la calidad real del reconocimiento. Siempre aparece cerca de 99.9 por ciento, incluso en coincidencias marginales.
2. La comprobación por estudiante `match.confidence < (student.matchPercentage || 85)` en `lib/kiosk-verification.ts` nunca llega a rechazar, porque compara contra un valor prácticamente constante. El umbral individual configurado en la pantalla de Calibración queda sin efecto.
3. El umbral efectivo es únicamente `FaceMatchThreshold: 85` que se envía a Rekognition, y no puede ajustarse por estudiante.

**Corrección propuesta**

```ts
return {
  studentId: bestMatch.Face.ExternalImageId || null,
  studentName: null,
  confidence: parseFloat((bestMatch.Similarity ?? 0).toFixed(1)),
  faceId: bestMatch.Face.FaceId || null,
  externalImageId: bestMatch.Face.ExternalImageId || null,
};
```

Tras el cambio conviene revisar los umbrales por estudiante, ya que por primera vez pasarán a tener efecto real.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 09-A]` Historial de accesos con todas las coincidencias en 99.9 por ciento, incluidas las rechazadas | `[CAPTURA 09-B]` Historial con porcentajes de similitud reales y variables por intento |

---

### ISS-10. DNS forzado a 8.8.8.8, incompatible con redes con DNS filtrado

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Módulo** | Conexión a base de datos |
| **Archivo** | `lib/db.ts`, línea 7 |
| **Estado** | Pendiente |

**Descripción del problema**

El módulo de base de datos sobrescribe los servidores DNS del sistema al importarse:

```ts
dns.setServers(['8.8.8.8', '8.8.4.4']);
```

La cadena de conexión de MongoDB Atlas usa el esquema `mongodb+srv://`, que requiere resolver registros SRV y TXT. Muchas redes institucionales, incluidas las universitarias, bloquean o interceptan el tráfico DNS saliente hacia resolvedores externos, o exigen el uso del resolvedor interno para resolver nombres. En esas condiciones la resolución falla, `connectDB` lanza el error `MongoDB connection failed`, y **todos** los endpoints de la aplicación devuelven error: login, panel, kiosco y reportes.

Es un fallo que no aparece en el equipo de desarrollo y sí en la red donde se realiza la presentación, que es el peor escenario posible.

**Corrección propuesta**

Hacer que la sobrescritura sea opcional y desactivada por defecto, de modo que la aplicación use el resolvedor del sistema salvo indicación expresa:

```ts
const customDns = process.env.DNS_SERVERS;
if (customDns) {
  dns.setServers(customDns.split(',').map(s => s.trim()).filter(Boolean));
}
```

Como plan de contingencia para la presentación, documentar en el README la cadena de conexión alternativa sin SRV (`mongodb://host1,host2,host3/...`), que no depende de la resolución de registros SRV.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 10-A]` Consola del servidor con el error `MongoDB connection failed` por fallo de resolución SRV | `[CAPTURA 10-B]` Arranque correcto con `db.connected` usando el resolvedor del sistema |

---

### ISS-11. Espera de conexión sin tiempo límite, deja peticiones colgadas

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Módulo** | Conexión a base de datos |
| **Archivo** | `lib/db.ts`, líneas 46 a 56 |
| **Estado** | Pendiente |

**Descripción del problema**

Cuando una petición encuentra una conexión en curso, entra en un bucle de espera que solo termina si la conexión llega a establecerse:

```ts
if (isConnecting) {
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (mongoose.connection.readyState === 1) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
  return mongoose;
}
```

No existe ninguna condición de salida por error ni por tiempo. Si el primer intento de conexión falla, por ejemplo por el escenario de ISS-10 o por una caída de red, el bloque `finally` pone `isConnecting` en `false`, pero las peticiones que ya entraron en el bucle siguen consultando cada 100 milisegundos de forma indefinida. Esas peticiones nunca responden ni con éxito ni con error.

En la interfaz esto se traduce en pantallas permanentemente en "Cargando planificación...", "Cargando sesión..." o un kiosco que nunca completa la verificación, sin ningún mensaje de error que oriente sobre la causa. El síntoma es indistinguible de una aplicación colgada.

**Corrección propuesta**

Reemplazar el bucle por una promesa compartida con tiempo límite explícito, de modo que el fallo se propague a todas las peticiones en espera:

```ts
let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(getMongoUri(), { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000 })
      .then(async (m) => { await runMigrations(); return m; })
      .catch((error) => { connectionPromise = null; throw error; });
  }
  return connectionPromise;
}
```

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 11-A]` Vista bloqueada en "Cargando planificación..." de forma indefinida con la base de datos caída | `[CAPTURA 11-B]` Misma vista mostrando el mensaje de error de conexión en lugar de quedarse cargando |

---

### ISS-12. Todos los clientes comparten el cubo `unknown` y reciben 429

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Limitación de peticiones |
| **Archivo** | `lib/distributed-rate-limit.ts`, líneas 6 a 9 |
| **Estado** | Pendiente |

**Descripción del problema**

La dirección del cliente se obtiene exclusivamente de cabeceras de proxy:

```ts
export function getClientAddress(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}
```

Cuando la aplicación se ejecuta sin un proxy inverso delante, escenario habitual en una demostración local o en una red interna, ninguna de las dos cabeceras existe y todos los clientes comparten la clave literal `unknown`. Los límites vigentes son especialmente restrictivos para el flujo del kiosco:

| Clave | Límite por minuto | Endpoint |
|-------|-------------------|----------|
| `sts:<ip>` | 6 | `GET /api/aws/credentials` |
| `kiosk-verify:<ip>` | 10 | `POST /api/kiosk/verify` |

Cada intento de reconocimiento consume una credencial STS y una verificación. Con seis intentos por minuto compartidos entre todos los asistentes, unos pocos reintentos durante la demostración agotan el cupo y el kiosco empieza a responder "Demasiadas solicitudes. Espera un minuto." sin que exista ningún abuso real.

**Corrección propuesta**

1. Incorporar un identificador estable del terminal a la clave del limitador, por ejemplo el `attemptId` o el `KIOSK_ID`, en lugar de depender solo de la dirección IP.
2. Elevar `RATE_LIMIT_STS` a un valor coherente con el uso previsto del kiosco (20 por minuto) y documentarlo en `.env.example`.
3. Registrar en los logs cada respuesta 429 con la clave afectada, para poder distinguir un límite alcanzado de un fallo funcional.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 12-A]` Kiosco mostrando "Demasiadas solicitudes. Espera un minuto." tras varios intentos consecutivos | `[CAPTURA 12-B]` Kiosco procesando intentos sucesivos sin alcanzar el límite |

---

## 5. Issues detectados en la segunda revisión

Esta segunda revisión amplió el alcance a los módulos que acompañan al recorrido principal y que también se muestran o se mencionan durante la defensa del proyecto. Ninguno de ellos detuvo la presentación, pero varios son inmediatamente visibles para un evaluador que explore la aplicación por su cuenta.

### ISS-13. Credenciales en texto plano dentro del paquete que recibe el navegador

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta (seguridad) |
| **Módulo** | Datos de demostración y pantalla de recuperación de contraseña |
| **Archivos** | `src/data.ts`, líneas 204 a 234; `src/ForgotPasswordView.tsx`, línea 7 |
| **Estado** | Pendiente |

**Descripción del problema**

El archivo `src/data.ts` contiene una lista de usuarios de demostración con sus contraseñas escritas directamente en el código:

```ts
export const MOCK_AUTH_USERS: AuthUser[] = [
  { id: 'doc-1', email: 'docente@faceaccess.lab', password: 'docente123', role: 'docente', ... },
  { id: 'doc-2', email: 'admin@faceaccess.lab',   password: 'admin123',   role: 'admin',   ... },
  { id: 'stu-1', email: 'ismael@faceaccess.lab',  password: 'estudiante123', role: 'estudiante', ... },
  ...
];
```

Ese archivo es importado por `src/ForgotPasswordView.tsx`, que es un componente de cliente (`'use client'`) y forma parte de la ruta pública `/recuperar`. En consecuencia, la lista completa de correos y contraseñas viaja al navegador dentro del paquete JavaScript de la aplicación, y cualquier persona puede leerla abriendo las herramientas de desarrollo en la pestaña Fuentes, o buscando la cadena `admin123` en los archivos descargados.

Durante una defensa técnica esto es especialmente delicado: es un hallazgo que un evaluador puede reproducir en segundos y que contradice el discurso de seguridad del proyecto (cifrado KMS, tokens de corta duración, prueba de vida, auditoría).

**Corrección propuesta**

1. Eliminar el campo `password` de `MOCK_AUTH_USERS`, que ninguna función necesita para operar.
2. Desacoplar `ForgotPasswordView` de `src/data.ts` (ver ISS-14), de modo que ningún dato de demostración se incluya en el paquete del cliente.
3. Mantener las credenciales de siembra únicamente en `scripts/seed.ts`, que se ejecuta en el servidor y nunca se empaqueta para el navegador.
4. Rotar las contraseñas de las cuentas sembradas antes de la siguiente demostración.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 13-A]` Herramientas de desarrollo, pestaña Fuentes, mostrando `admin123` y `docente123` dentro del paquete descargado | `[CAPTURA 13-B]` Misma búsqueda sin resultados tras retirar los datos del cliente |

---

### ISS-14. La pantalla de recuperación de contraseña no está conectada al backend

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Recuperar contraseña |
| **Archivo** | `src/ForgotPasswordView.tsx`, líneas 15 a 28 |
| **Estado** | Pendiente |

**Descripción del problema**

El enlace "¿Olvidaste tu contraseña?" es visible en la pantalla de login y conduce a `/recuperar`. Esa vista no realiza ninguna llamada al servidor: compara el correo introducido contra la lista simulada del cliente.

```tsx
const exists = MOCK_AUTH_USERS.find(
  u => u.email === email && (u.role === 'admin' || u.role === 'docente')
);
if (exists) setSent(true);
else setError('No encontramos una cuenta docente con ese correo.');
```

El comportamiento resultante es contradictorio. Un docente real registrado en la base de datos, cuyo correo no figura en la lista simulada, recibe el mensaje "No encontramos una cuenta docente con ese correo", que es falso. A la inversa, un correo de la lista simulada que no existe en la base de datos recibe la confirmación "Correo enviado".

Adicionalmente, distinguir entre correo existente y no existente permite enumerar cuentas válidas, práctica desaconsejada en un formulario de recuperación.

**Corrección propuesta**

1. Crear el endpoint `POST /api/auth/recover`, que registre la solicitud en auditoría y, en su caso, envíe el correo mediante el cliente de SESv2 que el proyecto ya tiene entre sus dependencias.
2. Responder siempre con el mismo mensaje neutro, exista o no la cuenta, para no revelar qué correos están registrados.
3. Si el envío real de correo queda fuera del alcance del MVP, sustituir la pantalla por un aviso explícito de funcionalidad no disponible en esta versión, en lugar de simular un envío correcto.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 14-A]` Pantalla de recuperación rechazando el correo de un docente realmente registrado | `[CAPTURA 14-B]` Pantalla devolviendo la respuesta neutra para cualquier correo introducido |

---

### ISS-15. Las fotografías alojadas en S3 nunca se muestran

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Módulo** | Fotografías de estudiantes, evidencias y pantalla de acceso concedido del kiosco |
| **Archivos** | `app/api/photos/[key]/route.ts`, `lib/rbac.ts` líneas 28 a 35, `lib/auth.ts` líneas 55 a 62, `src/lib/photoUrl.ts` |
| **Estado** | Pendiente |

**Descripción del problema**

El proxy de fotografías exige una sesión autenticada:

```ts
const actor = requireTeacher(req);
```

Y la resolución del actor acepta el token exclusivamente por cabecera:

```ts
// lib/auth.ts
/** Solo se acepta el token por cabecera Authorization (nunca por cookie). */
export function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}
```

Sin embargo, el resultado de `getPhotoSrc()` se consume directamente como atributo `src` de una etiqueta `<img>` en cuatro lugares: `AdminView.tsx` (línea 573), `StudentDetailView.tsx` (línea 257), `StudentProfile.tsx` (línea 63) y `KioskStepper.tsx` (línea 187).

Un navegador nunca añade la cabecera `Authorization` a la petición de una imagen. Por tanto **toda fotografía cuya referencia sea una clave de S3 devuelve 401 y no llega a mostrarse**. En `AdminView` el fallo queda enmascarado por el manejador `onError`, que sustituye la imagen por el fondo genérico, de modo que el problema se percibe como "el alumno no tiene foto" en lugar de como un error.

El caso más grave es el del kiosco: `KioskStepper` muestra la fotografía del estudiante reconocido en la pantalla de acceso concedido, y el kiosco es un terminal público que por diseño no tiene ninguna sesión. Esa petición está garantizado que devuelve 401.

El problema no se manifestó en la presentación porque los estudiantes sembrados usan imágenes locales de `public/images/students/`, cuyas rutas empiezan por `/` y que `getPhotoSrc` devuelve sin pasar por el proxy. Se manifiesta en cuanto se registra un estudiante nuevo durante la demostración, que es precisamente el flujo que se quiere lucir.

**Corrección propuesta**

Aceptar también la cookie de acceso en el proxy de fotografías, que es el único endpoint consumido por el navegador fuera de una llamada `fetch`:

```ts
// app/api/photos/[key]/route.ts
const actor = getActorFromHeaderOrCookie(req);   // nueva función: Authorization o cookie ACCESS_COOKIE
if (!actor || (actor.role !== 'admin' && actor.role !== 'docente')) {
  return Response.json({ error: 'No autorizado' }, { status: 401 });
}
```

Para el kiosco, que no debe tener sesión, la alternativa correcta es que `POST /api/kiosk/verify` devuelva junto al resultado una URL firmada de corta duración para la fotografía del estudiante reconocido, generada en el servidor y válida solo durante los segundos que dura la pantalla de resultado.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 15-A]` Lista de alumnos con la foto sustituida por el fondo genérico y pestaña Red mostrando el 401 de `/api/photos/...` | `[CAPTURA 15-B]` Lista de alumnos mostrando las fotografías reales y respuesta 200 en la pestaña Red |

---

### ISS-16. Un código MFA incorrecto no produce ningún mensaje de error

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Módulo** | Autenticación de doble factor |
| **Archivos** | `src/modules/auth/auth.service.ts`, líneas 58 a 63; `src/LoginView.tsx`, líneas 30 a 34 |
| **Estado** | Pendiente |

**Descripción del problema**

El servicio de autenticación devuelve exactamente la misma respuesta en dos situaciones distintas: cuando el usuario tiene MFA activado y todavía no ha introducido el código, y cuando lo ha introducido pero es incorrecto.

```ts
if (user.mfaEnabled) {
  if (!input.mfaToken || !user.mfaSecret || !verifyTotp(user.mfaSecret, input.mfaToken)) {
    return { status: 200, body: { mfaRequired: true, user: toDTO(user) } };
  }
}
```

La vista de login interpreta esa respuesta como "hay que pedir el código" y, de forma explícita, borra cualquier error previo:

```tsx
if (result.mfaRequired) {
  setMfaRequired(true);
  setError('');
  return;
}
```

El resultado es que introducir un código de seis dígitos equivocado no produce ningún efecto visible. El botón muestra "Verificando..." durante un instante, vuelve a su estado normal y la pantalla queda igual, sin mensaje alguno. Para el usuario la aplicación parece congelada, y es el tipo de comportamiento que en una demostración se interpreta como un fallo grave.

**Corrección propuesta**

Distinguir ambos casos en el servicio y reflejarlos en la vista:

```ts
if (user.mfaEnabled) {
  if (!input.mfaToken) {
    return { status: 200, body: { mfaRequired: true, user: toDTO(user) } };
  }
  if (!user.mfaSecret || !verifyTotp(user.mfaSecret, input.mfaToken)) {
    return { status: 401, body: { error: 'Código de verificación incorrecto o caducado' } };
  }
}
```

Con el cambio de ISS-02 ya aplicado, ese 401 llega intacto al formulario y se muestra en la franja de error. Conviene además mantener el campo de MFA visible tras el fallo, para que el usuario pueda reintentar sin repetir correo y contraseña.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 16-A]` Formulario de login con el campo MFA relleno con un código incorrecto y sin ningún mensaje tras pulsar Verificar | `[CAPTURA 16-B]` Mismo formulario mostrando "Código de verificación incorrecto o caducado" |

---

### ISS-17. Un reporte sin clases devuelve el de toda la institución

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta (fuga de información entre docentes) |
| **Módulo** | Reportes de asistencia |
| **Archivo** | `lib/reports.ts`, líneas 46 a 49, 180 a 195 |
| **Estado** | Pendiente |

**Descripción del problema**

La función que construye el reporte interpreta una lista vacía de clases como "todas las clases":

```ts
async function buildReport(scheduleIds: string[]): Promise<AttendanceReport> {
  const schedules = scheduleIds.length
    ? await Schedule.find({ id: { $in: scheduleIds } })
    : await Schedule.find();          // <-- lista vacía significa "todo"
```

Esa convención es correcta para el administrador, que llama sin argumentos. Pero también se activa en dos casos en los que debería devolverse un reporte vacío:

1. `getAttendanceReport(teacherId)` con un docente que todavía no tiene clases asignadas. `scheduleIds` es `[]`, se consulta toda la colección y el docente recibe la asistencia, los rechazos y los incidentes de **todas las clases de todos los docentes**. El campo `scope` se marca como `'docente'`, de modo que la interfaz presenta esos datos ajenos como propios.
2. `getLabAttendanceReport(labCode)` con un laboratorio sin horarios configurados devuelve igualmente el reporte global de todos los laboratorios.

Esto contradice directamente la regla F2 que el proyecto aplica correctamente en el resto de handlers ("un docente solo ve sus propias clases") y constituye una fuga de información entre docentes.

**Corrección propuesta**

Separar de forma explícita "sin filtro" de "filtro vacío", usando `null` para el primer caso:

```ts
async function buildReport(scheduleIds: string[] | null): Promise<AttendanceReport> {
  const schedules = scheduleIds === null
    ? await Schedule.find()
    : scheduleIds.length === 0
      ? []
      : await Schedule.find({ id: { $in: scheduleIds } });
  ...
}

export async function getAttendanceReport(teacherId?: string) {
  const scheduleIds = teacherId
    ? (await getSchedulesForTeacher(teacherId)).map(s => s.id)
    : null;
  ...
}
```

Conviene acompañar la corrección con una prueba automática que verifique que un docente sin clases recibe `byClass: []`.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 17-A]` Pestaña Reportes con un docente sin clases asignadas, mostrando clases y estudiantes de otros docentes | `[CAPTURA 17-B]` Misma pestaña mostrando el estado vacío correcto |

---

### ISS-18. El porcentaje de asistencia por clase puede superar el 100 por ciento

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Reportes de asistencia |
| **Archivo** | `lib/reports.ts`, líneas 94 a 112 |
| **Estado** | Pendiente |

**Descripción del problema**

El cálculo del porcentaje por clase mezcla dos unidades distintas:

```ts
const classAtt = attendances.filter(a => a.scheduleId === s.id);   // registros de TODAS las fechas
const present = classAtt.filter(a => a.status === 'presente').length;
const presentStudents = new Set(classAtt.filter(a => a.status === 'presente').map(a => a.studentId));
const absent = Math.max(0, enrolled.length - presentStudents.size);
...
attendanceRate: rate(present, enrolled.length),   // registros acumulados sobre inscritos de una sesión
```

`present` cuenta registros de asistencia acumulados a lo largo de todas las sesiones impartidas, mientras que `expected` es el número de estudiantes inscritos, es decir, el aforo de una sola sesión. La consulta que alimenta el cálculo (`Attendance.find({ scheduleId: { $in: ids } })`) no aplica ningún filtro por fecha.

Con cuatro estudiantes inscritos y tres sesiones impartidas con asistencia completa, el reporte muestra `Presentes: 12`, `Inscritos: 4` y un porcentaje de asistencia del **300 por ciento**. Además, `present` y `absent` no suman `expected`, porque `absent` se calcula sobre estudiantes distintos y `present` sobre registros.

El bloque `byStudent` sí normaliza correctamente (`rate(present, present + absent)`), de modo que la incoherencia entre ambas tablas del mismo reporte es evidente a simple vista.

**Corrección propuesta**

Normalizar por número de sesiones registradas:

```ts
const sessions = new Set(classAtt.map(a => a.date)).size || 1;
const present = classAtt.filter(a => a.status === 'presente').length;
const expectedTotal = enrolled.length * sessions;
const absent = Math.max(0, expectedTotal - present);
return { ..., expected: expectedTotal, present, absent, attendanceRate: rate(present, expectedTotal) };
```

Como alternativa, si el reporte debe representar una única sesión, aplicar un filtro por fecha en la consulta de asistencias y documentarlo en la cabecera del reporte.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 18-A]` Tabla de reportes mostrando un porcentaje de asistencia superior al 100 por ciento | `[CAPTURA 18-B]` Misma tabla con porcentajes normalizados y coherentes con la tabla por estudiante |

---

### ISS-19. Finalizar la clase dos veces duplica los registros de ausencia

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Asistencia |
| **Archivos** | `lib/handlers.ts`, líneas 473 a 502; `lib/models.ts`, líneas 461 a 477; `scripts/ensure-indexes.ts` |
| **Estado** | Pendiente |

**Descripción del problema**

Al finalizar una clase se marcan como ausentes los estudiantes inscritos que no registraron asistencia. El filtro considera únicamente a los que ya figuran como presentes:

```ts
const present = await Attendance.find({ scheduleId, date: today, status: 'presente' });
const presentIds = new Set(present.map(a => a.studentId));
const absentees = enrolled.filter(e => existingStudentIds.has(e.studentId) && !presentIds.has(e.studentId));
...
const docs = absentees.map(e => ({ id: `att-${uuidv4().slice(0, 8)}`, ... , status: 'ausente' }));
await Attendance.insertMany(docs);
```

Los estudiantes ya marcados como ausentes no se excluyen, y el identificador de cada documento es un UUID aleatorio, de modo que nada impide insertarlos otra vez. La colección `Attendance` tampoco tiene un índice único sobre `{ studentId, scheduleId, date }`, ni en el esquema de `lib/models.ts` ni en `scripts/ensure-indexes.ts`, que solo declara índices no únicos.

La secuencia Finalizar, Iniciar, Finalizar, que es trivial de reproducir desde la interfaz, genera dos registros de ausencia para cada estudiante en la misma fecha. Los reportes de asistencia los cuentan por separado, lo que agrava el problema descrito en ISS-18.

Existe además un caso mixto: si el docente finaliza la clase antes de tiempo y un estudiante llega después, el registro de presencia se crea mediante `findOneAndUpdate` sobre un par duplicado, actualiza uno de los dos documentos y el otro permanece como ausente. El mismo estudiante aparece simultáneamente presente y ausente en la misma sesión.

**Corrección propuesta**

1. Añadir el índice único que falta, en el esquema y en el script de índices:

```ts
AttendanceSchema.index({ studentId: 1, scheduleId: 1, date: 1 }, { unique: true });
```

2. Usar en `markAbsentees` el mismo identificador determinista que ya emplea la ruta de presencia (`attendanceRecordId(studentId, scheduleId, date)`) y sustituir `insertMany` por `bulkWrite` con operaciones `updateOne` en modo `upsert` y `$setOnInsert`, de modo que la operación sea idempotente.
3. Excluir del cálculo a los estudiantes que ya tengan cualquier registro para esa fecha, no solo a los presentes.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 19-A]` Vista de Asistencia con el mismo estudiante repetido como ausente tras finalizar la clase dos veces | `[CAPTURA 19-B]` Misma vista con un único registro por estudiante y fecha |

---

### ISS-20. El límite de intentos de login es compartido por todos los clientes

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Autenticación y limitación de peticiones |
| **Archivos** | `app/api/auth/login/route.ts`, `app/api/auth/refresh/route.ts`, `lib/distributed-rate-limit.ts` |
| **Estado** | Pendiente |

**Descripción del problema**

Es la misma causa raíz descrita en ISS-12, pero aplicada al primer paso de la demostración, donde el impacto es mayor. Ambas rutas limitan por dirección de cliente con el cupo `RATE_LIMITS.login`, que vale 5 peticiones por minuto:

```ts
if (!await checkDistributedRateLimit(`login:${ip}`, RATE_LIMITS.login)) { ... 429 ... }
if (!await checkDistributedRateLimit(`refresh:${ip}`, RATE_LIMITS.login)) { ... 429 ... }
```

Cuando no existe un proxy inverso que aporte las cabeceras `x-forwarded-for` o `x-real-ip`, `getClientAddress` devuelve la cadena literal `unknown` y todos los clientes comparten la misma clave. Cinco intentos de login por minuto para el conjunto de la sala se agotan con facilidad: basta con equivocarse un par de veces en la contraseña, o con que varias personas prueben la aplicación a la vez, para que el sistema responda "Demasiados intentos. Espera un minuto." a todo el mundo, incluido quien presenta.

El cupo de `refresh` es el mismo y comparte cubo con el de login por tratarse de claves distintas pero de idéntico tamaño, de modo que la renovación automática de sesión de varias pestañas abiertas también consume presupuesto.

**Corrección propuesta**

1. Incluir el correo normalizado en la clave del limitador de login, de forma que el cupo se aplique por cuenta y no por sala: `login:${ip}:${email.toLowerCase()}`.
2. Elevar `RATE_LIMIT_LOGIN` a 10 y documentar el valor en `.env.example`.
3. Registrar en el log cada respuesta 429 junto con la clave afectada, para poder distinguir un límite alcanzado de un fallo de credenciales.
4. Configurar un proxy inverso que aporte `x-forwarded-for` en el entorno donde se realice la demostración.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 20-A]` Login mostrando "Demasiados intentos. Espera un minuto." en un equipo que no había intentado acceder | `[CAPTURA 20-B]` Login funcionando con el cupo aplicado por cuenta |

---

### ISS-21. El runtime de MediaPipe no está versionado y puede faltar en producción

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Despliegue y detección automática de rostro en el kiosco |
| **Archivos** | `.gitignore`, `package.json` (scripts `predev` y `prebuild`), `next.config.ts`, `scripts/copy-mediapipe-wasm.mjs` |
| **Estado** | Pendiente |

**Descripción del problema**

El detector de rostros del kiosco carga su runtime WebAssembly desde el propio dominio, decisión correcta para no depender de un CDN externo. Sin embargo esos binarios pesan cerca de 22 MB y no se versionan:

```
# .gitignore
# Runtime wasm de MediaPipe, se regenera con scripts/copy-mediapipe-wasm.mjs
public/mediapipe/
```

Se regeneran mediante los ganchos `predev` y `prebuild` de `package.json`. Esto funciona siempre que el despliegue ejecute la construcción con un gestor de paquetes que respete los ganchos del ciclo de vida. Pero `next.config.ts` declara `output: 'standalone'`, modo en el que la salida generada **no incluye el directorio `public/`**: debe copiarse de forma explícita en la imagen o en el servidor de destino. Si esa copia se omite, los cuatro archivos wasm faltan en producción.

El fallo es silencioso. `FilesetResolver` no consigue cargar el runtime, el estado del encuadre pasa a `unsupported` y el disparo automático deja de producirse. El kiosco no muestra ningún error: solo el mensaje "Detección automática no disponible. Pulsa Iniciar verificación" en la franja inferior del vídeo.

El impacto real es limitado, porque el botón manual "Iniciar verificación" se muestra siempre en los estados de reposo y encuadre, de modo que el flujo sigue siendo completable. Pero quien presenta pierde la parte más vistosa de la demostración, el arranque automático al detectar el rostro, y puede quedarse esperando frente a la cámara sin entender por qué no ocurre nada.

**Corrección propuesta**

1. Documentar en `docs/deployment.md` la copia obligatoria de `public/` cuando se despliega con `output: 'standalone'`, e incluirla en el `Dockerfile` o en el script de despliegue.
2. Añadir la verificación del runtime a la pantalla de diagnóstico existente en `/diagnostico`, comprobando que `/mediapipe/wasm/vision_wasm_internal.wasm` responde 200.
3. Elevar la visibilidad del estado `unsupported` en el kiosco, con un distintivo de estado equivalente a los de cámara, conexión e iluminación, en lugar de un texto en la franja inferior.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 21-A]` Kiosco con el mensaje "Detección automática no disponible" y error 404 del archivo wasm en la pestaña Red | `[CAPTURA 21-B]` Kiosco con el disparo automático operativo y el archivo wasm respondiendo 200 |

---

### ISS-22. Al abrir `/docente` en una pestaña nueva tras 15 minutos se pierde la sesión

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Protección de rutas y sesión del panel |
| **Archivos** | `proxy.ts`, líneas 62 a 87; `lib/auth.ts`, líneas 11 a 12 y 84 a 86 |
| **Estado** | Pendiente |

**Descripción del problema**

El middleware de rutas resuelve la sesión leyendo la cookie de acceso:

```ts
const token = req.cookies.get('token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '') || '';
const payload = token ? await verifyJwt(token) : null;
if (STAFF_PATHS.some(...) && !isLogged) return NextResponse.redirect(new URL('/login', req.url));
```

Esa cookie se emite con la vida del access token, 15 minutos por defecto (`JWT_EXPIRES_IN`). El middleware no contempla el refresh token, que tiene 7 días de validez, de modo que una vez caducada la cookie de acceso la navegación a `/docente` se redirige al login aunque la sesión siga siendo perfectamente renovable.

Mientras el panel permanece abierto el problema no aparece, porque el sondeo de alertas cada 30 segundos acaba disparando la renovación y reemitiendo la cookie. Se manifiesta en el escenario contrario, que es habitual en una presentación: el presentador pasa quince minutos o más en la pestaña del kiosco explicando el flujo biométrico y después abre el panel del docente en una pestaña nueva. En ese momento es expulsado al login y debe volver a autenticarse delante del tribunal.

**Corrección propuesta**

Permitir que el middleware acepte una sesión renovable en lugar de exigir un access token vigente:

1. Si la cookie de acceso ha caducado pero existe la cookie de refresco, redirigir a una ruta interna de renovación que rote la sesión y devuelva al destino original, en lugar de enviar al login.
2. Como alternativa más simple, alinear la vida de la cookie de acceso con la del refresh token y mantener la validación estricta del JWT en cada llamada de API, que es donde ya se hace correctamente.
3. Añadir una renovación proactiva en el cliente, disparada dos minutos antes de la expiración del access token, para que la cookie no llegue a caducar mientras haya una pestaña abierta.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 22-A]` Redirección a `/login` al abrir `/docente` en una pestaña nueva pasados 15 minutos | `[CAPTURA 22-B]` Panel del docente abriéndose con normalidad en el mismo escenario |

---

## 5 bis. Issues detectados durante la implementación

Estos dos no proceden de las revisiones previas, sino del trabajo de corrección de los issues anteriores. Se documentan aquí para no perderlos y quedan fuera del alcance de las fases ya planificadas.

### ISS-23. `/diagnostico` declara protección de rol pero el `matcher` no lo cubre

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Protección de rutas |
| **Archivo** | `proxy.ts`, líneas 18 y 88 |
| **Estado** | Pendiente |
| **Detectado en** | Planificación de la corrección de ISS-22 |

**Descripción del problema**

El middleware declara dos rutas de personal:

```ts
const STAFF_PATHS = ['/docente', '/diagnostico'];
```

Pero su configuración solo se aplica a tres patrones:

```ts
export const config = { matcher: ['/docente/:path*', '/docente', '/login'] };
```

`/diagnostico` no figura en el `matcher`, de modo que el middleware nunca se ejecuta para esa ruta y la comprobación de rol que declara `STAFF_PATHS` es letra muerta. Un usuario anónimo o con rol estudiante puede abrir la pantalla de diagnóstico directamente por URL.

El impacto real depende de qué exponga esa pantalla. La autorización de las APIs que consulte sigue verificándose en el backend por RBAC, de modo que no es una fuga de datos automática, pero sí contradice la protección que el propio archivo declara, y ISS-21 propone ampliar esa pantalla con el estado de la infraestructura.

**Corrección propuesta**

Añadir `'/diagnostico'` y `'/diagnostico/:path*'` al `matcher`. Conviene además añadir una prueba que verifique que cada ruta de `STAFF_PATHS` está cubierta por el `matcher`, para que la divergencia no pueda repetirse.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 23-A]` Pantalla `/diagnostico` abierta sin sesión, sin redirección al login | `[CAPTURA 23-B]` Redirección a `/login` en el mismo escenario |

---

### ISS-24. Contraseñas de siembra en el código y endpoint sin autenticación en desarrollo

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Módulo** | Inicialización de datos |
| **Archivos** | `app/api/db/init/route.ts`, líneas 11 a 12 y 23 a 26; `scripts/seed.ts` |
| **Estado** | Pendiente |
| **Detectado en** | Verificación de ISS-13 |

**Descripción del problema**

El endpoint de inicialización siembra las dos cuentas de personal con contraseñas escritas directamente en el código:

```ts
const docenteHash = await hashPassword('docente123');
const adminHash = await hashPassword('admin123');
```

Esto **no invalida ISS-13**: es un route handler, código de servidor, que no entra en el paquete que recibe el navegador. La búsqueda de esas cadenas sobre `.next/static` tras la corrección de ISS-13 devuelve cero coincidencias.

El problema es otro y tiene dos caras.

La primera afecta a la rotación de contraseñas que ISS-13 dejó como acción de operación. Rotar las contraseñas en la base de datos no basta mientras `admin123` siga escrito aquí y en `scripts/seed.ts`: cualquier sembrado posterior sobre una base vacía las reintroduce, y la rotación se deshace sola.

La segunda es una exposición real. La autenticación se omite por completo en desarrollo:

```ts
if (process.env.NODE_ENV !== 'development') {
  requireAdmin(req);
}
```

Con `next dev` en una red institucional y una base sin usuarios, cualquiera que alcance el servidor puede sembrar una cuenta de administrador con una contraseña conocida y entrar con ella. Agrava el caso que el endpoint responda también a `GET`: no hace falta enviar un POST ni resolver CSRF, basta con navegar a `/api/db/init` desde el navegador.

La protección que sí existe es que `seedDatabase` sale antes si ya hay usuarios (`if (userCount > 0) return`), de modo que no puede sobrescribir cuentas existentes ni escalar privilegios en una instalación ya poblada.

**Corrección propuesta**

1. Leer las contraseñas de siembra de variables de entorno (`SEED_ADMIN_PASSWORD`, `SEED_DOCENTE_PASSWORD`), sin valor por defecto, y fallar de forma explícita si no están definidas. Aplicarlo también en `scripts/seed.ts` para que la rotación no se deshaga en el siguiente sembrado.
2. Exigir `requireAdmin` también en desarrollo, o condicionar la excepción a una variable explícita como `ALLOW_UNAUTHENTICATED_SEED=true` que nunca se defina fuera de un equipo local.
3. Retirar el método `GET`, que no muta nada por definición y aquí siembra la base. Dejar solo `POST` con CSRF.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 24-A]` Respuesta `ok: true, Database seeded` al navegar a `/api/db/init` sin sesión con `next dev` | `[CAPTURA 24-B]` Respuesta 401 en el mismo escenario |

---

### ISS-25. Las URLs firmadas del panel viven una hora y funcionan sin autenticación

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media (privacidad) |
| **Módulo** | Fotografías de estudiantes y evidencias |
| **Archivos** | `app/api/photos/[key]/route.ts`, línea 26; `lib/handlers.ts`, línea 1481 |
| **Estado** | Pendiente |
| **Detectado en** | Revisión de ISS-15 |

**Descripción del problema**

El proxy de fotografías acuña la URL firmada con una hora de validez:

```ts
const url = await getPresignedUrl(key, 3600);
```

Una URL firmada de S3 es portable por definición: quien la tenga accede al objeto sin presentar ninguna credencial, porque la firma va en la propia dirección. Basta con usar "Copiar dirección de la imagen" en el navegador y pegarla en cualquier sitio. Durante esa hora, la barrera de `canReadPhoto` queda fuera del camino, porque ya no se vuelve a pasar por la aplicación.

Para fotografías biométricas de estudiantes identificados, bajo el modelo de consentimiento que documenta `docs/PRIVACIDAD.md`, una hora es un margen amplio. La comparación interna lo hace evidente: el kiosco firma sus URLs con 120 segundos (`PHOTO_URL_TTL_SECONDS` en `lib/kiosk-verification.ts`), treinta veces menos, para un uso equivalente.

**No es una regresión de ISS-15.** La línea es anterior, del commit `d6594dc`. Pero hasta la corrección de ISS-15 ese código nunca llegaba a ejecutarse, porque la petición del navegador moría antes en el 401. La corrección lo puso en el camino real, y con ello activó una debilidad que estaba dormida.

**Existe un segundo punto con el mismo valor**, que conviene corregir a la vez: `handleGetEvidencePhoto` (`lib/handlers.ts`, línea 1481) firma con 3600 las fotos de evidencia de accesos denegados, que son igual de sensibles o más.

**Corrección propuesta**

1. Bajar ambos TTL al orden de 120 a 300 segundos.
2. Unificarlos con la constante que ya usa el kiosco, de modo que exista un único valor para "cuánto vive una URL de foto" y no tres literales repartidos. El sitio natural es `lib/s3.ts`, junto a `getPresignedUrl`, cuyo valor por defecto ya es 300.
3. Revisar si el valor por defecto de `getPresignedUrl` debería ser el único, eliminando el argumento explícito en las tres llamadas.

| Estado inicial | Resultado obtenido |
|----------------|--------------------|
| `[CAPTURA 25-A]` URL de imagen copiada del panel, abierta en una ventana privada sin sesión, sirviendo la foto pasados varios minutos | `[CAPTURA 25-B]` La misma URL devolviendo `AccessDenied` de S3 tras expirar el plazo corto |

---

## 6. Guía para la captura de evidencias

Para que las capturas demuestren de forma verificable el cambio de comportamiento, se recomienda seguir este procedimiento por cada issue.

**Estado inicial**

1. Situar el repositorio en el commit anterior a la corrección. Para ISS-01 y ISS-02: `git checkout 835b279`. Para ISS-03: `git checkout 5a0203f`.
2. Reproducir el escenario descrito en el issue.
3. Capturar la pantalla completa, incluyendo la barra de direcciones y, cuando el error sea de red o de servidor, la pestaña Consola o Red de las herramientas de desarrollo con el código de estado visible.

**Resultado obtenido**

4. Volver al commit corregido: `git checkout main`.
5. Repetir exactamente los mismos pasos con los mismos datos de entrada.
6. Capturar de nuevo la pantalla completa.

**Recomendaciones**

- Mantener el mismo tema (claro u oscuro), la misma resolución y el mismo usuario en ambas capturas, para que la comparación sea directa.
- Nombrar los archivos siguiendo el patrón `ISS-01-antes.png` e `ISS-01-despues.png`.
- Recuadrar en rojo el elemento relevante: el mensaje de error, la etiqueta de estado de la clase o el código de respuesta HTTP.
- Para los issues de backend (ISS-05, ISS-09, ISS-10, ISS-11, ISS-12, ISS-17, ISS-18, ISS-19, ISS-20), acompañar la captura de la interfaz con la salida de consola del servidor correspondiente al mismo instante.
- Para los issues que se demuestran en el navegador (ISS-13, ISS-15, ISS-21), la evidencia debe incluir la pestaña Red o Fuentes de las herramientas de desarrollo, con el código de estado o la cadena buscada visibles.

---

## 7. Conclusiones

El bloqueo de la presentación tuvo una causa concreta y localizada: una regla de negocio que exigía que la hora real coincidiera con la franja horaria de la clase para poder iniciar la sesión. Al ser el estado `en_curso` la única puerta de entrada al reconocimiento facial, un rechazo en ese punto detuvo el recorrido completo del MVP.

Las dos revisiones posteriores mostraron que el problema de fondo no era esa validación aislada. Se identificaron tres patrones que se repiten a lo largo del código y que explican la mayoría de los 22 issues.

**Patrón 1: acumulación de precondiciones implícitas sobre el camino crítico.** Para que el kiosco autorice un acceso deben cumplirse a la vez el día de la semana correcto, la franja horaria vigente, el estado de clase en curso, el rol adecuado, la inscripción activa, la biometría registrada, el consentimiento vigente, el cupo de peticiones disponible y la resolución DNS operativa. Cualquiera que falle produce el mismo efecto visible: el flujo se detiene. Corresponden a este patrón ISS-01, ISS-04, ISS-05, ISS-10, ISS-12 y ISS-20.

**Patrón 2: el caso vacío o degradado se confunde con el caso normal.** Una lista vacía de clases se interpreta como "todas las clases" (ISS-17), un fallo de prueba de vida sigue el mismo camino que un éxito (ISS-06), un código MFA incorrecto devuelve la misma respuesta que la ausencia de código (ISS-16), y un 401 de credenciales se trata como una sesión caducada (ISS-02, ya corregido). En todos los casos el sistema no distingue entre "no hay dato" y "el dato es inválido".

**Patrón 3: el contrato entre cliente y servidor no se verifica de extremo a extremo.** El navegador pide fotografías por una vía que nunca puede autenticarse (ISS-15), la región de AWS se declara dos veces con fuentes distintas (ISS-08), se reporta un campo de Rekognition por otro (ISS-09) y el cálculo del porcentaje de asistencia mezcla dos unidades de medida (ISS-18). Son errores que ninguna prueba unitaria del módulo aislado detecta, porque cada pieza es correcta por separado.

Líneas de trabajo derivadas, en orden de prioridad:

1. **Cerrar los issues bloqueantes pendientes** (ISS-04 y ISS-05) antes de la siguiente demostración, ya que reproducen el mismo síntoma que ISS-01 por otras vías.
2. **Retirar las credenciales del paquete del cliente** (ISS-13). Es el hallazgo de menor coste de corrección y mayor coste reputacional si un evaluador lo encuentra por su cuenta.
3. **Corregir ISS-15 y ISS-09**, los dos issues con mayor impacto visual: la fotografía del estudiante reconocido y el porcentaje de coincidencia son precisamente los dos elementos que concentran la atención en la pantalla de acceso concedido.
4. **Corregir ISS-17**, por tratarse de una fuga de información entre docentes que contradice la regla de aislamiento aplicada correctamente en el resto del sistema.
5. **Añadir un modo demostración** que relaje las precondiciones temporales (día y franja horaria) y deje activas únicamente las de seguridad (prueba de vida, similitud, consentimiento e inscripción).
6. **Ampliar la pantalla de diagnóstico** de `/diagnostico` para que verifique en un solo lugar la conexión a base de datos, la resolución DNS, la disponibilidad de credenciales AWS, la presencia del runtime de MediaPipe, la existencia de una clase en curso y el estado de la cámara. Cualquier precondición incumplida debe ser visible antes de empezar, y no en mitad del flujo.
7. **Mejorar la trazabilidad del rechazo** en el kiosco, mostrando siempre el motivo específico en lugar de un mensaje genérico (ISS-06, ISS-16).

---

## 8. Referencias

| Elemento | Ubicación |
|----------|-----------|
| Corrección de ISS-01 y ISS-02 | Commit `79776f4`, 6 de agosto de 2026 |
| Corrección de ISS-03 | Commit `835b279`, 6 de agosto de 2026 |
| Regla de autorización del kiosco | `lib/scheduling.ts`, función `canAccessLab` |
| Estados de sesión de clase | `docs/EVOLUCION-ACADEMICA.md`, sección "Estado de sesión de clase" |
| Flujo biométrico | `docs/biometric-flow.md` |
| Plan de contingencia | `docs/CONTINGENCIA.md` |
