# Política de Privacidad y Datos Biométricos — FaceAccess-Lab

> Documento académico que describe cómo el sistema recopila, procesa, almacena y elimina datos biométricos (rostro/embeddings), cumpliendo buenas prácticas para sistemas de control de acceso.

---

## 1. Datos que se recopilan

| Dato | Dónde se almacena | Finalidad |
|---|---|---|
| Imagen facial (foto de perfil) | Amazon S3 (`students/{id}.jpg`) | Identificación visual en el panel |
| Embedding facial (features) | Amazon Rekognition (colección `faceaccess-lab-students`) | Comparación biométrica en el kiosco |
| Datos personales (nombre, correo, cédula, teléfono, carrera, laboratorio) | MongoDB (colección `students`) | Registro académico |
| Registros de acceso (fecha, hora, resultado, similitud) | MongoDB (colección `access_logs`) | Historial y auditoría |

## 2. Base legal del tratamiento

- **Consentimiento:** el registro de un estudiante implica el consentimiento explícito para el uso de su rostro con fines de control de acceso al laboratorio. El aviso debe mostrarse en la pantalla de matrícula.
- **Finalidad legítima:** seguridad física del laboratorio y control de acceso.
- **Proporcionalidad:** se recopila únicamente lo necesario para la verificación biométrica.

## 3. Consentimiento y aviso

**Aviso sugerido en el registro (EnrollmentView):**

> "Al registrarte, autorizas a FaceAccess Lab a capturar y procesar tu imagen facial con el fin exclusivo de controlar el acceso al laboratorio. Tu rostro se convierte en un vector biométrico almacenado de forma segura y no se comparte con terceros."

## 4. Retención y eliminación

- **Logs de acceso:** se conservan **90 días** (índice TTL en `access_logs.createdAt`).
- **Registros de auditoría:** se conservan **365 días** (índice TTL en `audit_logs.createdAt`).
- **Foto y embedding del estudiante:** se conservan mientras el estudiante esté matriculado.
- **Derecho al olvido:** al eliminar un estudiante (`DELETE /api/students`), el sistema borra:
  1. La foto de Amazon S3 (`deleteImage`).
  2. El embedding facial de Rekognition (`deleteFace`).
  3. El documento de MongoDB (`Student.deleteOne`).

## 5. Medidas de seguridad

- **Credenciales AWS:** uso de un IAM user con permisos mínimos (S3, Rekognition, SNS, CloudWatch); las claves viven en variables de entorno, no en el código.
- **S3 privado:** las fotos se sirven vía presigned URLs con expiración (1h); el bucket no debe ser público.
- **Autenticación:** JWT con bcrypt para el portal docente; endpoints de escritura protegidos.
- **Transporte:** HTTPS (despliegue en Vercel).
- **Liveness:** verificación anti-suplantación con Face Liveness de AWS.

## 6. Compromisos

1. Los datos biométricos se usan **solo** para el control de acceso del laboratorio.
2. No se comparten con terceros ni se venden.
3. El estudiante puede solicitar la eliminación de sus datos.
4. En producción, se debe cumplir la normativa local (Ecuador: Ley Orgánica de Protección de Datos Personales) y buenas prácticas de la industria.

## 7. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Acceso no autorizado a embeddings | Colección Rekognition privada; IAM mínimo; autenticación en API |
| Fuga de fotos | Bucket S3 privado + presigned URLs |
| Spoofing (foto/video) | Face Liveness + detección de encuadre real |
| Re-identificación cruzada | Los embeddings no se vinculan fuera del laboratorio |

> Nota: este documento es una guía académica. Para un despliegue real, debe revisarse por un oficial de privacidad y adaptarse a la legislación vigente.
