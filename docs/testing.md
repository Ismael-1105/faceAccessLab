# Pruebas — FaceAccess Lab

Cómo ejecutar y escribir las pruebas del proyecto.

## Configuración

- Framework: **Vitest 3** (`vitest.config.ts`).
- Incluye archivos `src/**/*.test.ts` y `src/**/*.test.tsx`.
- Entorno: `node` (sin jsdom; los tests de UI usan renderizado ligero).
- Alias `@` → raíz del proyecto.

## Ejecutar

```bash
pnpm test             # una pasada
pnpm test:watch       # modo watch
pnpm test:coverage    # cobertura
pnpm vitest run src/archivo.test.ts -t "nombre del test"   # test específico
```

## Suites existentes

| Archivo | Cubre |
|---|---|
| `src/alerts.test.ts` | Ciclo de alertas (`active → acknowledged → resolved`). |
| `src/attendance-idempotency.test.ts` | IDs deterministas y deduplicación de asistencia. |
| `src/evidence-idempotency.test.ts` | Evidencia de denegados sin duplicados. |
| `src/distributed-rate-limit.test.ts` | Rate limiting distribuido en MongoDB. |
| `src/kiosk-attempt-auth.test.ts` | Token de intento del kiosco (hash, expiración). |
| `src/kiosk-attempt-cookie.test.ts` | Cookie del intento (`SameSite`, `Path`). |
| `src/request-body.test.ts` | Límites y parseo seguro del body (`readLimitedJson`). |
| `src/security-routes.test.ts` | Protección de rutas sensibles (401/403/410). |
| `src/lib/kiosk-feedback.test.ts` | Textos y feedback del encuadre del kiosco. |
| `src/__key_audit__.test.tsx` | Auditoría de `key` en listas React (harness de warnings). |

## Convenciones

- **Nombre de archivo:** `nombre.test.ts` o `nombre.test.tsx` junto al módulo probado.
- **Estilo:** `describe` + `it`/`test`, imports de `vitest` (`describe, expect, it, vi`).
- **No tocar servicios reales:** usa `vi.mock`/stubs para `fetch`, AWS y MongoDB en los tests de lógica.
- **Idempotencia y concurrencia:** prueba reintentos y colisiones (clave duplicada de Mongo) en los módulos de asistencia/evidencia.
- Los tests que importan componentes (`.tsx`) deben mantener el harness de warnings (ver `__key_audit__.test.tsx`).

## Verificación en CI

El pipeline `ci.yml` ejecuta `pnpm test` en cada push/PR hacia `main` (ver `docs/deployment.md`).

Ver también: `docs/architecture.md`, `docs/deployment.md`.
