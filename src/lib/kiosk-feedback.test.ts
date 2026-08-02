import { describe, it, expect } from 'vitest';
import {
  evaluateFraming,
  FRAMING_THRESHOLDS as T,
  DENIAL_REASONS,
  SCAN_STAGES,
  type FaceMetrics,
} from './kiosk-feedback';

/** Rostro bien encuadrado, base sobre la que se altera una sola métrica. */
const GOOD: FaceMetrics = {
  faceCount: 1,
  areaRatio: (T.minArea + T.maxArea) / 2,
  offset: 0.02,
  roll: 2,
  yaw: 3,
  brightness: 0.6,
};

const withMetrics = (patch: Partial<FaceMetrics>): FaceMetrics => ({ ...GOOD, ...patch });

describe('evaluateFraming', () => {
  it('acepta un rostro centrado, frontal y bien iluminado', () => {
    const result = evaluateFraming(GOOD);
    expect(result.issue).toBeNull();
    expect(result.quality).toBe(1);
  });

  it('pide acercarse cuando el rostro ocupa poco del cuadro', () => {
    const result = evaluateFraming(withMetrics({ areaRatio: T.minArea / 2 }));
    expect(result.issue).toBe('too-far');
    expect(result.message).toContain('Acércate');
  });

  it('pide alejarse cuando el rostro desborda el óvalo', () => {
    const result = evaluateFraming(withMetrics({ areaRatio: T.maxArea * 1.5 }));
    expect(result.issue).toBe('too-close');
    expect(result.message).toContain('Aléjate');
  });

  it('pide centrarse cuando el rostro se desplaza del centro', () => {
    const result = evaluateFraming(withMetrics({ offset: T.maxOffset * 2 }));
    expect(result.issue).toBe('off-center');
  });

  it('pide mirar de frente ante inclinación o giro excesivos', () => {
    expect(evaluateFraming(withMetrics({ roll: T.maxRoll + 5 })).issue).toBe('not-frontal');
    expect(evaluateFraming(withMetrics({ yaw: -(T.maxYaw + 5) })).issue).toBe('not-frontal');
  });

  it('avisa de la falta de luz cuando todo lo demás está bien', () => {
    const result = evaluateFraming(withMetrics({ brightness: T.minBrightness / 2 }));
    expect(result.issue).toBe('low-light');
  });

  it('no da instrucciones de posición cuando no hay rostro', () => {
    const result = evaluateFraming(withMetrics({ faceCount: 0 }));
    expect(result.issue).toBe('no-face');
    expect(result.quality).toBe(0);
  });

  it('exige una sola persona en el encuadre', () => {
    expect(evaluateFraming(withMetrics({ faceCount: 2 })).issue).toBe('multiple-faces');
  });

  it('prioriza la distancia sobre el resto de problemas simultáneos', () => {
    const result = evaluateFraming(withMetrics({
      areaRatio: T.minArea / 2,
      offset: T.maxOffset * 2,
      brightness: 0.05,
    }));
    expect(result.issue).toBe('too-far');
  });

  it('degrada la calidad conforme el encuadre empeora', () => {
    const leve = evaluateFraming(withMetrics({ areaRatio: T.minArea * 0.95 }));
    const grave = evaluateFraming(withMetrics({ areaRatio: T.minArea * 0.2 }));
    expect(leve.quality).toBeGreaterThan(grave.quality);
    expect(grave.quality).toBeGreaterThanOrEqual(0);
  });
});

describe('catálogo de causas de rechazo', () => {
  it('usa códigos únicos y textos accionables', () => {
    const codes = Object.values(DENIAL_REASONS).map(r => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const reason of Object.values(DENIAL_REASONS)) {
      expect(reason.title.length).toBeGreaterThan(0);
      expect(reason.detail.length).toBeGreaterThan(0);
      expect(reason.action.length).toBeGreaterThan(0);
    }
  });
});

describe('etapas del escaneo', () => {
  it('avanza de forma monótona hasta completarse', () => {
    const progresses = SCAN_STAGES.map(s => s.progress);
    expect(progresses).toEqual([...progresses].sort((a, b) => a - b));
    expect(progresses.at(-1)).toBe(1);
  });
});
