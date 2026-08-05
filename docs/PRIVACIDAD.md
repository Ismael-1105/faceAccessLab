# Política de Privacidad y Datos Biométricos — FaceAccess-Lab

> Documento que describe cómo el sistema recopila, procesa, almacena, retiene y
> elimina datos biométricos (rostro/embeddings). Fase 3: ciclo de vida
> biométrico completo (consentimiento, retención, eliminación y cifrado).

---

## 1. Datos que se recopilan

| Dato | Dónde se almacena | Finalidad |
|---|---|---|
| Imagen facial de matrícula | Amazon S3 privado, cifrado KMS (`students/{id}.jpg`) | Identificación visual en el panel |
| Embedding facial (features) | Amazon Rekognition (colección `faceaccess-lab-students`) | Comparación biométrica en el kiosco |
| Foto de evidencia de intentos denegados | Amazon S3 privado, cifrado KMS (`evidence/{fecha}/{intento}.jpg`) | Auditoría de rechazos e incidentes |
| Datos personales (nombre, correo, cédula, teléfono, carrera, laboratorio) | MongoDB (colección `students`) | Registro académico |
| Registros de acceso (fecha, hora, resultado, similitud) | MongoDB (colección `access_logs`) | Historial y auditoría |
| Consentimiento (versión, quién, cuándo, lab, expiración) | MongoDB (`students` + `consent_logs`) | Trazabilidad del tratamiento |

**Importante:** las imágenes de **intentos exitosos** nunca se almacenan: el
kiosco solo persiste la imagen de referencia cuando el acceso es **denegado**
(`lib/kiosk-verification.ts` → `saveDeniedEvidence`). Un acceso concedido
genera únicamente el `AccessLog` y la asistencia.

---

## 2. Base legal del tratamiento

- **Consentimiento:** la matrícula de un estudiante otorga el consentimiento
  biométrico. Se registra: quién matriculó (`consentGrantedBy`), cuándo
  (`consentGrantedAt`), para qué laboratorio (`consentLab`), qué versión de la
  política aceptó (`consentVersion`) y su fecha de expiración
  (`consentExpiresAt`).
- **Finalidad legítima:** seguridad física del laboratorio y control de acceso.
- **Proporcionalidad:** se recopila únicamente lo necesario para la verificación.

**Aviso de matrícula (EnrollmentView):**

> "Al registrarte, autorizas a FaceAccess Lab a capturar y procesar tu imagen
> facial con el fin exclusivo de controlar el acceso al laboratorio. Tu rostro
> se convierte en un vector biométrico almacenado de forma segura (cifrado) y
> no se comparte con terceros. Este consentimiento vence en {días} días y
> puedes revocarlo en cualquier momento."

---

## 3. Ciclo de vida del consentimiento

| Acción | Cuándo | Efecto |
|---|---|---|
| **Otorgar** (`grant`) | Al matricular (`handleCreateStudent`) | Se fijan versión, actor, lab y expiración; se registra en `ConsentLog`. |
| **Renovar** (`refresh`) | Cada captura facial exitosa (`handleRegisterBiometric`) | Se re-calculan `consentExpiresAt`; nuevo evento en `ConsentLog`. |
| **Revocar** (`revoke`) | Botón "Revocar datos biométricos" (`PUT /api/students/revoke-biometric`) | Se borran la foto (S3) y el embedding (Rekognition); `biometricStatus → pending`; evento en `ConsentLog`. La ficha académica se conserva. |
| **Expirar** | Automático por fecha | El kiosco deniega con `consent-expired` (R16) aunque el embedding siga indexado. |

Configuración: `CONSENT_DAYS` (días de vigencia, por defecto 365) y
`CONSENT_VERSION` (versión de la política, por defecto `v1`) en `lib/biometrics.ts`.

---

## 4. Retención

| Dato | Retención | Mecanismo |
|---|---|---|
| AccessLog | 90 días | Índice TTL (`access_logs.createdAt`) |
| AuditLog | 365 días | Índice TTL (`audit_logs.createdAt`) |
| DenialEvidence (documento) | 90 días | Índice TTL (`denial_evidence.createdAt`) |
| DenialEvidence (foto S3) | 90 días | Recomendado: lifecycle rule en el bucket para el prefijo `evidence/` |
| Foto de matrícula + embedding | Mientras el consentimiento esté vigente y el estudiante matriculado | Revocación/eliminación explícita |
| ConsentLog | 5 años (recomendado, legal) | Sin TTL; borrado solo por eliminación del estudiante |
| Sesiones (refresh tokens) | 7 días | Índice TTL (`sessions.expiresAt`) |

