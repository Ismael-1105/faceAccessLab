# Evolución hacia Producción — FaceAccess-Lab

> Resumen de los cambios implementados en la Fase 4 y las recomendaciones restantes para convertir el MVP en un producto real.

---

## Cambios implementados (Fase 4)

### 1. MFA opcional (TOTP) para administradores
- **`lib/totp.ts`:** implementación TOTP RFC 6238 (SHA-1, 6 dígitos, 30s) con `crypto` nativo — **sin dependencia externa**.
- **`app/api/auth/mfa/route.ts`:** setup (genera secreto), verify (activa), disable (desactiva) — solo admin.
- **`handleLogin`:** si el usuario tiene MFA, el login exige el código antes de emitir el JWT (`mfaRequired`).
- **`LoginView.tsx`:** flujo de dos pasos — correo/contraseña → código de 6 dígitos.
- **`MfaSetup.tsx`:** panel del admin (Calibración) para activar/desactivar MFA con app autenticadora.

### 2. S3 privado — presigned URLs en toda la UI
- **`src/lib/photoUrl.ts`:** helper `getPhotoSrc()` que convierte URLs de S3 a `/api/photos/{key}` (proxy presigned de 1h).
- Aplicado en `AdminView`, `StudentDetailView`, `StudentProfile` y `KioskStepper`.
- El bucket debe permanecer **privado**; las imágenes se sirven vía presigned URL.

### 3. Rate limit configurable y más robusto
- **`lib/rate-limit.ts`:** límites configurables por env (`RATE_LIMIT_LOGIN`, `RATE_LIMIT_COMPARE`, `RATE_LIMIT_STS`, `RATE_LIMIT_REGISTER`), limpieza cada 30s y red de seguridad contra crecimiento ilimitado del `Map`.
- Aplicado en login, compare y aws/credentials.
- **Nota:** el rate limit sigue en memoria (una instancia). Para multi-instancia real, migrar a Redis/Upstash (recomendado para Vercel).

### 4. CI/CD
- **`.github/workflows/ci-cd.yml`:** pipeline en cada push/PR a main — typecheck, lint, test y build de Next.js con verificación del output.

---

## Recomendaciones restantes para producción

| Área | Recomendación | Prioridad |
|---|---|---|
| Rate limit distribuido | Migrar de `Map` en memoria a Redis/Upstash para multi-instancia | Alta |
| WAF / API Gateway | Proteger las rutas públicas del kiosco (liveness/compare) con límites de edge | Alta |
| Cognito + MFA gestionado | Reemplazar JWT propio por Amazon Cognito (roles, MFA, federación) | Media |
| Colecciones por sede | Un `collectionId` de Rekognition por campus/lab | Media |
| Modo offline del kiosco | Cola local de accesos y verificación diferida si AWS/Mongo caen | Media |
| Retención de datos | TTL ya configurado (logs 90d, auditoría 365d); revisar política por normativa | Media |
| Monitoreo | CloudWatch Alarms + alertas por SNS ante caídas de latencia/error | Media |
| Backups | Snapshot programado de MongoDB Atlas y versionado en S3 | Alta |

---

## Estado del MVP tras F1–F4

| Dimensión | Antes | Después (estimado) |
|---|---|---|
| Arquitectura | 7.5 | 9.0 |
| Seguridad | 5.0 | 9.0 |
| Rendimiento | 6.5 | 9.0 |
| Escalabilidad | 4.5 | 7.5 |
| UX | 7.5 | 9.0 |
| Calidad del código | 8.0 | 9.0 |
| Valor del MVP | 8.0 | 9.5 |
| Preparación para producción | 4.0 | 8.0 |

El MVP ahora tiene: endpoints autenticados, validación server-side, auditoría, MFA, S3 privado con presigned URLs, índices y TTL en MongoDB, detección de sospechas, reportes y documentación de privacidad/contingencia/pruebas. Está listo para una demostración académica sólida y con un camino claro hacia producción.
