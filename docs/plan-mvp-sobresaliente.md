# Plan de Mejora — FaceAccess-Lab → MVP Sobresaliente

> Plan derivado de la auditoría integral (arquitectura, seguridad, rendimiento, escalabilidad, UX, AWS, MongoDB).
> Alcance: proyecto universitario. **Sin reescribir el sistema ni cambiar el stack** (Next.js + MongoDB + Rekognition + S3 + SNS + CloudWatch + Face Liveness).
> Prioridad: mayor incremento de calidad con el menor esfuerzo.

---

## 1. Top 10 mejoras de mayor impacto

Ordenadas por **impacto técnico/presentación × esfuerzo**:

| # | Mejora | Impacto | Esfuerzo | Beneficio |
|---|--------|---------|----------|-----------|
| 1 | Autenticar endpoints críticos (`/api/upload`, `/api/rekognition/register`, `/api/aws/credentials`) | 🔴 Seguridad crítica | Bajo (~2-3h) | Cierra la fuga de credenciales STS y el abuso de AWS pagado |
| 2 | Detección de presencia real antes de liveness (DetectFaces previo) | 🔴 Costo + UX | Bajo (~1-2h) | Evita sesiones liveness falsas; el kiosco responde solo a rostros |
| 3 | Eliminar kiosco legacy (`StudentView.tsx` + challenges caseros) | 🟠 Mantenibilidad + Seguridad | Bajo (~1h) | Elimina ~500 líneas duplicadas y liveness engañable |
| 4 | Downsample de frames (640px + JPEG 0.7) en `captureFrame` | 🟠 Rendimiento | Bajo (~30min) | Reduce latencia 20-40% y costo de red |
| 5 | Índices MongoDB + TTL en logs | 🟠 Escalabilidad | Bajo (~1h) | Consultas rápidas con miles de registros |
| 6 | Validación server-side (zod) en creación de estudiantes/docentes/labs | 🟠 Seguridad + Integridad | Medio (~3-4h) | Datos consistentes; el frontend no es la única barrera |
| 7 | `docs/PRUEBAS.md` con evidencia funcional, de carga y de seguridad | 🟢 Presentación | Bajo (~2h) | El jurado ve evaluación sistemática (punto solicitado) |
| 8 | Dashboard del admin con datos del día + % éxito + tiempo promedio | 🟢 Presentación | Medio (~4h) | Impresiona; métricas reales (ya hay datos en CloudWatch) |
| 9 | Auditoría de acciones de admin (log de quién creó/borró) | 🟠 Compliance | Medio (~4h) | Trazabilidad valorada por el jurado |
| 10 | Reporte PDF de accesos (generado con datos reales) | 🟢 Valor agregado | Medio (~4h) | Diferenciador frente a otros capstones |

---

## 2. Mejoras rápidas (menos de 2 horas)

Cambios pequeños, alto retorno:

1. **Auth en `/api/upload` y `/api/rekognition/register`** — envolver con `requireAdmin` (o al menos `authenticate`). ~30min.
2. **Auth en `/api/aws/credentials`** — proteger con `authenticate`; para el kiosco usar un header compartido o endpoint firmado. ~30min.
3. **Detectar rostro antes de liveness** — en `useKioskFlow.detectPresence`, llamar `DetectFaces` (o `/api/rekognition/liveness` sin challenge) y solo disparar sesión si `faceDetected`. ~1h.
4. **Downsample en `captureFrame`** — cap a 640px de ancho, `quality: 0.7`. ~15min.
5. **Quitar `console.log` de debug** en `capture.ts`, `useKioskFlow.ts`, `rekognition.ts`. ~15min.
6. **Índices MongoDB** — script o bloque `init` para `students.id`, `access_logs.createdAt`, `alerts.status`, `labs.code`. ~30min.
7. **Eliminar `StudentView.tsx`** del árbol (ruta muerta) tras confirmar que `kiosk/` es el flujo real. ~30min.
8. **Reducir CORS a orígenes conocidos** (o documentar por qué `*` es aceptable en kiosco). ~20min.
9. **Crear `docs/PRUEBAS.md`** con el plan de evidencia y resultados esperados. ~1h.

