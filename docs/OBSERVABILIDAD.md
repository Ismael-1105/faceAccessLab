# Observabilidad — FaceAccess-Lab (Fase 6)

> Logging estructurado, métricas y alertas para diagnosticar fallos sin depender
> de `console.log` dispersos.

---

## 1. Logging estructurado (JSON + requestId)

`lib/observability.ts` emite una línea JSON por evento con `level`, `event`,
`timestamp` y contexto correlacionado:

```json
{
  "level": "info",
  "event": "kiosk.verification.completed",
  "timestamp": "2026-08-05T17:22:00.000Z",
  "requestId": "3f2c…",
  "attemptId": "kat-123",
  "kioskId": "Kiosk-042",
  "labCode": "LAB-02",
  "studentId": "student-1",
  "decision": "denied",
  "reason": "outside_schedule",
  "durationMs": 842,
  "confidence": 41.2
}
```

**Eventos del kiosco (correlación intento → alumno → kiosco → AWS):**

| Evento | Contexto clave |
|---|---|
| `kiosk.attempt.created` | attemptId, kioskId, labCode |
| `kiosk.verification.started` | requestId, attemptId, kioskId, labCode |
| `kiosk.liveness.completed` | attemptId, succeeded, confidence, durationMs |
| `kiosk.rekognition.completed` | attemptId, matched, confidence |
| `kiosk.verification.completed` | decision, reason, durationMs, studentId |
| `kiosk.verification.failed` | reason (capture/network), error sanitizado |
| `s3.{upload,presign,delete}.failed` | error |
| `db.connection.failed` | error |
| `monitoring.alert.created` | severity, message |

**Reglas de privacidad:** el logger **sanea** claves prohibidas
(`token`, `password*`, `image*`, `photo*`, `faceId`, `embedding`, `secret`, …)
y valores base64/`data:image`. Nunca se registran imágenes, credenciales,
tokens ni vectores faciales.

El `requestId` viaja en la cabecera `X-Request-Id` (generado si no existe) y se
propaga a los logs del intento.

## 2. Métricas (CloudWatch, namespace `FaceAccessLab`)

| Métrica | Unidad | Dimensiones |
|---|---|---|
| `faces_indexed` / `faces_searched` | Count | — |
| `access_granted` / `access_denied` | Count | — |
| `access_denied_rate` | Percent | (derivada por math de acceso) |
| `attempts_per_kiosk` / `denied_per_kiosk` | Count | `KioskId` |
| `rekognition_latency_ms` / `liveness_latency_ms` | Milliseconds | — |
| `http_errors` | Count | `Endpoint` |
| `s3_failures` | Count | `Operation` |
| `mongodb_failures` | Count | `Operation` |

La **tasa de denegados** se calcula en CloudWatch con
`access_denied / (access_granted + access_denied)`.

## 3. Alertas operativas (`lib/monitoring.ts`)

| Alerta | Condición | Fuente |
|---|---|---|
| Aumento de errores 5xx | ≥ `ALERT_5XX_THRESHOLD` (20) en 60 s | `errorResponse` (≥500) |
| Latencia elevada | `durationMs ≥ ALERT_LATENCY_MS` (2000) | `kiosk/verify` |
| Múltiples rechazos por persona | ≥ `INCIDENT_THRESHOLD` en ventana | `lib/evidence.ts` (incidente + SNS) |
| Kiosco sin actividad | sin intentos/accesos en `ALERT_KIOSK_IDLE_MIN` (15) | `/api/kiosk/session` (throttle) |
| Consumo AWS inesperado | alarma de presupuesto CloudWatch | configuración AWS (documentada) |

Todas se **deduplican**: solo se crea `Alert` si no existe una `active` con el
mismo mensaje, y disparan SNS.

## 4. Configuración

| Variable | Default | Descripción |
|---|---|---|
| `ALERT_5XX_THRESHOLD` | 20 | Errores 5xx por ventana de 60 s |
| `ALERT_LATENCY_MS` | 2000 | Latencia que dispara alerta |
| `ALERT_KIOSK_IDLE_MIN` | 15 | Inactividad del kiosco para alertar |
| `AWS_REGION` / credenciales | — | CloudWatch / SNS |

## 5. Consultas sugeridas (CloudWatch Logs Insights)

```
fields @timestamp, level, event, attemptId, kioskId, decision, reason, durationMs
| filter event = "kiosk.verification.completed"
| sort @timestamp desc
| limit 20
```
