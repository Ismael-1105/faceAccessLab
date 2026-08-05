# Seguridad — FaceAccess Lab

Controles de seguridad implementados, modelo de amenazas y recomendaciones para producción.

## Controles implementados

### Autenticación y autorización
- **JWT** con expiración de 24 h; `JWT_SECRET` **obligatorio en producción** (`lib/auth.ts`).
- **bcrypt** (coste 12) para hashing de contraseñas.
- **RBAC centralizado** (`lib/rbac.ts`): toda API pasa por `requireAuth`/`requireRole`/`requireAdmin`/`requireTeacher`/`requireStudent` o por los checks de propiedad (`canManageSchedule`, `canManageStudent`, `canViewEvidence`, `canCloseIncident`).
- **Cuentas suspendidas/inactivas** bloqueadas en login (403).
- **Middleware de rutas** (`proxy.ts`): `/docente` exige sesión admin/docente; el backend revalida siempre.

### Anti-abuso
- **Rate limiting por IP** (`lib/rate-limit.ts`): login, comparación, STS y registro (configurable por entorno).
- **Rate limiting distribuido** (`lib/distributed-rate-limit.ts`): ventana compartida en MongoDB para entornos multi-instancia.
- **Límites de payload** (`lib/request-body.ts`): `readLimitedJson` impide que un cliente agote memoria (content-length + lectura en streaming con límite de bytes).

### Flujo biométrico (kiosco)
- **Face Liveness** anti-suplantación (foto/video).
- **El navegador nunca decide la identidad**: el match se hace con la imagen de referencia de AWS en el servidor.
- **Intento de un solo uso** con token hash-eado y expiración (~3 min).
- **Idempotencia** en `AccessLog`/`Attendance`/evidencia para evitar duplicados ante reintentos.
- **Límites de imagen**: formato permitido (`jpeg/png/webp`) y ≤ 2 MB (`lib/kiosk-verification.ts`).
- Rutas legadas de creación de accesos/evidencia devuelven **410**.

### Datos
- **S3 privado**: fotos y evidencias se sirven con **presigned URLs** con expiración (`lib/photo-access.ts`).
- **Reducción de PII** en el kiosco: las respuestas solo exponen campos necesarios para el match (`lib/handlers.ts`).
- **Endpoints de diagnóstico protegidos**: `/api/db/init` solo admin, `/api/db/status` autenticado, `/api/metrics` docente/admin.
- **TTL en colecciones de auditoría** (logs 90 días, auditoría 365 días).

## Modelo de amenazas

| Amenaza | Mitigación |
|---|---|
| Spoofing (foto/video del estudiante) | AWS Face Liveness + imagen de referencia server-side. |
| Identidad falsa desde el navegador | El cliente nunca elige la imagen de identidad; token de intento de un solo uso. |
| Fuerza bruta de login | Rate limiting por IP + bcrypt. |
| Fuga de datos entre docentes | RBAC de propiedad (cada docente solo ve sus clases/alumnos). |
| Acceso a rutas de administración | `requireAdmin` + proxy de rutas. |
| Exfiltración de fotos | Bucket privado + presigned URLs. |
| Abuso de payload (memoria/DoS) | Límites de tamaño en body e imágenes. |
| Reintentos duplicando registros | IDs deterministas e idempotencia en escrituras. |

## Recomendaciones para producción

1. **Migrar el token a cookie HttpOnly** (o endurecer CSP y sanear XSS). Hoy el JWT también viaja en `localStorage`/header, lo que lo expone a XSS (`docs/authentication.md`).
2. **Revisar la política IAM** de la clave maestra: mínimo `rekognition:CreateFaceLivenessSession` para STS, y solo S3/Rekognition/SNS/CloudWatch para el resto.
3. **Habilitar HTTPS** en Vercel (por defecto) y forzar redirección.
4. **Secretos nunca en `NEXT_PUBLIC_*`** — el navegador solo recibe datos efímeros.
5. **Ajustar límites** de rate limiting e incidentes según el ambiente.
6. **Auditoría de accesos a datos biométricos** y revisión periódica de logs de CloudWatch.
7. Cumplir normativa local de datos personales (ver `docs/privacy.md`).

Ver también: `docs/authentication.md`, `docs/biometric-flow.md`, `docs/environment-variables.md`.