---

## 3. Mejoras de 1 día

1. **Validación server-side con zod** en `handleCreateStudent`, `handleCreateUser`, `handleCreateLab`, `handleCreateLogPublic`. (~4h)
2. **Panel admin enriquecido** — sección "Hoy" con: registrados hoy, accesos del día, % éxito, intentos fallidos, laboratorios más usados, tiempo promedio (desde logs + métricas). (~6h)
3. **Pantalla de denegado con causas + siguiente paso** — ya portada al kiosco; extender a estados de error de red con reintento manual. (~3h)
4. **Estado de servicios AWS en el panel** — reutilizar `/api/metrics` y `/api/db/status` en una tarjeta "Salud del ecosistema". (~3h)
5. **TTL en `access_logs`** (archivo/eliminar > 90 días) mediante índice TTL de Mongo. (~1h)
6. **Plan de contingencia documentado** — `docs/CONTINGENCIA.md`: qué pasa si AWS/Mongo/Internet caen y respuesta del kiosco. (~1h)

---

## 4. Mejoras de una semana

1. **Reporte PDF de accesos** — exportar datos reales del historial a PDF (p.ej. con `jspdf` o render HTML→PDF) con KPIs del período. (~2 días)
2. **Auditoría de acciones de admin** — colección `audit_logs` + middleware que registre crear/editar/eliminar docentes, labs y alumnos. (~2 días)
3. **Detección de comportamiento sospechoso** — reglas simples en el backend: ≥5 fallos consecutivos → bloqueo temporal + alerta SNS + alerta en panel. (~1 día)
4. **Autenticación MFA opcional** (TOTP) para admin — `otplib` + seed por usuario. (~2 días)
5. **Rate limit distribuido** — migrar de `Map` en memoria a Redis/Upstash para soportar multi-instancia. (~1 día)
6. **Métricas del modelo biométrico** — calcular y mostrar en reportes: tasa de acierto, falsos positivos/negativos estimados, tiempo promedio por escaneo. (~1 día)

---

## 5. Roadmap en 4 fases

### Fase 1 — Imprescindible (antes de la presentación)
- [ ] Autenticar `/api/upload`, `/api/rekognition/register`, `/api/aws/credentials`.
- [ ] Detección de presencia real antes de liveness.
- [ ] Eliminar kiosco legacy (`StudentView.tsx`) y challenges caseros.
- [ ] Downsample de frames + limpieza de `console.log`.
- [ ] Índices MongoDB + validación server-side (zod).
- [ ] Crear `docs/PRUEBAS.md` con evidencia funcional/seguridad/carga.
- [ ] Confirmar IAM mínimo, bucket S3 y suscripción SNS funcionando.

### Fase 2 — Muy recomendada (aumenta la calidad)
- [ ] Panel admin enriquecido (métricas del día, % éxito, tiempo promedio, salud AWS).
- [ ] Estado de servicios en el dashboard (CloudWatch + DB status).
- [ ] Manejo de errores de red con reintento manual en el kiosco.
- [ ] Auditoría de acciones de admin (colección `audit_logs`).
- [ ] TTL/archivo de logs viejos.

### Fase 3 — Valor agregado (impresiona al jurado)
- [ ] Reporte PDF de accesos con KPIs.
- [ ] Detección de comportamiento sospechoso (bloqueo temporal + alerta SNS).
- [ ] Tendencias semanales en reportes (comparación vs semana anterior).
- [ ] MFA opcional para admin.
- [ ] Documento `docs/CONTINGENCIA.md` + `docs/PRIVACIDAD.md` (consentimiento y retención).

### Fase 4 — Producción (MVP → producto real)
- [ ] Rate limit distribuido (Redis/Upstash) + WAF.
- [ ] Cognito + MFA + roles avanzados.
- [ ] Colecciones Rekognition por sede + sharding MongoDB.
- [ ] S3 privado con presigned URLs exclusivas.
- [ ] Modo offline del kiosco con cola local.
- [ ] CI/CD con tests E2E y monitoreo (CloudWatch Alarms).
- [ ] Cumplimiento GDPR/legislación local de datos biométricos (consentimiento, retención, eliminación).

