# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Administradores de laboratorio (docentes):** Supervisan y gestionan el acceso a laboratorios universitarios mediante un panel administrativo con métricas, control de alumnos e historial.
- **Estudiantes:** Usan el kiosco de reconocimiento facial para acceder al laboratorio. Su interacción se limita a mirar la cámara y recibir la decisión de acceso.
- **Audiencia de presentación:** El proyecto es un capstone académico; debe demostrar bien el flujo completo en una presentación.

## Product Purpose

Sistema inteligente de control de acceso por reconocimiento facial para laboratorios universitarios. Reemplaza tarjetas de acceso o llaves físicas con verificación biométrica en tiempo real usando visión computacional y servicios cloud serverless.

## Positioning

Control de acceso biométrico universitario que combina reconocimiento facial con una arquitectura cloud serverless (AWS Rekognition, Lambda, MongoDB Atlas) representada visualmente como consola de servicios. El valor diferencial está en la integración del pipeline de escaneo facial (detección → prueba de vida → comparación → permiso) con un dashboard administrativo completo, todo presentado como demo funcional de concepto.

## Operating Context

- Entorno universitario: laboratorios con estaciones kiosco equipadas con cámara.
- Portal administrativo accesible desde navegador web para docentes.
- Proyecto capstone orientado a presentación y demostración.
- Despliegue en Vercel (Next.js con output standalone).

## Capabilities and Constraints

- **Rol kiosco (estudiante):** Pantalla única con feed de cámara y encuadre facial en vivo (MediaPipe). Al mantener el encuadre se crea un intento efímero (`POST /api/kiosk/attempt`): el backend abre una sesión AWS Face Liveness (`CreateFaceLivenessSession`), guarda el intento en MongoDB y emite un token de intento en cookie HttpOnly (`faceaccess_kiosk_attempt`, SameSite=Strict, Path=/api, ~3 min). El navegador ejecuta el desafío de prueba de vida (`FaceLivenessDetectorCore` de Amplify) con credenciales STS temporales. Al terminar, `POST /api/kiosk/verify` resuelve el resultado de forma autoritativa en el servidor: `GetFaceLivenessSessionResults` (Status SUCCEEDED, confianza ≥ 75, imagen de referencia), identidad con `searchFace` sobre la imagen de referencia de AWS, permisos por horario (`canAccessLab`) y persistencia de `AccessLog`, asistencia idempotente y evidencia/incidentes de denegados. El navegador nunca decide: las rutas legadas de creación de accesos/evidencia devuelven 410.
- **Rol docente (portal):** Dashboard con métricas (registrados, accesos hoy, denegados hoy, alertas activas), gráficos semanales, tabla de alumnos con toggle de acceso individual, historial de accesos paginado con exportación CSV, centro de alertas con ciclo active→acknowledged→resolved, calibración de sensor, consola de servicios AWS, historial unificado (accesos + evidencias + incidentes) con filtros (tipo, resultado, fecha, laboratorio, kiosco, motivo) y búsqueda, y auditoría paginada (10 por página) con búsqueda server-side. Sidebar de navegación fijo.
- **Autenticación:** JWT con bcrypt; usuarios sembrados (`docente@faceaccess.lab`, `admin@faceaccess.lab`, etc.) para roles docente/estudiante.
- **Tema claro/oscuro:** Soportado con persistencia en localStorage y respeto de preferencia del sistema.
- **Permiso de cámara:** Gate de permiso antes de activar el kiosco.
- **Enrollamiento de estudiantes:** Vista de registro en página única con captura de foto, carrera (enum de 7 opciones UIDE) y permisos de laboratorio (LAB-02).
- **Reportes:** Vista de reportes exportables.
- **Backend real:** API routes de Next.js conectadas a MongoDB Atlas (Mongoose), AWS Rekognition (registro, comparación y Face Liveness por sesión + streaming), AWS S3 (fotos), AWS SNS (alertas push) y CloudWatch (métricas). Rate limiting distribuido compartido en MongoDB y límites de tamaño para imágenes/JSON.
- **Alertas:** Generadas en backend (accesos denegados repetidos → SNS + documento en MongoDB) y sincronizadas en el portal con polling cada 30s.
- **Prueba de vida en español:** La interfaz de `FaceLivenessDetectorCore` se traduce al español mediante la prop `displayText` (mecanismo oficial de `@aws-amplify/ui-react-liveness` 3.6.8), definida en `src/lib/liveness-display-text.ts`. La traducción no altera el veredicto, que sigue siendo autoritativo del backend.
- **Identidad de dispositivo (decisión):** El modelo `KioskDevice` y el provisionamiento con credencial de un solo uso se diseñaron e implementaron, y luego se revirtieron. El flujo actual identifica al kiosco con `KIOSK_ID`/`KIOSK_LAB` de entorno (modo simulación/navegador). Decisión de re-activación para producción aún no tomada.
- El reconocimiento facial y la prueba de vida se basan en **AWS Rekognition + Face Liveness**.
- `src/data.ts` conserva datos seed (estudiantes, logs, servicios cloud, usuarios) como estado inicial/fallback; la fuente de verdad es MongoDB.
- Las fotos de estudiantes nuevos se suben a S3; `public/images/` provee avatares y assets seed.
- Los nombres de dominio de ejemplo (`universidad.edu`) deberán reemplazarse con la marca UIDE.

## Brand Commitments

- Nombre: **FaceAccess Lab**.
- Debe incorporar la identidad de la **Universidad Internacional del Ecuador (UIDE)**.
- Voz: profesional, tecnológica, institucional. Español.
- Sin claims, testimonios, precios ni referencias a otras universidades inventadas.

## Evidence on Hand

- Data seed en `src/data.ts`: 5 estudiantes, 4 logs de acceso, 9 servicios cloud, 6 usuarios de autenticación.
- Backend funcional: API routes, MongoDB Atlas, AWS Rekognition/S3/SNS, CloudWatch, auth JWT.
- Favicon y logo circular en `app/icon.png` / `app/apple-icon.png`, desde `assets/favicon/logo.png`.
- Documentación de pantallas en `docs/inventario-pantallas.md`.
- Despliegue y CI/CD en `docs/deployment.md`; pruebas en `docs/testing.md`.

## Product Principles

1. **Demo-ready first.** Cada flujo debe sentirse completo y pulido desde el primer uso, sin depender de configuración externa.
2. **Claridad de rol.** La diferencia entre experiencia kiosco (estudiante) y portal (docente) debe ser inmediatamente evidente.
3. **Mostrar la arquitectura.** La vista de servicios AWS no es decorativa — es parte central de la propuesta de valor del proyecto.
4. **Extensible por diseño.** La capa de datos (seed en `src/data.ts` + API) permite intercambiar fuentes sin reescribir componentes.
5. **Identidad universitaria.** Toda la superficie visual debe reflejar la marca UIDE.

## Accessibility & Inclusion

No se establecieron requisitos específicos de accesibilidad. Pendiente de definir.
