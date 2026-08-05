/**
 * Reglas de retroalimentacion del kiosco.
 *
 * Este modulo es logica pura y sin dependencias del DOM: recibe metricas del
 * rostro y devuelve el mensaje que debe leer la persona frente a la camara.
 * Se mantiene separado del hook para poder probarlo con Vitest.
 */

/** Metricas normalizadas de un cuadro de video. */
export interface FaceMetrics {
  /** Rostros detectados en el cuadro. */
  faceCount: number;
  /** Area del rostro dividida para el area del cuadro (0 a 1). */
  areaRatio: number;
  /** Distancia del centro del rostro al centro del cuadro (0 a 1). */
  offset: number;
  /** Inclinacion lateral de la cabeza en grados. */
  roll: number;
  /** Giro horizontal aproximado de la cabeza en grados. */
  yaw: number;
  /** Luminancia media dentro del rostro (0 a 1). */
  brightness: number;
}

export type FramingIssue =
  | 'no-face'
  | 'multiple-faces'
  | 'too-far'
  | 'too-close'
  | 'off-center'
  | 'not-frontal'
  | 'low-light';

export interface FramingFeedback {
  /** Problema de mayor prioridad, o null si el encuadre es valido. */
  issue: FramingIssue | null;
  /** Instruccion principal, visible sobre el video. */
  message: string;
  /** Aclaracion secundaria en texto pequeno. */
  hint: string;
  /** Calidad agregada del encuadre (0 a 1) para colorear la guia. */
  quality: number;
}

/**
 * Umbrales calibrados contra el ovalo guia del viewport, que cubre cerca del
 * 23 por ciento del cuadro. Un rostro bien ubicado llena entre la mitad y el
 * total de ese ovalo.
 */
export const FRAMING_THRESHOLDS = {
  /** Debajo de esto la persona esta demasiado lejos. */
  minArea: 0.1,
  /** Encima de esto la persona esta demasiado cerca. */
  maxArea: 0.35,
  /** Desplazamiento maximo tolerado respecto al centro. */
  maxOffset: 0.15,
  /** Inclinacion lateral maxima en grados. */
  maxRoll: 20,
  /** Giro horizontal maximo en grados. */
  maxYaw: 20,
  /** Luminancia minima aceptable dentro del rostro. */
  minBrightness: 0.22,
} as const;

const FRAMING_TEXT: Record<FramingIssue, { message: string; hint: string }> = {
  'no-face': {
    message: 'Colócate frente a la cámara',
    hint: 'La detección está activa y comienza sola',
  },
  'multiple-faces': {
    message: 'Solo una persona a la vez',
    hint: 'Pide a los demás que salgan del encuadre',
  },
  'too-far': {
    message: 'Acércate un poco',
    hint: 'Tu rostro debe llenar el óvalo',
  },
  'too-close': {
    message: 'Aléjate un poco',
    hint: 'Deja que se vea toda tu cabeza dentro del óvalo',
  },
  'off-center': {
    message: 'Céntrate en el óvalo',
    hint: 'Mueve la cabeza hasta el centro de la guía',
  },
  'not-frontal': {
    message: 'Mira de frente a la cámara',
    hint: 'Endereza la cabeza y evita girarla',
  },
  'low-light': {
    message: 'Hace falta más luz',
    hint: 'Ubícate frente a una fuente de luz, no de espaldas',
  },
};

const FRAMING_OK = {
  message: 'Encuadre correcto',
  hint: 'No te muevas, la verificación inicia sola',
};

/** Cae de 1 a 0 conforme el valor se aleja del rango aceptado. */
function rangeScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1;
  const distance = value < min ? min - value : value - max;
  const span = Math.max(max - min, 1e-6);
  return Math.max(0, 1 - distance / span);
}

/** Cae de 1 a 0 conforme el valor supera el limite. */
function limitScore(value: number, limit: number): number {
  if (value <= limit) return 1;
  return Math.max(0, 1 - (value - limit) / limit);
}

/**
 * Traduce las metricas del rostro a una sola instruccion. El orden de las
 * comprobaciones importa: primero lo que impide capturar y despues lo que solo
 * degrada la calidad, para no dar dos ordenes contradictorias a la vez.
 */