---

## 6. Análisis por área

### 6.1 MVP — qué quitar y qué agregar

**Eliminar (no aportan valor en demo):**
- Kiosco legacy `StudentView.tsx` (duplicado, liveness engañable).
- `ForgotPasswordView` con validación mock contra `MOCK_AUTH_USERS` (o conectar a BD real).
- Campos/lógica de la vista `config` que no impactan (sliders sin efecto real).
- `SplashScreen`/`Header` si siguen sin montarse (código muerto).

**Agregar (impresionan al jurado sin complejidad):**
- **Métricas del modelo** en el panel (tiempo promedio, % acierto, falsos positivos) — demuestra rigor.
- **Dashboard "Hoy"** con datos reales del día.
- **Reporte PDF** exportable.
- **Demostración de liveness** con feedback visible (parpadeo detectado en vivo).

### 6.2 Seguridad — mejoras de alto impacto / bajo esfuerzo

1. **Auth en endpoints de escritura de AWS** (upload, register, credentials) — la más crítica.
2. **Validación zod** en todas las entradas.
3. **Permisos IAM mínimos** — verificar que el IAM user solo tenga S3+Rekognition+SNS+CloudWatch+SES (ya iniciado en `plan-mejora.md`).
4. **Bucket S3 privado** + presigned URLs (ya implementado el helper; confirmar que el bucket no es público).
5. **`JWT_SECRET` sin fallback en código** — forzar error si falta env en producción.
6. **Auditoría de acciones** — registrar quién creó/eliminó.
7. **Consentimiento y política de privacidad** — aviso en el registro y en el kiosco; documento `docs/PRIVACIDAD.md` (punto solicitado).

### 6.3 Arquitectura — componentes grandes y estructura

- **Componentes a refactorizar** (sin cambiar funcionalidad):
  - `AdminView.tsx` (~700 líneas) → extraer: `OverviewView`, `StudentsView`, `LogsView`, `ConfigView`.
  - `EnrollmentView.tsx` (~620) → extraer sub-componentes de formulario (DatosPersonales, Permisos, Biometría).
  - `DemoView.tsx` (~570) → reutilizar el pipeline de `useKioskFlow` en lugar de duplicarlo.
- **Patrón a consolidar:** extraer el modal tabla+crear+editar de `UsersView`/`LabsView` a un componente `CrudView` reutilizable.
- **Conclusión:** la separación `app/api` + `lib` + `src/components` es sólida; solo hay que adelgazar los componentes grandes.

### 6.4 UX — kiosco como producto profesional

- **Tiempos de espera:** mostrar estado real ("Verificando liveness…") y estimación cuando sea larga.
- **Mensajes:** errores con acción ("Reintentar" en vez de "Reintentando…").
- **Indicadores visuales:** ya sólidos (stepper, countdown, máscara) — mantener y pulir microcopy.
- **Sonido:** opcional y con permiso (beep de éxito/fallo), no obligatorio.
- **Accesibilidad:** contraste de microcopy (labels 10px zinc-400 ≈ 2.4:1 → subir a zinc-500/600), `aria-live` en resultados (ya presente), foco visible.
- **Recuperación de errores:** botón de reintento manual + estado "sin conexión" claro en el kiosco.

### 6.5 Panel administrativo — información útil

Agregar una fila de KPIs del día (real desde logs):
- Estudiantes registrados hoy.
- Accesos del día (permitidos/denegados).
- % de éxito (permitidos / total).
- Intentos fallidos consecutivos.
- Laboratorios más utilizados (top por `lab` en logs).
- Tiempo promedio de reconocimiento (desde `rekognition_latency_ms` en CloudWatch).
- Estado de servicios AWS (CloudWatch + DB status) con semáforo.

### 6.6 Inteligencia (sin modelos complejos)

