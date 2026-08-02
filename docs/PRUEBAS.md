# Evidencia de Pruebas — FaceAccess-Lab

> Documento de evidencia sistemática para la sustentación. Cubre pruebas funcionales, de carga básica y de seguridad.
> **Estado:** plantilla para completar con los resultados de la ejecución de demostración.

---

## 1. Pruebas funcionales (checklist del flujo completo)

Flujo evaluado: **Registro → Captura → S3 → Rekognition (index) → MongoDB → Escaneo → Liveness → Reconocimiento → Autorización → Log → CloudWatch → SNS**.

| # | Paso | Resultado esperado | Resultado | Evidencia |
|---|------|--------------------|-----------|-----------|
| F1 | Login docente (`docente@faceaccess.lab`) | Redirige a `/docente` | ⬜ | Captura de pantalla |
| F2 | Login admin (`admin@faceaccess.lab`) | Redirige a `/docente` con tabs Docentes/Laboratorios | ⬜ | Captura |
| F3 | Crear docente (panel admin) | Aparece en la tabla | ⬜ | Captura |
| F4 | Crear laboratorio (panel admin) | Aparece en la tabla con acceso activo | ⬜ | Captura |
| F5 | Matricular estudiante (webcam) | Foto en S3 + rostro indexado en Rekognition + documento en MongoDB | ⬜ | `students` doc + faceId |
| F6 | Escaneo en kiosco (estudiante) | Liveness pasa → match → cerradura desbloqueada | ⬜ | Captura de resultado |
| F7 | Escaneo con persona no registrada | Denegado con causas R01–R04 | ⬜ | Captura |
| F8 | Escaneo con estudiante suspendido | Denegado (R02) | ⬜ | Captura |
| F9 | Log de acceso creado | Aparece en Historial | ⬜ | Logs de la BD |
| F10 | Alerta SNS (≥3 denegados en 10 min) | Email/subscripción + alerta en panel | ⬜ | Topic SNS |
| F11 | Métrica CloudWatch | `access_granted`/`access_denied` incrementan | ⬜ | `/api/metrics` |
| F12 | Exportar CSV | Descarga el archivo | ⬜ | Archivo |

### Resultado: X / 12 pasos pasaron.

---

## 2. Pruebas de seguridad

| # | Prueba | Resultado esperado | Resultado | Evidencia |
|---|--------|--------------------|-----------|-----------|
| S1 | `GET /api/users` sin token | **401/403** | ⬜ | Comando curl |
| S2 | `GET /api/users` con token de docente | **403** (solo admin) | ⬜ | curl |
| S3 | `GET /api/users` con token de admin | **200** (lista docentes) | ⬜ | curl |
| S4 | `POST /api/upload` sin token | **401** | ⬜ | curl |
| S5 | `POST /api/rekognition/register` sin token | **401** | ⬜ | curl |
| S6 | `GET /api/aws/credentials` >6 veces en 1 min | **429** (rate limit) | ⬜ | curl |
| S7 | Login con contraseña incorrecta 5 veces | **429** después del 5º intento | ⬜ | curl |
| S8 | `POST /api/students` con cédula inválida | **400** (validación zod) | ⬜ | curl |
| S9 | `POST /api/labs` con código inválido | **400** | ⬜ | curl |
| S10 | Foto de estudiante en S3 | Bucket privado o presigned URL | ⬜ | URL/`curl -I` |

### Resultado: X / 10 pruebas pasaron.

---

## 3. Pruebas de carga básica

| # | Escenario | Métrica | Resultado |
|---|-----------|---------|-----------|
| C1 | 1 escaneo completo (liveness + compare) | Tiempo total | ⬜ |
| C2 | 10 escaneos consecutivos | Latencia promedio | ⬜ |
| C3 | 100 lecturas al historial paginado (20 por página) | Tiempo de respuesta | ⬜ |
| C4 | 10 solicitudes simultáneas a `/api/rekognition/compare` | 4ta+ devuelve 429 | ⬜ |
| C5 | Carga del panel con 500 logs | Tiempo de render | ⬜ |

### Resultados esperados (referencia):
- Liveness oficial: ~1–2 s por sesión.
- `SearchFacesByImage`: ~0.5–1 s.
- Escaneo completo: **3–4 s** (aceptable para MVP).

---

## 4. Comandos de verificación

```bash
# Calidad
pnpm typecheck          # 0 errores
pnpm lint               # 0 problemas
pnpm test               # 12/12 tests
pnpm build              # build correcto

# Seguridad (requiere dev server en :3000)
# login admin
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@faceaccess.lab","password":"admin123"}' | jq -r .token)

# endpoints protegidos sin token → 401
curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/users            # 401
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/api/upload -H 'Content-Type: application/json' -d '{}'  # 401

# docentes → 403 en /api/users
TOKEN_DOC=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"docente@faceaccess.lab","password":"docente123"}' | jq -r .token)
curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/users -H "Authorization: Bearer $TOKEN_DOC"  # 403

# admin → 200
curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/users -H "Authorization: Bearer $TOKEN"  # 200

# rate limit STS
for i in 1 2 3 4 5 6 7 8; do curl -s -o /dev/null -w "%{http_code} " localhost:3000/api/aws/credentials; done
# → 200 200 200 200 200 200 429 429

# índices
pnpm tsx scripts/ensure-indexes.ts
```

---

## 5. Métricas del modelo biométrico (a registrar)

- **Tiempo promedio de reconocimiento** (ms): des `rekognition_latency_ms` en CloudWatch.
- **Tasa de acierto**: `Permitidos / Total` en el historial.
- **Falsos positivos estimados**: match concedido con confianza bajo el umbral del estudiante.
- **Falsos negativos estimados**: denegado con confianza alta (≥90) que no coincide.
- **Escaneos por sesión**: promedio de intentos antes del resultado.

---

## 6. Cómo reportar evidencia

1. Ejecutar el checklist funcional (F1–F12) con capturas de pantalla numeradas.
2. Ejecutar las pruebas de seguridad (S1–S10) y guardar la salida de curl.
3. Ejecutar carga básica (C1–C5) y registrar latencias.
4. Guardar capturas en `docs/evidencia/` y referenciarlas aquí.
5. Llenar las tablas con los resultados reales antes de la sustentación.
