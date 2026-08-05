import { describe, expect, it } from 'vitest';
import {
  transition,
  kioskReducer,
  stageToLegacyFlow,
  isTerminal,
  INITIAL_STAGE,
  type KioskStage,
} from './kiosk-machine.ts';

describe('máquina de estados del kiosco', () => {
  it('arranca en IDLE', () => {
    expect(INITIAL_STAGE).toBe('IDLE');
  });

  it('sigue el camino feliz: cámara → encuadre → liveness → match → permiso → concedido', () => {
    let s: KioskStage = INITIAL_STAGE;
    s = transition(s, { type: 'CAMERA_STARTING' }); expect(s).toBe('CAMERA_INITIALIZING');
    s = transition(s, { type: 'CAMERA_READY' }); expect(s).toBe('ALIGN_FACE');
    s = transition(s, { type: 'FACE_ALIGNED' }); expect(s).toBe('LIVENESS');
    s = transition(s, { type: 'LIVENESS_DONE' }); expect(s).toBe('MATCHING');
    s = transition(s, { type: 'PERMISSION_STARTED' }); expect(s).toBe('CHECKING_PERMISSION');
    s = transition(s, { type: 'GRANTED' }); expect(s).toBe('ACCESS_GRANTED');
    expect(isTerminal(s)).toBe(true);
  });

  it('deniega y vuelve a IDLE tras el reset', () => {
    let s: KioskStage = 'CHECKING_PERMISSION';
    s = transition(s, { type: 'DENIED' }); expect(s).toBe('ACCESS_DENIED');
    s = transition(s, { type: 'RESET' }); expect(s).toBe('IDLE');
  });

  it('ignora transiciones no permitidas (no se puede conceder desde ALIGN_FACE)', () => {
    expect(transition('ALIGN_FACE', { type: 'GRANTED' })).toBe('ALIGN_FACE');
  });

  it('puede denegar desde LIVENESS (error de red/liveness) y llegar al resultado', () => {
    expect(transition('LIVENESS', { type: 'DENIED' })).toBe('ACCESS_DENIED');
  });

  it('puede denegar desde MATCHING (captura fallida) y llegar al resultado', () => {
    expect(transition('MATCHING', { type: 'DENIED' })).toBe('ACCESS_DENIED');
  });

  it('el camino feliz continúa desde LIVENESS → MATCHING → permiso → concedido', () => {
    let s: KioskStage = 'LIVENESS';
    s = transition(s, { type: 'MATCHING_STARTED' }); expect(s).toBe('MATCHING');
    s = transition(s, { type: 'PERMISSION_STARTED' }); expect(s).toBe('CHECKING_PERMISSION');
    s = transition(s, { type: 'GRANTED' }); expect(s).toBe('ACCESS_GRANTED');
  });

  it('LIVENESS_STARTED es un auto-transición que mantiene LIVENESS', () => {
    expect(transition('LIVENESS', { type: 'LIVENESS_STARTED' })).toBe('LIVENESS');
  });

  it('timeout en liveness lleva a RETRY', () => {
    expect(transition('LIVENESS', { type: 'TIMEOUT' })).toBe('RETRY');
    expect(transition('MATCHING', { type: 'TIMEOUT' })).toBe('RETRY');
  });

  it('error de cámara lleva a RETRY y desde ahí se reintenta', () => {
    let s = transition('CAMERA_INITIALIZING', { type: 'CAMERA_ERROR' });
    expect(s).toBe('RETRY');
    s = transition(s, { type: 'CAMERA_STARTING' });
    expect(s).toBe('CAMERA_INITIALIZING');
  });

  it('OFFLINE_CHANGED entra y sale de OFFLINE', () => {
    expect(transition('ALIGN_FACE', { type: 'OFFLINE_CHANGED', online: false })).toBe('OFFLINE');
    expect(transition('OFFLINE', { type: 'OFFLINE_CHANGED', online: true })).toBe('IDLE');
  });

  it('MAINTENANCE fija el estado de mantenimiento', () => {
    expect(transition('IDLE', { type: 'MAINTENANCE' })).toBe('MAINTENANCE');
  });

  it('el reducer funciona con useReducer', () => {
    expect(kioskReducer('IDLE', { type: 'CAMERA_STARTING' })).toBe('CAMERA_INITIALIZING');
  });
});

describe('proyección al flujo legado', () => {
  it('mapea estados nuevos a los flowState actuales', () => {
    expect(stageToLegacyFlow('ALIGN_FACE')).toBe('framing');
    expect(stageToLegacyFlow('LIVENESS')).toBe('liveness');
    expect(stageToLegacyFlow('MATCHING')).toBe('scanning');
    expect(stageToLegacyFlow('CHECKING_PERMISSION')).toBe('scanning');
    expect(stageToLegacyFlow('ACCESS_GRANTED')).toBe('result');
    expect(stageToLegacyFlow('IDLE')).toBe('idle');
    expect(stageToLegacyFlow('OFFLINE')).toBe('idle');
    expect(stageToLegacyFlow('MAINTENANCE')).toBe('idle');
  });
});
