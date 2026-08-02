'use client';

import { useEffect, useRef, useState } from 'react';
import type { FaceDetector } from '@mediapipe/tasks-vision';
import { evaluateFraming, type FaceMetrics, type FramingFeedback } from '@/src/lib/kiosk-feedback';

/** Caja del rostro en coordenadas normalizadas del cuadro sin espejar. */
export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FramingStatus = 'idle' | 'loading' | 'ready' | 'unsupported';

export interface FaceFraming {
  /** Estado del detector: si es 'unsupported' la UI cae al modo manual. */
  status: FramingStatus;
  /** Instruccion vigente para la persona frente a la camara. */
  feedback: FramingFeedback;
  /** Metricas crudas del ultimo cuadro analizado. */
  metrics: FaceMetrics;
  /** Caja del rostro para dibujar, o null si no hay rostro. */
  box: NormalizedBox | null;
  /** Milisegundos continuos con encuadre valido. */
  stableMs: number;
}

const DETECT_INTERVAL_MS = 80;
/** Un problema debe repetirse este tiempo antes de cambiar el mensaje en pantalla. */
const ISSUE_HOLD_MS = 300;
/** Suavizado exponencial de las metricas para que el texto no parpadee. */
const SMOOTHING = 0.4;

const EMPTY_METRICS: FaceMetrics = {
  faceCount: 0,
  areaRatio: 0,
  offset: 0,
  roll: 0,
  yaw: 0,
  brightness: 0,
};

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Inclinacion lateral a partir de la linea entre los dos ojos. */
function computeRoll(points: { x: number; y: number }[]): number {
  const [rightEye, leftEye] = points;
  if (!rightEye || !leftEye) return 0;
  return toDegrees(Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x));
}

/**
 * Giro horizontal aproximado. Con la cabeza de frente la nariz equidista de
 * ambas orejas, asi que la asimetria de esas distancias sirve de estimador.
 */
function computeYaw(points: { x: number; y: number }[]): number {
  const [rightEye, leftEye, nose, , rightEar, leftEar] = points;
  if (nose && rightEar && leftEar) {
    const dRight = Math.hypot(nose.x - rightEar.x, nose.y - rightEar.y);
    const dLeft = Math.hypot(nose.x - leftEar.x, nose.y - leftEar.y);
    const total = dRight + dLeft;
    if (total > 0) return ((dRight - dLeft) / total) * 90;
  }
  if (nose && rightEye && leftEye) {
    const eyeMidX = (rightEye.x + leftEye.x) / 2;
    const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
    if (eyeDist > 0) return ((nose.x - eyeMidX) / eyeDist) * 90;
  }
  return 0;
}

/** Luminancia media dentro del rostro, medida sobre una miniatura del cuadro. */
function sampleBrightness(
  video: HTMLVideoElement,
  area: NormalizedBox,
  canvas: HTMLCanvasElement,
): number {
  canvas.width = 96;
  canvas.height = 54;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 1;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const x = Math.max(0, Math.floor(area.x * canvas.width));
  const y = Math.max(0, Math.floor(area.y * canvas.height));
  const w = Math.max(1, Math.min(canvas.width - x, Math.floor(area.width * canvas.width)));
  const h = Math.max(1, Math.min(canvas.height - y, Math.floor(area.height * canvas.height)));

  const { data } = ctx.getImageData(x, y, w, h);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return sum / (data.length / 4) / 255;
}

/**
 * Detecta el rostro en vivo y traduce su posicion a instrucciones de encuadre.
 *
 * El detector solo corre mientras `enabled` es verdadero, para no gastar CPU
 * durante el liveness de AWS ni en la pantalla de resultado.
 */
