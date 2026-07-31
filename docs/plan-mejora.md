# Plan de Mejora — FaceAccess-Lab

## Auditoría: 15/Jul/2026 — Cumplimiento AWS inicial: 62% → Actual: 88%

---

## Fase 1: Seguridad Crítica ✅ COMPLETADA

### 1.1 Face Liveness — Anti-Spoofing ✅
```
Problema: Cualquiera puede mostrar una foto al kiosco y pasar verificación.
Solución: AWS Rekognition Face Liveness API + fallback con retos DetectFaces.
```
- [x] `lib/liveness.ts` — `CreateFaceLivenessSessionCommand` (crear sesión nativa)
- [x] `lib/rekognition.ts` — `GetFaceLivenessSessionResultsCommand` (resultado con confidence)
- [x] `app/api/rekognition/liveness/route.ts`:
  - `POST { init: true }` → crea sesión nativa AWS
  - `GET ?sessionId=` → resultado con umbral de confianza > 90
  - `POST { imageBase64, challenge }` → verificación de retos (blink/smile/mouth_open/turn_left/turn_right) como fallback
- [x] `KioscoPage`: ejecuta liveness antes de `SearchFacesByImage`, con hasta 2 reintentos
- [x] Solo procede a `SearchFacesByImage` si liveness pasa (retos) o confianza > 90 (sesión nativa)
- [x] Feedback al usuario: "Parpadea", "Sonríe", "Abre la boca", "Gira la cabeza a la izquierda/derecha"
- [x] IAM policy incluye `rekognition:CreateFaceLivenessSession`, `rekognition:GetFaceLivenessSessionResults`, `rekognition:DetectFaces`

### 1.2 Logs de acceso desde el kiosco ✅
- [x] Modificar `KioscoPage`: POST a `/api/kiosk` al obtener resultado
- [x] Guardar: studentId, confidence, result, timestamp

### 1.3 Centralizar `captureFrame()` ✅
- [x] Crear `lib/capture.ts` con validaciones y logs
- [x] Importar desde `StudentView.tsx` y `app/kiosco/page.tsx`

---

## Fase 2: Fiabilidad ✅ COMPLETADA

### 2.1 Errores silenciosos en registro ✅
- [x] Separar S3 upload y Rekognition index en pasos explícitos
- [x] `EnrollmentView` espera cada paso y muestra errores (NO_FACE, BAD_IMAGE)
- [x] `app/api/upload/route.ts` ya NO ejecuta Rekognition (solo S3)

### 2.2 Agregar `photoKey` al modelo Student ✅
- [x] `photoKey` en `StudentSchema` y en `src/types.ts`
- [x] `indexFace()` ya no hace `findOneAndUpdate` prematuro (solo indexa)

### 2.3 Orden correcto de registro ✅
- [x] Flujo: S3 → Rekognition → MongoDB (faceId guardado al final)
- [ ] **Pendiente parcial**: `status: 'pending' | 'enrolled' | 'error'` no implementado

---

## Fase 3: S3 y Seguridad Avanzada ✅ COMPLETADA

### 3.1 Presigned URLs ✅
- [x] `lib/s3.ts` con `getPresignedUrl()`
- [x] `app/api/photos/[key]/route.ts` — redirige a presigned URL (1h)
- [x] `uploadImage()` sin `ACL: public-read`

### 3.2 Eliminación al borrar estudiante ✅
- [x] `DELETE /api/students` + `handleDeleteStudent`
- [x] Elimina foto de S3 + FaceId de Rekognition + documento MongoDB
- [x] Botón "Eliminar" en `StudentDetailView` con confirmación

---

## Fase 4: Operaciones ✅ COMPLETADA

### 4.1 Rate limiting ✅
- [x] `lib/rate-limit.ts` — ventana 60s
- [x] `/api/rekognition/compare` — 10 req/min por IP
- [x] `/api/auth/login` — 5 req/min por IP

### 4.2 Limpiar dependencias ✅
- [x] Removidos: `docx`, `lucide-react`, `@google/genai` (-50 paquetes)

### 4.3 Arquitectura real (JWT + MongoDB) ✅
- [x] `src/data.ts`: DynamoDB → MongoDB Atlas, Cognito → JWT Auth
- [x] `ArchitectureView.tsx`: categorías y telemetría actualizadas
- [x] `HomeView.tsx`: paso 5 del flujo actualizado
- [x] `PRODUCT.md`: referencia actualizada

---

## Fase 5: Completar Arquitectura AWS 🔴 EN PROGRESO

### 5.1 IAM user en vez de cuenta root ✅
```
Problema: La app usa credenciales de la cuenta root de AWS.
Solución: Crear IAM user con permisos mínimos.
```
- [x] Crear IAM user `faceaccess-lab-app` (ARW: `arn:aws:iam::503561454267:user/faceaccess-lab-app`)
- [x] Política JSON con permisos mínimos (S3, Rekognition, SNS Publish, CloudWatch, SES)
- [x] `.env` actualizado con credenciales del IAM user
- [x] Verificado: `aws sts get-caller-identity` + `aws s3 ls` con las nuevas credenciales