export function evaluateFraming(metrics: FaceMetrics): FramingFeedback {
  const t = FRAMING_THRESHOLDS;

  if (metrics.faceCount === 0) {
    return { issue: 'no-face', ...FRAMING_TEXT['no-face'], quality: 0 };
  }

  if (metrics.faceCount > 1) {
    return { issue: 'multiple-faces', ...FRAMING_TEXT['multiple-faces'], quality: 0 };
  }

  const areaScore = rangeScore(metrics.areaRatio, t.minArea, t.maxArea);
  const offsetScore = limitScore(metrics.offset, t.maxOffset);
  const rollScore = limitScore(Math.abs(metrics.roll), t.maxRoll);
  const yawScore = limitScore(Math.abs(metrics.yaw), t.maxYaw);
  const lightScore = limitScore(t.minBrightness - metrics.brightness, 0);
  const quality = Math.min(areaScore, offsetScore, rollScore, yawScore, lightScore);

  let issue: FramingIssue | null = null;
  if (metrics.areaRatio < t.minArea) issue = 'too-far';
  else if (metrics.areaRatio > t.maxArea) issue = 'too-close';
  else if (metrics.offset > t.maxOffset) issue = 'off-center';
  else if (Math.abs(metrics.roll) > t.maxRoll || Math.abs(metrics.yaw) > t.maxYaw) issue = 'not-frontal';
  else if (metrics.brightness < t.minBrightness) issue = 'low-light';

  if (!issue) {
    return { issue: null, ...FRAMING_OK, quality };
  }

  return { issue, ...FRAMING_TEXT[issue], quality };
}

/** Causa real por la que el kiosco no abrio la puerta. */
export type DenialReason =
  | 'no-match'
  | 'low-confidence'
  | 'no-student-record'
  | 'not-enrolled'
  | 'permissions'
  | 'liveness-failed'
  | 'capture-failed'
  | 'network-error'
  | 'out-of-schedule'
  | 'class-not-started'
  | 'class-ended'
  | 'class-cancelled'
  | 'wrong-lab'
  | 'virtual'
  | 'no-biometric'
  | 'consent-expired';

export interface DenialInfo {
  /** Codigo institucional que aparece en pantalla y en la bitacora. */
  code: string;
  /** Titulo corto, legible a distancia. */
  title: string;
  /** Explicacion de que ocurrio realmente. */
  detail: string;
  /** Que debe hacer la persona a continuacion. */
  action: string;
  /** Si tiene sentido volver a intentar sin ayuda de un tercero. */
  retryable: boolean;
}