---

## 5. Eliminación completa

Al eliminar un estudiante (`DELETE /api/students` → `deleteStudentData` en
`lib/consent.ts`), se borra **todo**:

1. **MongoDB:** `Student`, `AccessLog`, `Incident`, `Attendance`,
   `Enrollment`, `ConsentLog`, `DenialEvidence`.
2. **S3:** foto de matrícula (`students/{id}.jpg`) y cada foto de evidencia
   (`evidence/...`) vinculada al estudiante.
3. **Rekognition Collection:** el embedding (`DeleteFaces`).
4. **Cachés y referencias:** no existe caché persistente de rostros en el
   servidor; los navegadores solo retienen URLs firmadas de corta duración que
   caducan solas.

La **revocación** (`revokeBiometric`) es un subconjunto: elimina S3 +
Rekognition y limpia los campos biométricos, sin tocar la ficha académica.

---

## 6. Seguridad del almacenamiento

- **Cifrado S3 con KMS:** todos los objetos se suben con
  `ServerSideEncryption: aws:kms` (clave por defecto o `AWS_KMS_KEY_ID`).
- **Bucket privado:** el bucket no es público. Política de bucket recomendada
  (mínima):
  - Bloquear todo acceso público (`BlockPublicAcls`, `IgnorePublicAcls`,
    `BlockPublicPolicy`, `RestrictPublicBuckets` = `true`).
  - Ninguna policy que conceda `s3:GetObject` a `Principal: "*"`.
- **URLs firmadas de corta duración:** las fotos se sirven solo vía
  `GET /api/photos/{key}` (RBAC + presigned URL de 5 min por defecto) y
  `GET /api/evidence/photo`. Nunca se expone el bucket directamente
  (`getPhotoSrc` convierte toda referencia a `/api/photos`).
- **Separación de namespaces:** fotos de matrícula (`students/`) y evidencias
  de intentos (`evidence/`) en prefijos distintos, validados por
  `isManagedPhotoKey` en `lib/photo-access.ts`.

---

## 7. Umbrales de comparación y limitaciones

Los umbrales viven en `lib/biometrics.ts` como única fuente de verdad:

| Umbral | Valor | Uso |
|---|---|---|
| `REKOGNITION_MATCH_THRESHOLD` | 85% | Candidatos que devuelve `SearchFacesByImage` |
| `DEFAULT_MATCH_PERCENTAGE` | 85% | Similitud mínima exigida por estudiante (ajustable por ficha) |
| `LIVENESS_CONFIDENCE_THRESHOLD` | 75 | Confianza mínima de la prueba de vida (anti-suplantación) |

**Limitaciones (documentadas):**
- El reconocimiento facial **no es infalible**: depende de iluminación, ángulo,
  uso de lentes/gorras y calidad de la cámara del kiosco.
- Un umbral alto reduce falsos positivos (que alguien suplante a otro) pero
  aumenta falsos negativos (personas legítimas rechazadas); un umbral bajo
  tiene el efecto inverso.
- La biometría es **probabilística**: dos capturas del mismo rostro nunca son
  idénticas. El sistema reporta la similitud exacta en cada `AccessLog` para
  poder auditar decisiones cercanas al umbral.
- Las métricas del umbral aplican **por estudiante** (`matchPercentage`), lo
  que permite calibrar individualmente según la calidad del enrollamiento.
- La liveness mitiga presentación de fotos/videos, pero su precisión depende de
  la sesión de AWS Face Liveness y de condiciones de red.

---

## 8. Compromisos

1. Los datos biométricos se usan **solo** para el control de acceso del laboratorio.
2. No se comparten con terceros ni se venden.
3. El estudiante puede revocar o solicitar la eliminación de sus datos en cualquier momento.
4. En producción se debe cumplir la normativa local (Ecuador: Ley Orgánica de
   Protección de Datos Personales) y buenas prácticas de la industria (GDPR-like).

## 9. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Acceso no autorizado a embeddings | Colección Rekognition privada; IAM mínimo; autenticación en API |
| Fuga de fotos | Bucket S3 privado + cifrado KMS + presigned URLs de corta duración |
| Spoofing (foto/video) | Face Liveness + detección de encuadre real |
| Re-identificación cruzada | Los embeddings no se vinculan fuera del laboratorio |
| Retención excesiva | TTLs por tipo de dato + revocación/eliminación explícita |

> Nota: este documento es una guía académica. Para un despliegue real, debe
> revisarse por un oficial de privacidad y adaptarse a la legislación vigente.
