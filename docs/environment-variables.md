# Variables de Entorno — FaceAccess Lab

Todas las variables se definen en un archivo `.env` (no versionado). Copia `.env.example` como punto de partida.

```bash
cp .env.example .env
```

## Variables obligatorias

| Variable | Descripción | Ejemplo |
|---|---|---|
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas. | `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority` |
| `JWT_SECRET` | Secreto para firmar tokens. **Obligatoria en producción** (el arranque falla si falta con `NODE_ENV=production`). | `clave-secreta-jwt-cambiar-en-produccion` |
| `AWS_REGION` | Región de los servicios AWS. | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | Access key de un IAM user con permisos mínimos. | — |
| `AWS_SECRET_ACCESS_KEY` | Secret key del mismo IAM user. | — |
| `AWS_S3_BUCKET` | Bucket de fotos y evidencias (privado). | `faceaccess-lab-uploads` |
| `AWS_SNS_TOPIC_ARN` | Tópico SNS para alertas de incidentes. | `arn:aws:sns:us-east-1:<account>:faceaccess-lab-alerts` |

> **Importante:** no uses variables `NEXT_PUBLIC_*` para secretos. El navegador solo recibe datos efímeros (p. ej. `attemptId`).

## Identidad del kiosco

| Variable | Descripción | Default |
|---|---|---|
| `KIOSK_ID` | Identificador del terminal (server-side). | `Kiosk-042` |
| `KIOSK_LAB` | Código del laboratorio del terminal. | `LAB-02` |
| `NEXT_PUBLIC_KIOSK_LAB` | Código del lab disponible en el cliente (fallback de `KIOSK_LAB`). | `LAB-02` |

## Incidentes de seguridad

| Variable | Descripción | Default |
|---|---|---|
| `INCIDENT_WINDOW_MIN` | Ventana en minutos para contar denegados repetidos. | `15` |
| `INCIDENT_THRESHOLD` | Cantidad de denegados en la ventana para abrir un incidente. | `5` |

## Rate limiting (opcional)

| Variable | Descripción | Default |
|---|---|---|
| `RATE_LIMIT_LOGIN` | Intentos de login por IP por minuto. | `5` |
| `RATE_LIMIT_COMPARE` | Llamadas de comparación por minuto. | `10` |
| `RATE_LIMIT_STS` | Solicitudes de credenciales STS por minuto. | `6` |
| `RATE_LIMIT_REGISTER` | Registros de usuario por minuto. | `10` |

## Otros

| Variable | Descripción |
|---|---|
| `NODE_ENV` | `development` / `production`. Lo gestiona Next.js en builds; en local, `development`. |

## En Vercel

Define las variables en **Project → Settings → Environment Variables**. Las variables prefijadas con `NEXT_PUBLIC_` se exponen al navegador; las demás solo viven en el servidor.

Ver también: `docs/deployment.md`, `docs/security.md`.
