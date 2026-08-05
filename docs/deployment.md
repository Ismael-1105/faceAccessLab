# Despliegue y CI/CD — FaceAccess Lab

Cómo se ejecuta el pipeline de integración continua y cómo desplegar el sistema en Vercel.

## Requisitos de entorno

- Node.js ≥ 20 (CI usa 22).
- pnpm 10 (`packageManager` declarado en `package.json`).
- MongoDB Atlas accesible desde el entorno de despliegue (red/IAM permitidas).
- Cuenta AWS con Rekognition, S3, SNS, CloudWatch y STS (claves IAM de permisos mínimos).

## Integración continua — `.github/workflows/ci.yml`

El pipeline se ejecuta en `push` y `pull_request` hacia `main`:

1. **Checkout** (`actions/checkout@v4`).
2. **Setup pnpm** (`pnpm/action-setup@v4`): usa la versión de `packageManager`.
3. **Setup Node.js** (`node-version: 22`, cache pnpm).
4. **Install** — `pnpm install --frozen-lockfile`.
5. **Typecheck** — `pnpm typecheck`.
6. **Lint** — `pnpm lint`.
7. **Test** — `pnpm test`.
8. **Build** — `pnpm build` (previa copia del WASM de MediaPipe).
9. **Verify output** — comprueba que `.next/` (standalone) se generó.

> No se hace despliegue automático desde el pipeline; el despliegue se gestiona en Vercel. Si en el futuro se agrega un despliegue real, el workflow deberá pasar a `deploy.yml`.

## Despliegue en Vercel

El proyecto está configurado para Vercel (`vercel.json` con `framework: "nextjs"`).

1. Importa el repositorio en Vercel.
2. Framework preset: **Next.js** (detectado por `vercel.json`).
3. Build command: `pnpm build` · Output: automático (Next.js standalone).
4. Define las variables de entorno (ver `docs/environment-variables.md`).
5. Deploy.

### `next.config.ts`

```ts
output: 'standalone'   // build autocontenido, listo para contenedores/serverless
```

## Runtime WASM de MediaPipe

El build copia los archivos WASM a `public/mediapipe/` automáticamente (`scripts/copy-mediapipe-wasm.mjs`, disparado por `prebuild`/`predev`). Esos archivos están en `.gitignore` y se regeneran en cada build, así que no hay que commitearlos.

## Tareas manuales (una vez por ambiente)

```bash
pnpm seed          # datos de prueba (admin/docente/estudiantes/labs)
pnpm run ensure-indexes   # scripts/ensure-indexes.ts — índices de MongoDB (TLL, compuestos)
```

> `scripts/` incluye también `backfill-rekognition.ts`, `seed-real.ts`, `verify-real.ts` y `test-db.ts` para verificar la configuración AWS/MongoDB.

## Checklist de producción

- [ ] `JWT_SECRET` fuerte definido (obligatorio).
- [ ] Credenciales IAM mínimas (S3, Rekognition, SNS, CloudWatch, STS).
- [ ] Bucket S3 **privado** (se sirve por presigned URLs).
- [ ] Tópico SNS configurado y suscrito.
- [ ] `INCIDENT_*` y `RATE_LIMIT_*` ajustados.
- [ ] Índices creados (`ensure-indexes`).
- [ ] Variables en Vercel, sin secretos `NEXT_PUBLIC_`.

Ver también: `docs/environment-variables.md`, `docs/testing.md`.
