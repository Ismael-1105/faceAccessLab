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
- Despliegue en Vercel (frontend estático).

## Capabilities and Constraints

- **Rol kiosco (estudiante):** Pantalla única con feed de cámara, pipeline de escaneo facial (detección, prueba de vida, comparación biométrica, verificación de permisos), resultado concedido/denegado.
- **Rol docente (portal):** Dashboard con métricas (registrados, accesos hoy, denegados hoy, alertas activas), gráficos semanales, tabla de alumnos con toggle de acceso individual, historial de accesos con exportación CSV, centro de alertas, calibración de sensor, consola de servicios AWS.
- **Autenticación:** Simulada con usuarios mock (`docente@faceaccess.lab`, `admin@faceaccess.lab`, etc.).
- **Tema claro/oscuro:** Soportado con persistencia en localStorage y respeto de preferencia del sistema.
- **Permiso de cámara:** Gate de permiso antes de activar el kiosco.
- **Enrollamiento de estudiantes:** Vista de registro con captura de foto.
- **Reportes:** Vista de reportes exportables.
- Toda la aplicación es 100% client-side con datos mock (`src/data.ts`). No hay backend real.
- No integra la API de Gemini en tiempo real (dependencia declarada pero no conectada).
- Las imágenes de estudiantes se cargan desde `public/images/`.
- Los nombres de dominio de ejemplo (`universidad.edu`) deberán reemplazarse con la marca UIDE.

## Brand Commitments

- Nombre: **FaceAccess Lab**.
- Debe incorporar la identidad de la **Universidad Internacional del Ecuador (UIDE)**.
- Voz: profesional, tecnológica, institucional. Español.
- Sin claims, testimonios, precios ni referencias a otras universidades inventadas.

## Evidence on Hand

- Mock data completa: 5 estudiantes, 4 logs de acceso, 8 alertas, 9 servicios cloud, 6 usuarios de autenticación.
- Documentación de pantallas en `docs/inventario-pantallas.md`.
- Guía de CI/CD en `docs/documentacion-cicd.md`.

## Product Principles

1. **Demo-ready first.** Cada flujo debe sentirse completo y pulido desde el primer uso, sin depender de configuración externa.
2. **Claridad de rol.** La diferencia entre experiencia kiosco (estudiante) y portal (docente) debe ser inmediatamente evidente.
3. **Mostrar la arquitectura.** La vista de servicios AWS no es decorativa — es parte central de la propuesta de valor del proyecto.
4. **Extensible por diseño.** El sistema de datos mock debe permitir reemplazar fuentes de datos reales sin reescribir componentes.
5. **Identidad universitaria.** Toda la superficie visual debe reflejar la marca UIDE.

## Accessibility & Inclusion

No se establecieron requisitos específicos de accesibilidad. Pendiente de definir.
