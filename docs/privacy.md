# Privacidad y Datos Biométricos — FaceAccess Lab

Resumen de cómo el sistema trata los datos personales y biométricos. La política completa se encuentra en `docs/PRIVACIDAD.md`.

## Qué datos se recopilan

| Dato | Almacenamiento | Finalidad |
|---|---|---|
| Imagen facial (foto de perfil) | Amazon S3 (`students/{id}.jpg`) | Identificación en el panel. |
| Embedding facial | Rekognition (colección `faceaccess-lab-students`) | Comparación biométrica en el kiosco. |
| Datos personales (nombre, correo, teléfono, carrera, lab) | MongoDB (`students`) | Registro académico. |
| Registros de acceso (fecha, hora, resultado, similitud) | MongoDB (`access_logs`) | Historial y auditoría. |
| Evidencia de denegados (foto + motivo) | S3 + MongoDB (`denial_evidence`) | Seguridad e incidentes. |

## Principios

- **Consentimiento explícito** al matricularse: el aviso se muestra en la pantalla de registro (ver texto sugerido en `docs/PRIVACIDAD.md`).
- **Finalidad limitada**: los datos biométricos se usan solo para el control de acceso al laboratorio.
- **Proporcionalidad**: se recopila únicamente lo necesario.
- **No se comparten con terceros ni se venden.**

## Retención y eliminación

- Logs de acceso: **90 días** (TTL en `access_logs.createdAt`).
- Auditoría: **365 días** (TTL en `audit_logs.createdAt`).
- Foto y embedding del estudiante: mientras esté matriculado.
- **Derecho al olvido**: `DELETE /api/students` elimina foto de S3, embedding de Rekognition y el documento de MongoDB.

## Medidas de protección

- S3 **privado** + presigned URLs (expiración).
- Rekognition colección privada; IAM de permisos mínimos.
- Liveness anti-suplantación.
- Autenticación JWT + RBAC (ver `docs/security.md`).

## Cumplimiento

- En producción debe cumplirse la normativa local (Ecuador: **Ley Orgánica de Protección de Datos Personales**) y buenas prácticas de la industria.
- Documento académico: para un despliegue real debe revisarlo un oficial de privacidad.

Ver también: `docs/security.md`, `docs/PRIVACIDAD.md` (política detallada).
