# Flujo Biométrico — FaceAccess Lab

Pipeline de verificación facial del kiosco: detección → prueba de vida → comparación → permisos → registro.

## Vista general

```
1. El estudiante encuadra su rostro en la cámara (MediaPipe).
2. POST /api/kiosk/attempt  →  se crea un intento efímero + sesión AWS Face Liveness.
3. El navegador ejecuta el desafío de liveness con credenciales STS temporales.
4. POST /api/kiosk/verify   →  el servidor resuelve el resultado de forma autoritativa.
5. Se persisten AccessLog, asistencia (idempotente) y evidencia/incidentes.
```

## 1. Creación del intento — `POST /api/kiosk/attempt`

`lib/kiosk-verification.ts` → `createKioskAttempt()`:

- Lee `KIOSK_ID` / `KIOSK_LAB` de entorno (identidad del terminal).
- Crea una sesión **AWS Face Liveness** (`createLivenessSession`).
- Genera un **token de intento** (`kiosk-attempt-auth.ts`) y guarda el hash en MongoDB (`KioskAttempt`, estado `pending`, expiración ~3 min).
- Devuelve `attemptId` + `attemptToken` + `sessionId`.
- El `attemptToken` se guarda en cookie `faceaccess_kiosk_attempt` (SameSite=Strict, Path=/api).

## 2. Prueba de vida en el navegador

- El componente usa `FaceLivenessDetectorCore` de Amplify con credenciales **STS temporales** (`app/api/aws/credentials`).
- La interfaz se muestra en español vía `src/lib/liveness-display-text.ts`.
- El veredicto de liveness lo decide AWS; el navegador solo presenta el desafío.

## 3. Verificación — `POST /api/kiosk/verify`

`lib/kiosk-verification.ts` → `verifyKioskAttempt()`:

1. **Valida la credencial de intento** (token + no expirado).
2. Si el intento ya se completó, devuelve el resultado cacheado (idempotente).
3. Marca el intento como `processing`.
4. Obtiene el resultado de liveness: `GetFaceLivenessSessionResults`.
   - Requiere `SUCCEEDED`, confianza ≥ **75**, e imagen de referencia presente; si no → `liveness-failed`.
5. **Identidad** (`searchFace`): usa la **imagen de referencia producida por AWS** (nunca la captura del navegador).
   - Sin match → `no-match`; sin registro → `no-student-record`; confianza < umbral del estudiante → `low-confidence`.
6. **Permisos**: estudiante debe estar `status = allowed`; el lab debe estar `active`; y `canAccessLab()` (`lib/scheduling.ts`) valida matrícula + horario de la clase.
   - Motivos posibles: `not-enrolled`, `permissions`, `out-of-schedule`, `class-not-started`, `class-ended`, `class-cancelled`, `wrong-lab`, `virtual`, `no-biometric`.
7. **Persistencia**:
   - `AccessLog` idempotente por `attemptId` (primer resultado gana).
   - Si es acceso concedido → `Attendance` upsert determinista (`attendanceRecordId`); el primer ingreso del día fija la hora.
   - Si es denegado → evidencia en S3 (`denialEvidencePhotoKey`) + registro `DenialEvidence`; si supera el umbral de incidentes → crea `Incident` + `Alert` + notificación **SNS**.
8. Métricas en **CloudWatch** (`accessGranted`, `accessDenied`, `livenessChecked`, `livenessFailed`).
9. Guarda el resultado final en el intento (estado `granted`/`denied`) para respuestas idempotentes.

## Seguridad del flujo

- **El navegador nunca decide la identidad.** La imagen utilizada para el match es la imagen de referencia de la sesión de liveness, generada por AWS.
- **Intento de un solo uso**: el token de intento se hash-ea en BD y se valida en cada verify.
- **Idempotencia**: reintentos de `verify` devuelven el mismo resultado; `AccessLog`/`Attendance` no duplican.
- Las rutas legadas de creación de accesos/evidencia devuelven `410`.

## Fallos controlados

| Motivo | Cuándo |
|---|---|
| `capture-failed` | Imagen vacía, formato no permitido o mayor a 2 MB. |
| `network-error` | Error de red/decodificación inesperado durante la verificación. |
| `liveness-failed` | Liveness no `SUCCEEDED` o confianza < 75. |
| `no-match` / `low-confidence` | Sin identidad o similitud por debajo del umbral. |
| `permissions` / `out-of-schedule` | Estudiante suspendido, sin matrícula o fuera de horario. |

Ver también: `docs/architecture.md`, `docs/security.md`, `docs/privacy.md`.