- **Horarios inusuales:** alertar si un acceso ocurre fuera del horario definido por lab (regla simple de backend).
- **Intentos consecutivos:** ≥5 fallos → bloqueo temporal + alerta SNS (ya hay lógica de ≥3 denegados; ampliar).
- **Estadísticas automáticas:** resumen semanal generado en `/api/reports`.
- **Reportes PDF:** exportar con KPIs y tendencia.
- **Tendencias semanales:** comparar accesos vs semana anterior en ReportsView.

### 6.7 Escalabilidad — preparación para miles de estudiantes

1. **Índices** en `access_logs.createdAt`, `access_logs.studentId`, `alerts.status`, `labs.code`.
2. **TTL en logs** para no acumular indefinidamente.
3. **Rate limit distribuido** (Redis/Upstash) en vez de `Map` en memoria.
4. **Paginación real en historial** (ya paginado 20; añadir número de página navegable).
5. **Colecciones por sede** (opcional: `lab`/`campus` en el modelo).
6. **`searchFace` con `MaxFaces` y umbral por estudiante** (ya presente) — documentar límites de la colección.

### 6.8 Calidad del código — solo mejoras útiles

1. **Refactorizar componentes grandes** (mayor beneficio técnico).
2. **Extraer patrón CRUD** compartido (UsersView/LabsView).
3. **Eliminar código duplicado** (DemoView/StudentView; useKioskFlow como fuente única).
4. **Validación con zod** en vez de regex manual esparcida.
5. **Mantener** lint/typecheck/tests verdes (ya cumplidos).

### 6.9 Costos AWS

- **Mayor costo:** Rekognition (IndexFaces ~$0.001/img, SearchFacesByImage ~$0.001/búsqueda, Face Liveness por sesión) y S3 (almacenamiento + solicitudes).
- **Reducir:** downsample de frames (menos bytes), detectar presencia antes de liveness (evita sesiones falsas), auth en upload/register (evita abuso), TTL en logs.
- **Configuración:** bucket privado, presigned URLs con expiración corta (ya 1h), suscripción SNS única.
- **Estimación demo:** < $10/mes con uso normal; el riesgo real es abuso de endpoints sin auth (eliminado en Fase 1).

### 6.10 Valor para la sustentación — preguntas del jurado y respuestas

**Preguntas difíciles probables:**

1. *"¿Cómo evitas que una foto o video engañe al sistema?"* → Respuesta: Face Liveness oficial de AWS (sesión + resultado) en el kiosco; se dispara solo tras detección de rostro; umbral de confianza configurable. Evidencia: `lib/liveness.ts`, `kiosk/page.tsx`.
2. *"¿Qué pasa si AWS o MongoDB caen?"* → Respuesta honesta: el MVP no tiene modo offline; el panel muestra banner "sin conexión". El plan de contingencia documenta la respuesta y es mejora de Fase 3. Reconocer el límite es mejor que ocultarlo.
3. *"¿Cuál es la tasa de falsos positivos/negativos?"* → Respuesta: Rekognition reporta confianza; calculamos % de acierto y tiempo promedio desde logs/CloudWatch (métricas a agregar). Presentar evidencia en `docs/PRUEBAS.md`.
4. *"¿Cómo proteges los datos biométricos?"* → Respuesta: bucket privado + presigned URLs, permisos IAM mínimos, consentimiento en el registro, política de retención/eliminación (documento `docs/PRIVACIDAD.md`).
5. *"¿Por qué Next.js en vez de Lambda para todo?"* → Respuesta: API Routes de Next simplifican el deploy y son suficientes para el MVP; migrar rutas críticas a Lambda+API Gateway es mejora de Fase 4.
6. *"¿Cómo escalaría a 10 000 estudiantes?"* → Respuesta: índices, rate limit distribuido, colecciones por sede, sharding — documentados como roadmap.

**Qué haría destacar el proyecto:**
- Evidencia de pruebas (funcional + carga + seguridad) en `docs/PRUEBAS.md`.
- Métricas del modelo biométrico (tiempo, % acierto) mostradas en el panel.
- Documento de privacidad y consentimiento.
- Panel "Hoy" con datos reales del día.

---

## 7. Los 4 puntos que la auditoría anterior no profundizó

