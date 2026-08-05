# Módulos de dominio (Fase 5)

Estructura objetivo de capas para que las rutas API sean **delgadas**:

```
src/
├── modules/            ← lógica de negocio por dominio
│   ├── auth/           ← (implementado) service + repository + types
│   ├── students/       ← pendiente de extraer de lib/handlers.ts
│   ├── access/         ← pendiente (canAccessLab, kiosk-verification)
│   ├── biometrics/     ← pendiente (consent, umbrales)
│   ├── incidents/      ← pendiente (evidence, incidentes)
│   └── reports/        ← pendiente (agregaciones)
├── infrastructure/     ← AWS, MongoDB, logging (hoy en lib/)
│   ├── aws/            ← lib/s3.ts, lib/rekognition.ts, lib/sns.ts, lib/cloudwatch.ts
│   ├── mongodb/        ← lib/models.ts, lib/db.ts
│   └── logging/        ← lib/audit.ts, lib/cloudwatch.ts
├── shared/             ← http.ts (sendJson/sendError)
└── ...
```

## Ruta delgada (referencia: `/api/auth/login`)

```ts
export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json());   // validación
  if (!parsed.success) return sendJson({ error: 'Datos inválidos' }, 400);
  const result = await authService.login(req, parsed.data); // negocio
  return sendJson(result.body, result.status, { cookies: result.cookies }); // formato
}
```

La ruta **no** autoriza (lo hace `lib/rbac`), **no** toca AWS/persistencia
(lo hace el repository), **no** audita ni dispara alertas (lo hace el service).

## Regla de oro

Una ruta debe hacer UNA cosa por capa:

| Preocupación | Capa |
|---|---|
| Autorización (RBAC) | `lib/rbac.ts` (requireTeacher/requireAdmin) |
| Validación (Zod) | `lib/validation.ts` + schemas del módulo |
| Persistencia | repository del módulo (hoy `lib/models.ts`) |
| AWS | `lib/s3.ts`, `lib/rekognition.ts`, `lib/sns.ts` |
| Auditoría | `lib/audit.ts` (invocado desde el service) |
| Alertas | `lib/evidence.ts` / `lib/alerts.ts` (service) |
| Formato de respuesta | `src/shared/http.ts` |

## Estado actual y migración

- **Implementado:** `src/modules/auth` + rutas delgadas de auth
  (`/api/auth/login|logout|refresh|register`) + `src/shared/http.ts`.
- **Pendiente:** extraer students/access/biometrics/incidents/reports desde
  `lib/handlers.ts` y `lib/scheduling.ts` siguiendo el patrón de `auth`.
  El mapeo de archivos actuales → módulos está en
  `docs/hci/architecture-layers.md`.

El código legado en `lib/` se conserva como "infraestructura" mientras la
migración avanza módulo a módulo, sin reescrituras masivas.