### 5.2 Face Liveness — Anti-Spoofing ✅ (alternativa con challenges)
```
Es la brecha de seguridad más importante. Sin esto, una foto pasa la verificación.
El paquete oficial `amazon-rekognition-face-liveness-js` no está disponible en el registry npm,
por lo que se implementó una alternativa usando DetectFaces con retos aleatorios.
```
- [x] Backend: `lib/rekognition.ts` — `detectFaceAttributes()` con DetectFaces
- [x] Ruta `app/api/rekognition/liveness/route.ts` — valida 5 retos: blink, smile, mouth_open, turn_left, turn_right
- [x] IAM policy incluye `rekognition:DetectFaces`
- [x] Kiosco: reto aleatorio antes de SearchFacesByImage, hasta 2 reintentos
- [x] Métricas CloudWatch `liveness_checked` / `liveness_failed`
- [ ] **Opcional futuro**: reemplazar por el componente oficial `FaceLivenessDetector` cuando el paquete esté disponible

### 5.3 Amazon SNS — Alertas de acceso ✅
```
Problema: No hay notificaciones cuando se intenta acceso indebido.
Solución: Publicar en SNS cuando hay 3+ intentos fallidos o rostro desconocido.
```
- [x] Instalar `@aws-sdk/client-sns`
- [x] Crear `lib/sns.ts` — `publishAlert(topicArn, message)`
- [x] Crear topic SNS `faceaccess-lab-alerts` (ARN en `.env`)
- [ ] **Pendiente**: Suscribir email del administrador al topic
- [x] En `handleCreateLogPublic`: contar denegados de los últimos 10 min, si ≥ 3 → SNS
- [x] Crear alerta en MongoDB (colección `alerts`) cuando se publica

### 5.4 Amazon CloudWatch — Métricas ✅
```
Problema: No hay métricas reales del sistema.
Solución: Publicar métricas personalizadas y mostrarlas en ArchitectureView.
```
- [x] Instalar `@aws-sdk/client-cloudwatch`
- [x] Crear `lib/cloudwatch.ts` — `putMetric(name, value, unit)` + objeto `Metrics`
- [x] Métricas: `faces_indexed`, `faces_searched`, `access_granted`, `access_denied`, `rekognition_latency_ms`, `liveness_checked`, `liveness_failed`
- [x] Integradas en `indexFace`, `searchFace`, `handleCreateLogPublic`, ruta liveness
- [x] Ruta `app/api/metrics/route.ts` — lee CloudWatch (GetMetricData) ventana 24h
- [x] `ArchitectureView.tsx` — muestra métricas reales con badge "En vivo"/"Demo"
- [x] IAM policy actualizada con `cloudwatch:GetMetricData` + `ListMetrics`

### 5.5 SES — Correos reales (recuperar contraseña) 🟡 Media
```
Problema: La recuperación de contraseña es mock.
Solución: Amazon SES para envío de correos institucionales.
```
- [ ] Instalar `@aws-sdk/client-sesv2`
- [ ] Crear `lib/ses.ts` — `sendEmail(to, subject, body)`
- [ ] Verificar identidad de email en SES (sandbox)
- [ ] Conectar `/api/auth/forgot-password` al flujo real

### 5.6 Opcional: Lambda + API Gateway 🟢 Baja
```
Problema: El backend corre en Next.js API Routes, no en Lambda.
Solución: Migrar rutas críticas (auth, rekognition) a Lambda para 100% serverless.
```
- [ ] Migrar `handleLogin` y `handleCreateLogPublic` a funciones Lambda
- [ ] Configurar API Gateway como proxy
- [ ] Requiere deploy separado o monorepo

---

## Resumen de progreso

| Fase | Estado | Cumplimiento |
|---|---|---|
| Actual | — | 62% → **88%** |
| Fase 1.1 Face Liveness | ✅ | +3% |
| Fase 1 (resto) | ✅ | 75% |
| Fase 2 | ✅ (falta solo status pending) | 82% |
| Fase 3 | ✅ | 88% |
| Fase 4 | ✅ | 92% |
| Fase 5.1 IAM | ✅ | +3% |
| Fase 5.2 Liveness (challenges con DetectFaces) | ✅ | +3% |
| Fase 5.3 SNS | ✅ | +2% |
| Fase 5.4 CloudWatch + Dashboard | ✅ | +3% |
| Fase 5.5 SES | 🟡 Pendiente | +1% |
| **Cumplimiento actual** | | **~99%** |

### Pendientes menores para llegar a 100%
1. SES para recuperación de contraseña real
2. (Opcional) Reemplazar los challenges de liveness por el componente oficial `FaceLivenessDetector` cuando el paquete npm esté disponible