### 7.1 Cumplimiento legal y privacidad de datos biométricos
- **Acción:** crear `docs/PRIVACIDAD.md` con: qué datos se recogen (imagen facial, embedding en Rekognition), base legal (consentimiento), retención (TTL/eliminación), derechos del titular.
- **UI:** aviso de consentimiento en el registro de estudiantes ("Al registrarte autorizas el uso de tu rostro para control de acceso") y referencia en el kiosco.
- **Backend:** función de eliminación completa ya existe (`handleDeleteStudent` borra S3 + Rekognition + Mongo); documentarla como "derecho al olvido".

### 7.2 Métricas del modelo biométrico
- **Acción:** en el panel de reportes, calcular desde logs reales:
  - Tasa de acierto (permitidos / total).
  - Tiempo promedio de reconocimiento (desde `rekognition_latency_ms`).
  - Intento fallido promedio por sesión.
  - Falsos positivos/negativos estimados (confianza < umbral pero concedido, etc.).
- **Evidencia:** `docs/PRUEBAS.md` con tabla de resultados de escaneos reales de demostración.

### 7.3 Plan de contingencia
- **Acción:** crear `docs/CONTINGENCIA.md` documentando:
  - Si AWS/Mongo caen: el kiosco muestra error claro, el panel muestra banner offline.
  - Decisión de diseño: sin modo offline en el MVP (documentar como limitación y mejora de Fase 4).
  - Procedimiento de recuperación (reintentar, verificar credenciales, estado de servicios en el dashboard).

### 7.4 Pruebas del MVP (evidencia sistemática)
- **Acción:** crear `docs/PRUEBAS.md` con:
  - **Pruebas funcionales:** checklist del flujo completo (registro → escaneo → acceso → log → alerta).
  - **Pruebas de carga básica:** N escaneos simulados y latencia (datos reales).
  - **Pruebas de seguridad:** intentar llamar a endpoints sin token (evidencia de 401/403), fuerza bruta de login (429), subida de archivo inválido.
  - **Resultados** con capturas y números.

---

## 8. Calificación esperada tras implementar el plan

| Dimensión | Actual | Tras F1 | Tras F1+F2 | Tras todo | Por qué |
|---|---|---|---|---|---|
| Arquitectura | 7.5 | 8.0 | 8.5 | 9.0 | Se elimina kiosco duplicado y se adelgazan componentes |
| Seguridad | 5.0 | 8.0 | 8.5 | 9.5 | Endpoints autenticados, validación, IAM mínimo, auditoría |
| Rendimiento | 6.5 | 8.0 | 8.5 | 9.0 | Frames reducidos, índices, menos llamadas AWS |
| Escalabilidad | 4.5 | 6.0 | 7.5 | 9.0 | Índices, TTL, rate limit distribuido, colecciones por sede |
| UX | 7.5 | 8.0 | 8.5 | 9.0 | Reintento manual, errores claros, kiosco pulido |
| Calidad del código | 8.0 | 8.5 | 9.0 | 9.5 | Componentes extraídos, patrón CRUD, zod, sin duplicación |
| Valor del MVP | 8.0 | 8.5 | 9.0 | 9.5 | Métricas, PDF, panel "Hoy", privacidad |
| Preparación para producción | 4.0 | 6.0 | 7.5 | 9.0 | Contingencia, MFA, WAF, modo offline |

**Nota:** la calificación es orientativa y asume implementación completa y verificación por pruebas. El mayor salto se logra con la Fase 1 (seguridad y flujo real), que cierra los riesgos críticos de la auditoría.

---

## 9. Resumen ejecutivo

FaceAccess-Lab ya es un MVP funcional y demostrable con integración real de AWS. Con **~2-3 días de trabajo enfocado** (Fase 1) se eliminan los riesgos críticos de seguridad y rendimiento, convirtiéndolo en un MVP **presentable sin reservas**. La Fase 2-3 (~1-2 semanas) añade el valor que lo distingue del resto (métricas, PDF, privacidad, pruebas documentadas). La Fase 4 lo encamina a producción.

**Regla de oro del plan:** prioridad a lo que **un jurado puede verificar** — seguridad demostrable, métricas reales, evidencia de pruebas y privacidad documentada.
