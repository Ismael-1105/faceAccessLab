/**
 * Máquina de estados del kiosco (Fase 7).
 *
 * Sustituye el manejo con múltiples booleanos por un conjunto explícito de
 * estados y transiciones. Módulo puro y testeable.
 *
 * Estados recomendados:
 * IDLE, CAMERA_INITIALIZING, ALIGN_FACE, LIVENESS, MATCHING,
 * CHECKING_PERMISSION, ACCESS_GRANTED, ACCESS_DENIED, RETRY, OFFLINE, MAINTENANCE
 */
export type KioskStage =
  | 'IDLE'
  | 'CAMERA_INITIALIZING'
  | 'ALIGN_FACE'
  | 'LIVENESS'
  | 'MATCHING'
  | 'CHECKING_PERMISSION'
  | 'ACCESS_GRANTED'
  | 'ACCESS_DENIED'
  | 'RETRY'
  | 'OFFLINE'
  | 'MAINTENANCE';

export type KioskEvent =
  | { type: 'BOOT' }
  | { type: 'CAMERA_STARTING' }
  | { type: 'CAMERA_READY' }
  | { type: 'CAMERA_ERROR' }
  | { type: 'FACE_ALIGNED' }
  | { type: 'LIVENESS_STARTED' }
  | { type: 'LIVENESS_DONE' }
  | { type: 'MATCHING_STARTED' }
  | { type: 'PERMISSION_STARTED' }
  | { type: 'GRANTED' }
  | { type: 'DENIED' }
  | { type: 'RESET' }
  | { type: 'TIMEOUT' }
  | { type: 'OFFLINE_CHANGED'; online: boolean }
  | { type: 'MAINTENANCE' };

export const INITIAL_STAGE: KioskStage = 'IDLE';

/** Transiciones permitidas por estado. Las no listadas se ignoran. */
const ALLOWED: Record<KioskStage, KioskEvent['type'][]> = {
  IDLE: ['CAMERA_STARTING', 'CAMERA_READY', 'MAINTENANCE', 'OFFLINE_CHANGED', 'DENIED'],
  CAMERA_INITIALIZING: ['CAMERA_READY', 'CAMERA_ERROR', 'OFFLINE_CHANGED', 'DENIED'],
  ALIGN_FACE: ['FACE_ALIGNED', 'CAMERA_ERROR', 'OFFLINE_CHANGED', 'DENIED'],
  // DENIED/GRANTED son terminales y pueden llegar desde cualquier etapa en curso:
  // un error de red/liveness puede denegar desde LIVENESS, y una captura fallida
  // desde MATCHING, sin pasar por CHECKING_PERMISSION.
  LIVENESS: ['LIVENESS_STARTED', 'LIVENESS_DONE', 'MATCHING_STARTED', 'TIMEOUT', 'GRANTED', 'DENIED', 'OFFLINE_CHANGED'],
  MATCHING: ['PERMISSION_STARTED', 'TIMEOUT', 'GRANTED', 'DENIED', 'OFFLINE_CHANGED'],
  CHECKING_PERMISSION: ['GRANTED', 'DENIED', 'TIMEOUT', 'OFFLINE_CHANGED'],
  ACCESS_GRANTED: ['RESET', 'OFFLINE_CHANGED'],
  ACCESS_DENIED: ['RESET', 'OFFLINE_CHANGED'],
  RETRY: ['CAMERA_STARTING', 'OFFLINE_CHANGED', 'DENIED'],
  OFFLINE: ['OFFLINE_CHANGED'],
  MAINTENANCE: ['MAINTENANCE', 'OFFLINE_CHANGED'],
};

/** Siguiente estado para cada evento permitido. */
const NEXT: Record<KioskEvent['type'], (s: KioskStage, e: KioskEvent) => KioskStage> = {
  BOOT: s => s,
  CAMERA_STARTING: () => 'CAMERA_INITIALIZING',
  CAMERA_READY: () => 'ALIGN_FACE',
  CAMERA_ERROR: () => 'RETRY',
  FACE_ALIGNED: () => 'LIVENESS',
  LIVENESS_STARTED: () => 'LIVENESS',
  LIVENESS_DONE: () => 'MATCHING',
  MATCHING_STARTED: () => 'MATCHING',
  PERMISSION_STARTED: () => 'CHECKING_PERMISSION',
  GRANTED: () => 'ACCESS_GRANTED',
  DENIED: () => 'ACCESS_DENIED',
  RESET: () => 'IDLE',
  TIMEOUT: () => 'RETRY',
  OFFLINE_CHANGED: (_s, e) => (e.type === 'OFFLINE_CHANGED' ? (e.online ? 'IDLE' : 'OFFLINE') : 'IDLE'),
  MAINTENANCE: () => 'MAINTENANCE',
};

/** Función de transición pura: `(estado, evento) → estado`. */
export function transition(stage: KioskStage, event: KioskEvent): KioskStage {
  if (event.type === 'OFFLINE_CHANGED') {
    return event.online ? 'IDLE' : 'OFFLINE';
  }
  if (!ALLOWED[stage].includes(event.type)) return stage;
  return NEXT[event.type](stage, event);
}

/** Reducer para useReducer. */
export function kioskReducer(stage: KioskStage, event: KioskEvent): KioskStage {
  return transition(stage, event);
}

/** Proyección hacia el flujo legado (compatibilidad con las vistas actuales). */
export function stageToLegacyFlow(stage: KioskStage): 'idle' | 'framing' | 'liveness' | 'scanning' | 'result' {
  switch (stage) {
    case 'ALIGN_FACE': return 'framing';
    case 'LIVENESS': return 'liveness';
    case 'MATCHING':
    case 'CHECKING_PERMISSION': return 'scanning';
    case 'ACCESS_GRANTED':
    case 'ACCESS_DENIED': return 'result';
    default: return 'idle';
  }
}

/** ¿El estado es un desenlace? */
export function isTerminal(stage: KioskStage): boolean {
  return stage === 'ACCESS_GRANTED' || stage === 'ACCESS_DENIED';
}