export function useFaceFraming(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): FaceFraming {
  const [status, setStatus] = useState<FramingStatus>('idle');
  const [metrics, setMetrics] = useState<FaceMetrics>(EMPTY_METRICS);
  const [feedback, setFeedback] = useState<FramingFeedback>(() => evaluateFraming(EMPTY_METRICS));
  const [box, setBox] = useState<NormalizedBox | null>(null);
  const [stableMs, setStableMs] = useState(0);

  const detectorRef = useRef<FaceDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedRef = useRef<FaceMetrics>(EMPTY_METRICS);
  const lastDetectRef = useRef(0);
  const lastTimestampRef = useRef(-1);
  const pendingIssueRef = useRef<{ issue: FramingFeedback['issue']; since: number } | null>(null);
  const shownFeedbackRef = useRef<FramingFeedback>(evaluateFraming(EMPTY_METRICS));
  const stableSinceRef = useRef<number | null>(null);

  // Carga perezosa del detector: el bundle wasm solo baja cuando el kiosco lo pide.
  useEffect(() => {
    if (!enabled || detectorRef.current) return;
    let cancelled = false;

    setStatus('loading');
    (async () => {
      try {
        const { FilesetResolver, FaceDetector: Detector } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        const detector = await Detector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'GPU' },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setStatus('ready');
      } catch (err) {
        console.error('[Kiosk] No se pudo iniciar el detector de rostros:', err);
        if (!cancelled) setStatus('unsupported');
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  // Cierre del detector al desmontar la pantalla del kiosco.
  useEffect(() => () => {
    detectorRef.current?.close();
    detectorRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      smoothedRef.current = EMPTY_METRICS;
      stableSinceRef.current = null;
      pendingIssueRef.current = null;
      setMetrics(EMPTY_METRICS);
      setBox(null);
      setStableMs(0);
      return;
    }

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);

      const detector = detectorRef.current;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < 2 || video.videoWidth === 0) return;

      const now = performance.now();
      if (now - lastDetectRef.current < DETECT_INTERVAL_MS) return;
      lastDetectRef.current = now;

      // detectForVideo exige marcas de tiempo estrictamente crecientes.
      const timestamp = Math.max(lastTimestampRef.current + 1, Math.round(now));
      lastTimestampRef.current = timestamp;

      let detections;
      try {
        detections = detector.detectForVideo(video, timestamp).detections;
      } catch (err) {
        console.error('[Kiosk] Error detectando rostro:', err);
        return;
      }

      const frameW = video.videoWidth;
      const frameH = video.videoHeight;
      const face = detections[0];

      if (!face?.boundingBox) {
        smoothedRef.current = EMPTY_METRICS;
        setMetrics(EMPTY_METRICS);
        setBox(null);
        applyFeedback(EMPTY_METRICS, now);
        return;
      }

      const bb = face.boundingBox;
      const normalized: NormalizedBox = {
        x: bb.originX / frameW,
        y: bb.originY / frameH,
        width: bb.width / frameW,
        height: bb.height / frameH,
      };

      const pixels = face.keypoints.map(k => ({ x: k.x * frameW, y: k.y * frameH }));
      const centerX = normalized.x + normalized.width / 2;
      const centerY = normalized.y + normalized.height / 2;

      const raw: FaceMetrics = {
        faceCount: detections.length,
        areaRatio: normalized.width * normalized.height,
        offset: Math.hypot(centerX - 0.5, centerY - 0.5),
        roll: computeRoll(pixels),
        yaw: computeYaw(pixels),
        brightness: sampleBrightness(video, normalized, (canvasRef.current ??= document.createElement('canvas'))),
      };

      const prev = smoothedRef.current;
      const smooth = (a: number, b: number) => a * (1 - SMOOTHING) + b * SMOOTHING;
      const next: FaceMetrics = {
        faceCount: raw.faceCount,
        areaRatio: prev.faceCount ? smooth(prev.areaRatio, raw.areaRatio) : raw.areaRatio,
        offset: prev.faceCount ? smooth(prev.offset, raw.offset) : raw.offset,
        roll: prev.faceCount ? smooth(prev.roll, raw.roll) : raw.roll,
        yaw: prev.faceCount ? smooth(prev.yaw, raw.yaw) : raw.yaw,
        brightness: prev.faceCount ? smooth(prev.brightness, raw.brightness) : raw.brightness,
      };

      smoothedRef.current = next;
      setMetrics(next);
      setBox(normalized);
      applyFeedback(next, now);
    };

    /** Aplica histeresis para que el mensaje no cambie en cada cuadro. */
    const applyFeedback = (current: FaceMetrics, now: number) => {
      const result = evaluateFraming(current);
      const shown = shownFeedbackRef.current;

      if (shown.issue === result.issue) {
        // Mismo problema: se refresca la calidad, que tiñe la guia en vivo.
        pendingIssueRef.current = null;
        shownFeedbackRef.current = result;
        setFeedback(result);
      } else {
        const pending = pendingIssueRef.current;
        if (!pending || pending.issue !== result.issue) {
          pendingIssueRef.current = { issue: result.issue, since: now };
        } else if (now - pending.since >= ISSUE_HOLD_MS) {
          pendingIssueRef.current = null;
          shownFeedbackRef.current = result;
          setFeedback(result);
        }
      }

      if (result.issue === null) {
        stableSinceRef.current ??= now;
        setStableMs(now - stableSinceRef.current);
      } else {
        stableSinceRef.current = null;
        setStableMs(0);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, videoRef]);

  return { status, feedback, metrics, box, stableMs };
}