export const DENIAL_REASONS: Record<DenialReason, DenialInfo> = {
  'no-match': {
    code: 'R01',
    title: 'Rostro no reconocido',
    detail: 'Tu rostro no coincide con ningún registro biométrico del laboratorio.',
    action: 'Si eres estudiante autorizado, acude al Departamento de Sistemas para enrolarte.',
    retryable: false,
  },
  'low-confidence': {
    code: 'R02',
    title: 'Coincidencia insuficiente',
    detail: 'Se encontró un registro parecido, pero la similitud quedó debajo del umbral exigido.',
    action: 'Quítate lentes o gorra, mejora la iluminación y vuelve a intentarlo.',
    retryable: true,
  },
  'no-student-record': {
    code: 'R03',
    title: 'Registro incompleto',
    detail: 'Tu rostro está en el índice biométrico pero no tiene una ficha de estudiante asociada.',
    action: 'Reporta el código R03 en el Departamento de Sistemas para completar tu ficha.',
    retryable: false,
  },
  'not-enrolled': {
    code: 'R15',
    title: 'No inscrito en esta clase',
    detail: 'Tu ficha existe, pero no estás inscrito en la clase que está en curso en este laboratorio.',
    action: 'Contacta al docente de la clase para inscribirte.',
    retryable: false,
  },
  permissions: {
    code: 'R04',
    title: 'Sin permisos activos',
    detail: 'Te identificamos correctamente, pero tu cuenta no tiene acceso vigente a este laboratorio.',
    action: 'Solicita la reactivación de tu acceso al docente responsable del laboratorio.',
    retryable: false,
  },
  'liveness-failed': {
    code: 'R05',
    title: 'Prueba de vida no superada',
    detail: 'La verificación anti suplantación no confirmó que haya una persona real frente a la cámara.',
    action: 'Retira fotos o pantallas del encuadre, mira de frente y repite la verificación.',
    retryable: true,
  },
  'capture-failed': {
    code: 'R06',
    title: 'Captura no válida',
    detail: 'No se pudo obtener una imagen utilizable de la cámara.',
    action: 'Revisa que la cámara no esté tapada y vuelve a intentarlo.',
    retryable: true,
  },
  'network-error': {
    code: 'R07',
    title: 'Servicio no disponible',
    detail: 'No hubo respuesta del servicio de reconocimiento en la nube.',
    action: 'Espera unos segundos y repite. Si persiste, avisa al Departamento de Sistemas.',
    retryable: true,
  },
  'out-of-schedule': {
    code: 'R08',
    title: 'Sin clase en este horario',
    detail: 'Tu identidad fue verificada, pero no tienes una clase vigente en este laboratorio y en este horario.',
    action: 'Consulta tu horario de clases. Si crees que es un error, acude a Coordinación Académica.',
    retryable: false,
  },
  'class-not-started': {
    code: 'R09',
    title: 'Clase aún no inicia',
    detail: 'Tu clase está programada en este laboratorio, pero el docente aún no la ha iniciado.',
    action: 'Espera a que el docente dé inicio a la sesión antes de registrar tu asistencia.',
    retryable: false,
  },
  'class-ended': {
    code: 'R10',
    title: 'Clase finalizada',
    detail: 'Tu clase ya fue finalizada por el docente; ya no se registran ingresos.',
    action: 'Si necesitas entrar, acude al docente responsable del laboratorio.',
    retryable: false,
  },
  'class-cancelled': {
    code: 'R11',
    title: 'Clase cancelada',
    detail: 'La sesión de hoy fue cancelada y no se registrará asistencia.',
    action: 'Consulta el aviso del docente para reprogramar tu ingreso al laboratorio.',
    retryable: false,
  },
  'wrong-lab': {
    code: 'R12',
    title: 'Laboratorio incorrecto',
    detail: 'Tu clase de hoy se imparte en otro laboratorio, no en este kiosco.',
    action: 'Dirígete al laboratorio asignado en tu horario de clases.',
    retryable: false,
  },
  virtual: {
    code: 'R13',
    title: 'Materia virtual',
    detail: 'Esta materia es virtual y no requiere control de acceso físico.',
    action: 'No necesitas pasar por el kiosco para esta asignatura.',
    retryable: false,
  },
  'no-biometric': {
    code: 'R14',
    title: 'Biometría pendiente',
    detail: 'Tu identidad fue verificada, pero aún no tienes tu registro biométrico completo.',
    action: 'Acude a tu docente para registrar tu biometría en el panel.',
    retryable: false,
  },
  'consent-expired': {
    code: 'R16',
    title: 'Consentimiento vencido',
    detail: 'Tu consentimiento biométrico venció o fue revocado y ya no autoriza el uso de tu rostro.',
    action: 'Renueva tu consentimiento con el responsable del laboratorio.',
    retryable: false,
  },
};

/** Etapas reales del escaneo, en el orden en que ocurren. */
export type ScanStageId = 'capture' | 'liveness' | 'compare' | 'authorize';

export interface ScanStageInfo {
  id: ScanStageId;
  label: string;
  desc: string;
  /** Progreso acumulado al terminar la etapa (0 a 1). */
  progress: number;
}

export const SCAN_STAGES: ScanStageInfo[] = [
  { id: 'capture', label: 'Capturando rostro', desc: 'Tomando la imagen del encuadre', progress: 0.2 },
  { id: 'liveness', label: 'Prueba de vida', desc: 'Confirmando que eres una persona real', progress: 0.45 },
  { id: 'compare', label: 'Comparando registros', desc: 'Buscando tu rostro en el índice biométrico', progress: 0.85 },
  { id: 'authorize', label: 'Validando permisos', desc: 'Comprobando tu acceso al laboratorio', progress: 1 },
];
