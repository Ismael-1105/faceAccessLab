# FaceAccess Lab

Sistema inteligente de control de acceso por reconocimiento facial para laboratorios universitarios.

El kiosco (pantalla de terminal) verifica el rostro del estudiante con **AWS Rekognition + Face Liveness** y decide si puede acceder al laboratorio según su matrícula y horario. El portal del docente permite gestionar alumnos, clases, laboratorios, historial de accesos, alertas, incidentes y auditoría.

## Roles

| Rol | Interfaz | Acceso |
|---|---|---|
| **Estudiante** | Kiosco (`/kiosco`) | Solo mira a la cámara. El sistema verifica identidad, prueba de vida y permisos. |
| **Docente** | Portal administrativo (`/docente`) | Dashboard, gestión de alumnos/clases/labs, historial, alertas, reportes y auditoría. |
| **Administrador** | Portal administrativo (`/docente`) | Igual que el docente, más gestión de usuarios y suspensión/reactivación. |

## Stack

- **Next.js 16** (App Router, API routes, output `standalone`) + **React 19**
- **TypeScript 5.8**
- **TailwindCSS 4** + **Motion** + **Phosphor Icons**
- **MongoDB Atlas** (Mongoose 9)
- **AWS**: Rekognition (comparación + Face Liveness), S3 (fotos/evidencias), SNS (alertas), CloudWatch (métricas), STS (credenciales temporales del kiosco)
- **Vitest** para pruebas

## Requisitos

- **Node.js ≥ 20** (recomendado 20+; CI usa 22)
- **pnpm 10** (ver `packageManager` en `package.json`)

## Instalación

```bash
git clone <url-del-repositorio>
cd faceaccess-lab
pnpm install
```

> El runtime WASM de MediaPipe se copia automáticamente a `public/mediapipe/` con `pnpm dev`/`pnpm build` (`scripts/copy-mediapipe-wasm.mjs`).

## Configuración de entorno

1. Copia la plantilla:

```bash
cp .env.example .env
```

2. Completa al menos:
   - `MONGODB_URI` — cadena de conexión de MongoDB Atlas.
   - `JWT_SECRET` — clave del token; **obligatoria en producción**.
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` — credenciales IAM mínimas.
   - `AWS_S3_BUCKET` / `AWS_SNS_TOPIC_ARN` — bucket de fotos y ARN del tópico de alertas.

3. (Opcional) Siembra datos de prueba:

```bash
pnpm seed
```

Consulta `docs/environment-variables.md` para la descripción completa de cada variable.

## Ejecutar

```bash
pnpm dev        # Servidor de desarrollo en http://localhost:3000
pnpm build      # Build de producción
pnpm start      # Servir el build de producción
```

Accesos:

- Kiosco: `http://localhost:3000/kiosco`
- Portal: `http://localhost:3000/login` → `/docente`

### Credenciales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Admin | `admin@faceaccess.lab` | definida en el seed |
| Docente | `docente@faceaccess.lab` | definida en el seed |

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo (puerto 3000) |
| `pnpm build` | Build de producción (prepara el runtime WASM) |
| `pnpm start` | Sirve el build |
| `pnpm lint` | ESLint sobre todo el proyecto |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (unit + integración) |
| `pnpm test:coverage` | Tests con cobertura |
| `pnpm seed` | Poblado de datos de prueba |

## Estructura del proyecto

```
app/
  api/                    # API routes (auth, kiosk, students, schedules, labs, logs, ...)
  kiosco/                 # Terminal de acceso (estudiante)
  login/, recuperar/      # Autenticación del portal
  docente/                # Portal administrativo (protegido por proxy.ts)
lib/                      # Lógica de servidor: auth, rbac, models, rekognition, s3, ...
src/
  components/             # Vistas y componentes React del portal
  context/                # Estado global (AppContext)
  hooks/                  # useKioskFlow, useCameraPermission, useFaceFraming
  lib/                    # kiosk-feedback, liveness-display-text, api client
proxy.ts                  # Middleware de protección de rutas
vitest.config.ts          # Configuración de pruebas
```

## Documentación

| Documento | Contenido |
|---|---|
| `docs/architecture.md` | Arquitectura general, modelos de datos y servicios |
| `docs/authentication.md` | Autenticación, JWT, RBAC y MFA |
| `docs/biometric-flow.md` | Pipeline de verificación facial del kiosco |
| `docs/environment-variables.md` | Variables de entorno |
| `docs/deployment.md` | Despliegue (Vercel) y CI/CD |
| `docs/testing.md` | Cómo correr y escribir pruebas |
| `docs/security.md` | Controles de seguridad y amenazas |
| `docs/privacy.md` | Política de privacidad y datos biométricos |

## Licencia

Proyecto académico (capstone). Sin licencia de uso comercial.
