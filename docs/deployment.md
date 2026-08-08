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

### Copia obligatoria de `public/` con `output: 'standalone'` (ISS-21)

**La salida de `standalone` no incluye el directorio `public/`.** Generarlo en el build no basta: hay que copiarlo de forma explícita a la imagen o al servidor de destino, junto a `.next/static`.

```dockerfile
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
```

Si esa última línea falta, los cuatro archivos WASM (unos 22 MB) no llegan a producción y **el fallo es silencioso**: `FilesetResolver` no consigue cargar el runtime, el estado del encuadre pasa a `unsupported` y el disparo automático al detectar el rostro deja de producirse. El kiosco no muestra ningún error, solo el aviso "Detección automática no disponible. Pulsa Iniciar verificación" en la franja inferior del vídeo.

El flujo sigue siendo completable con el botón manual, así que el impacto funcional es limitado, pero se pierde la parte más vistosa de la demostración y quien presenta puede quedarse esperando frente a la cámara sin entender por qué no ocurre nada.

**Comprobación antes de presentar.** La pantalla `/diagnostico` incluye la fila "Runtime MediaPipe", que hace una petición `HEAD` a `/mediapipe/wasm/vision_wasm_internal.wasm`. Si aparece "Ausente: sin disparo automático", el directorio `public/` no se copió. También se puede comprobar a mano:

```bash
curl -I https://<host>/mediapipe/wasm/vision_wasm_internal.wasm   # debe dar 200
```

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
