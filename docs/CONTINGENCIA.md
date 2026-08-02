# Plan de Contingencia — FaceAccess-Lab

> Documento que describe qué ocurre si AWS, MongoDB o Internet no están disponibles, y cómo responde el kiosco y el panel.

---

## 1. Escenarios de fallo

| Escenario | Síntoma | Respuesta actual del sistema |
|---|---|---|
| MongoDB caído | `/api/*` devuelven 500; panel no carga datos | El panel **no muestra banner** de caída por sí solo; `AppContext` usa `.catch(() => null)` y cae a datos seed |
| AWS (Rekognition/S3) caído | Compare/register/liveness fallan | El kiosco muestra `network-error` con causas y botón de reintento |
| Internet del kiosco caído | Fetch falla en todas las llamadas | El kiosco muestra error de red; **no hay modo offline** (limitación del MVP) |
| Credenciales AWS inválidas | Liveness/compare devuelven 500 | El kiosco muestra `network-error`; el panel `/api/health` reporta AWS no configurado |

---

## 2. Comportamiento por componente

### Kiosco
- **Sin red / AWS caído:** captura el frame, falla el fetch, muestra `network-error` con causa "Verifica tu conexión o contacta al personal". Botón de **reintento manual** disponible.
- **Sin rostro / liveness fallido:** muestra las causas R01-R04 y el siguiente paso (Departamento de Sistemas).
- **Bloqueo por sospecha:** tras 5 intentos fallidos consecutivos, bloqueo temporal de 30s con aviso visible.

### Panel administrativo
- **MongoDB caído:** la carga inicial falla silenciosamente y muestra datos de demostración. **Mejora recomendada:** detectar y mostrar banner "Sin conexión con el backend".
- **CloudWatch caído:** la tarjeta "Salud del Ecosistema" (HealthCard) muestra CloudWatch en rojo, pero el resto del panel sigue operativo.

### Backend
- **Errores controlados:** los handlers devuelven respuestas JSON con mensajes claros (400/401/403/404/500); no exponen stack traces al cliente.
- **Timeout de BD:** `connectDB` usa `serverSelectionTimeoutMS: 15000`; si falla, lanza error capturado por el handler.

---

## 3. Procedimiento de recuperación

1. **Verificar estado:** ejecutar `GET /api/health` (con token) o abrir el panel → tarjeta "Salud del Ecosistema".
2. **MongoDB caído:** verificar la URI en `.env`, credenciales de Atlas y whitelist de IP; reiniciar el dev server si es local.
3. **AWS caído:** verificar credenciales del IAM user (`aws sts get-caller-identity`), estado de los servicios en la consola AWS y que el bucket/topic existan.
4. **Kiosco sin responder:** recargar la página; si persiste, reiniciar el dev server o el proceso Next.
5. **Después de recuperar:** re-ejecutar `pnpm tsx scripts/ensure-indexes.ts` para garantizar índices.

---

## 4. Limitaciones declaradas del MVP

- **Sin modo offline:** el kiosco requiere conexión a Internet/AWS para verificar identidad. No hay cola local de accesos pendientes. (Mejora prevista en Fase 4 de producción.)
- **Sin replicación activa:** MongoDB Atlas (M10+ recomienda réplica) — el clúster gratuito M0 no ofrece alta disponibilidad garantizada.
- **Sin failover de AWS:** si Rekognition se degrada, no hay proveedor de respaldo.

Estas limitaciones son aceptables para un capstone, pero deben declararse ante el jurado como límites conocidos con su plan de mitigación.
