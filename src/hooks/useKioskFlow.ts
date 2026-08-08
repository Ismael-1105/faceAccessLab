'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Student } from '@/src/types';
import { captureFrame } from '@/lib/capture';
import { useFaceFraming, type FaceFraming } from '@/src/hooks/useFaceFraming';
import { playCue, isSoundEnabled, setSoundEnabled } from '@/src/lib/kiosk-sound';
import {
  kioskReducer,
  stageToLegacyFlow,
  INITIAL_STAGE,
  type KioskStage,
  type KioskEvent,
} from '@/src/lib/kiosk-machine';
import { enqueueEvent, flushQueue } from '@/src/lib/kiosk-telemetry';
import {
  DENIAL_REASONS,
  SCAN_STAGES,
  type DenialReason,
  type ScanStageId,
} from '@/src/lib/kiosk-feedback';

/** Flujo legado que la UI actual consume; derivado de la máquina de estados. */
export type FlowState = ReturnType<typeof stageToLegacyFlow>;

export interface KioskFlow {
  // ── Máquina de estados (Fase 7) ──
  stage: KioskStage;
  flowState: FlowState;
  cameraDenied: boolean;
  scannedStudent: Student | null;
  /** URL firmada de la foto del alumno, servida por /api/kiosk/verify (ISS-15). */
  scannedPhotoUrl: string | null;
  confidence: number;
  scanBlocked: boolean;
  statusMessage: string;
  statusHint: string;
  livenessSessionId: string | null;
  /** Región AWS donde se creó la sesión de liveness (ISS-08). */
  livenessRegion: string | null;
  kioskAttemptId: string | null;
  activeStage: ScanStageId;
  scanProgress: number;
  denialReason: DenialReason | null;
  framing: FaceFraming;
  holdProgress: number;
  resetCountdown: number;
  consecutiveDenials: number;
  sessionInfo: { subject: string; teacherName: string | null; startTime: string; endTime: string; status: string } | null;
  cameras: MediaDeviceInfo[];
  showSettings: boolean;
  selectedCamera: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isAllowed: boolean;
  isError: boolean;
  isSuccess: boolean;
  isScanning: boolean;
  showFaceGuide: boolean;
  // ── Mejoras de entorno (Fase 7) ──
  /** Cámara activa y entregando frames. */
  cameraReady: boolean;
  /** Navegador en línea (navigator.onLine). */
  isOnline: boolean;
  /** El backend responde (ping a /api/health). */
  serverReachable: boolean;
  /** Modo pantalla completa. */
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  /** Sonido habilitado (refuerzo del resultado visual). */
  soundEnabled: boolean;
  toggleSound: () => void;
  /** Segundos restantes del intento antes de cancelarse automáticamente. */
  attemptCountdown: number;
  startLiveness: () => void;
  switchCamera: (deviceId: string) => void;
  retryWebcam: () => void;
  toggleSettings: () => void;
  resetScan: () => void;
  toggleScanBlocked: () => void;
  handleLivenessSuccess: () => void;
  handleLivenessFail: (message: string) => void;
  handlePrintReceipt: () => void;
}

const HOLD_MS = 1200;
const PROGRESS_TICK_MS = 100;
const RESET_MS = { granted: 6000, denied: 12000 } as const;
const CAMERA_MAX_ATTEMPTS = 5;
const CAMERA_RETRY_DELAY_MS = 1000;
/**
 * Tiempo máximo de la fase de comparación antes de cancelación automática.
 *
 * ISS-07: NO cubre la prueba de vida. Ese desafío exige cargar
 * FaceLivenessDetectorCore, pedir credenciales a STS, abrir el canal de
 * streaming con AWS y que la persona complete los movimientos; en un equipo
 * lento, con proyector o con la red del campus, eso supera 15 segundos con
 * facilidad, y el intento se cancelaba en mitad del desafío una y otra vez.
 * El reloj arranca al empezar la comparación, que sí debe resolverse rápido.
 */
const ATTEMPT_TIMEOUT_MS = 45000;
/** Solo se muestra el segundero cuando queda poco, para no distraer. */
const ATTEMPT_COUNTDOWN_VISIBLE_S = 10;
const HEALTH_PING_MS = 15000;

function isTransientCameraError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name?: unknown }).name);
    return name === 'NotReadableError' || name === 'AbortError' || name === 'NotFoundError';
  }
  return false;
}

const STAGE_TARGET = Object.fromEntries(
  SCAN_STAGES.map(s => [s.id, s.progress]),
) as Record<ScanStageId, number>;

const IDLE_TEXT = {
  message: 'Colócate frente a la cámara',
  hint: 'La detección está activa y comienza sola',
};

export function useKioskFlow(): KioskFlow {
  const [stage, dispatch] = useReducer(kioskReducer, INITIAL_STAGE);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  // El kiosco no tiene sesion y no puede usar /api/photos: la foto llega ya
  // firmada en la respuesta de verificacion.
  const [scannedPhotoUrl, setScannedPhotoUrl] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [scanBlocked, setScanBlocked] = useState(false);
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null);
  // La declara el servidor, nunca el navegador: ver ISS-08.
  const [livenessRegion, setLivenessRegion] = useState<string | null>(null);
  const [kioskAttemptId, setKioskAttemptId] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<ScanStageId>('capture');
  const [scanProgress, setScanProgress] = useState(0);
  const [denialReason, setDenialReason] = useState<DenialReason | null>(null);
  const [resetCountdown, setResetCountdown] = useState(0);
  const [consecutiveDenials, setConsecutiveDenials] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<KioskFlow['sessionInfo']>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [serverReachable, setServerReachable] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundState] = useState(isSoundEnabled);
  const [attemptCountdown, setAttemptCountdown] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);

  const flowState: FlowState = stageToLegacyFlow(stage);

  const scanningRef = useRef(false);
  const startingRef = useRef(false);
  const stageTargetRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraDeniedRef = useRef(false);
  const selectedCameraRef = useRef('');
  const performScanRef = useRef<(frameArg?: string) => void>(() => {});
  const scanStartRef = useRef(0);
  const attemptStartRef = useRef(0);

  const send = useCallback((event: KioskEvent) => dispatch(event), []);

  const framing = useFaceFraming(
    videoRef,
    flowState === 'framing' && !scanBlocked && !cameraDenied && isOnline,
  );

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startWebcam = useCallback(async (deviceId?: string, attempt = 1): Promise<boolean> => {
    try {
      stopWebcam();
      send({ type: 'CAMERA_STARTING' });
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      };
      if (deviceId) {
        (constraints.video as MediaTrackConstraints).deviceId = { exact: deviceId };
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setCameraDenied(false);
      send({ type: 'CAMERA_READY' });
      return true;
    } catch (err) {
      if (attempt < CAMERA_MAX_ATTEMPTS && isTransientCameraError(err)) {
        await new Promise<void>(resolve => setTimeout(resolve, CAMERA_RETRY_DELAY_MS * attempt));
        return startWebcam(deviceId, attempt + 1);
      }
      if (deviceId) {
        return startWebcam(undefined, CAMERA_MAX_ATTEMPTS);
      }
      enqueueEvent('kiosk.camera_error', { attempt });
      send({ type: 'CAMERA_ERROR' });
      setCameraDenied(true);
      return false;
    }
  }, [send, stopWebcam]);

  const retryWebcam = useCallback(() => {
    setCameraDenied(false);
    return startWebcam(selectedCamera || undefined);
  }, [selectedCamera, startWebcam]);

  const switchCamera = useCallback((deviceId: string) => {
    stopWebcam();
    setSelectedCamera(deviceId);
    startWebcam(deviceId);
    setShowSettings(false);
  }, [stopWebcam, startWebcam]);

  const toggleSettings = useCallback(() => setShowSettings(prev => !prev), []);

  const toggleScanBlocked = useCallback(() => {
    setScanBlocked(prev => {
      const next = !prev;
      // Pausa/reanuda la detección; la máquina vuelve a encuadre o a reposo.
      send(next ? { type: 'RESET' } : { type: 'CAMERA_READY' });
      return next;
    });
  }, [send]);

  const goToStage = useCallback((stageId: ScanStageId) => {
    stageTargetRef.current = STAGE_TARGET[stageId];
    setActiveStage(stageId);
  }, []);

  const finishGranted = useCallback((student: Student, conf: number) => {
    scanningRef.current = false;
    setScannedStudent(student);
    setConfidence(conf);
    setDenialReason(null);
    setScanProgress(1);
    send({ type: 'GRANTED' });
    setResetCountdown(Math.round(RESET_MS.granted / 1000));
    playCue('granted');
  }, [send]);

  const finishDenied = useCallback((reason: DenialReason, conf: number, student: Student | null = null) => {
    scanningRef.current = false;
    setScannedStudent(student);
    setConfidence(conf);
    setDenialReason(reason);
    setScanProgress(1);
    send({ type: 'DENIED' });
    setConsecutiveDenials(prev => {
      const next = prev + 1;
      const base = Math.round(RESET_MS.denied / 1000);
      const penalty = next >= 5 ? 30 : next >= 3 ? 15 : 0;
      setResetCountdown(base + penalty);
      return next;
    });
    playCue('denied');
  }, [send]);

  const startLiveness = useCallback(async () => {
    if (startingRef.current || scanningRef.current) return;
    startingRef.current = true;
    goToStage('liveness');

    try {
      const res = await fetch('/api/kiosk/attempt', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.sessionId && data.attemptId) {
        setKioskAttemptId(data.attemptId);
        setLivenessSessionId(data.sessionId);
        setLivenessRegion(data.region ?? null);
        send({ type: 'LIVENESS_STARTED' });
        playCue('ready');
      } else {
        finishDenied('network-error', 0);
      }
    } catch (err) {
      console.error('[Kiosk] Error creando sesión liveness:', err);
      finishDenied('network-error', 0);
    } finally {
      startingRef.current = false;
    }
  }, [finishDenied, goToStage, send]);

  const handleLivenessSuccess = useCallback(() => {
    setLivenessSessionId(null);
    performScanRef.current();
  }, []);

  const handleLivenessFail = useCallback((message: string) => {
    setLivenessSessionId(null);
    // Antes seguía a la comparación igual que el éxito, descartando el mensaje.
    // El usuario veía la barra completarse y, segundos después, un rechazo
    // genérico sin relación aparente con lo ocurrido. El backend ya denegaba
    // bien (vuelve a consultar el resultado oficial en AWS), así que esto no era
    // un agujero de seguridad, pero sí ocultaba el motivo real y gastaba una
    // llamada de comparación de más.
    console.warn('[Kiosk] Prueba de vida fallida:', message);
    finishDenied('liveness-failed', 0);
  }, [finishDenied]);

  const performScan = useCallback(async (frameArg?: string) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    // ISS-07: el reloj del intento empieza aquí, no en la prueba de vida.
    attemptStartRef.current = Date.now();
    send({ type: 'MATCHING_STARTED' });
    goToStage('capture');
    setScanProgress(0);
    scanStartRef.current = performance.now();

    const video = videoRef.current;
    const frame = frameArg || (video ? captureFrame(video) : null);
    if (!frame) {
      finishDenied('capture-failed', 0);
      return;
    }

    goToStage('compare');

    try {
      if (!kioskAttemptId) {
        finishDenied('network-error', 0);
        return;
      }

      const res = await fetch('/api/kiosk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: kioskAttemptId, imageBase64: frame }),
      });
      const result = await res.json();

      const finalConfidence = result.confidence || 0;
      goToStage('authorize');
      send({ type: 'PERMISSION_STARTED' });
      // ISS-15: el servidor firma la foto del alumno reconocido y la manda en
      // la respuesta. Se fija antes de cerrar el intento para que la pantalla
      // de resultado ya la tenga en su primer render.
      setScannedPhotoUrl(result.studentPhotoUrl ?? null);
      if (!result.ok || !result.allowed || !result.student) {
        finishDenied((result.reason || 'network-error') as DenialReason, finalConfidence, result.student || null);
        return;
      }
      finishGranted(result.student as Student, finalConfidence);
    } catch (err) {
      console.error('[Kiosk] Error en compare:', err);
      finishDenied('network-error', 0);
    }
  }, [kioskAttemptId, finishDenied, finishGranted, goToStage, send]);

  useEffect(() => {
    performScanRef.current = performScan;
  }, [performScan]);

  useEffect(() => {
    cameraDeniedRef.current = cameraDenied;
  }, [cameraDenied]);

  useEffect(() => {
    selectedCameraRef.current = selectedCamera;
  }, [selectedCamera]);

  const resetScan = useCallback(() => {
    scanningRef.current = false;
    startingRef.current = false;
    setScannedStudent(null);
    setScannedPhotoUrl(null);
    setConfidence(0);
    setDenialReason(null);
    setLivenessSessionId(null);
    setLivenessRegion(null);
    setKioskAttemptId(null);
    setScanProgress(0);
    setResetCountdown(0);
    setConsecutiveDenials(0);
    goToStage('capture');
    send({ type: 'RESET' });
    if (!cameraDenied && !scanBlocked) send({ type: 'CAMERA_READY' });
  }, [cameraDenied, goToStage, scanBlocked, send]);

  // Inicialización: sesión del lab, cámaras, webcam, conectividad y pantalla completa.
  useEffect(() => {
    let cancelled = false;

    fetch('/api/kiosk/session')
      .then(r => r.json())
      .then((data: { session: KioskFlow['sessionInfo'] | null }) => {
        if (!cancelled) setSessionInfo(data.session);
      })
      .catch(() => {});

    navigator.mediaDevices?.enumerateDevices?.().then(devices => {
      if (!cancelled) setCameras(devices.filter(d => d.kind === 'videoinput'));
    }).catch(() => {});

    startWebcam();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && cameraDeniedRef.current) {
        startWebcam(selectedCameraRef.current || undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onOffline = () => {
      setIsOnline(false);
      enqueueEvent('kiosk.offline');
    };
    const onOnline = () => {
      setIsOnline(true);
      enqueueEvent('kiosk.online');
      void flushQueue();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);

    return () => {
      cancelled = true;
      stopWebcam();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [startWebcam, stopWebcam]);

  // OFFLINE_CHANGED hacia la máquina + telemetría.
  useEffect(() => {
    dispatch({ type: 'OFFLINE_CHANGED', online: isOnline });
  }, [isOnline]);

  // Ping de salud del backend (conectividad servidor, no solo red).
  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      fetch('/api/health', { method: 'GET' })
        .then(r => { if (!cancelled) setServerReachable(r.ok); })
        .catch(() => { if (!cancelled) setServerReachable(false); });
    };
    ping();
    const id = setInterval(ping, HEALTH_PING_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Tiempo máximo de la comparación: cancelación automática (Fase 7).
  // ISS-07: 'liveness' queda fuera a propósito; ver ATTEMPT_TIMEOUT_MS.
  useEffect(() => {
    if (flowState !== 'scanning') {
      setAttemptCountdown(0);
      return;
    }
    const elapsed = () => Math.max(0, ATTEMPT_TIMEOUT_MS - (Date.now() - attemptStartRef.current)) / 1000;
    // 0 significa "no mostrar": el consumidor solo pinta si es mayor que 0.
    const visible = () => {
      const s = Math.ceil(elapsed());
      return s <= ATTEMPT_COUNTDOWN_VISIBLE_S ? s : 0;
    };
    setAttemptCountdown(visible());
    const id = setInterval(() => {
      setAttemptCountdown(visible());
      if (Date.now() - attemptStartRef.current >= ATTEMPT_TIMEOUT_MS) {
        clearInterval(id);
        scanningRef.current = false;
        startingRef.current = false;
        enqueueEvent('kiosk.attempt_timeout');
        send({ type: 'TIMEOUT' });
        setResetCountdown(5);
        setTimeout(() => resetScan(), 5000);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [flowState, resetScan, send]);

  // Disparo automático: el encuadre debe sostenerse.
  useEffect(() => {
    if (flowState !== 'framing' || scanBlocked) return;
    if (framing.status !== 'ready' || framing.stableMs < HOLD_MS) return;
    send({ type: 'FACE_ALIGNED' });
    startLiveness();
  }, [flowState, scanBlocked, framing.status, framing.stableMs, startLiveness, send]);

  // Avance de la barra de progreso.
  useEffect(() => {
    if (flowState !== 'liveness' && flowState !== 'scanning') return;
    const id = setInterval(() => {
      setScanProgress(prev => {
        const target = stageTargetRef.current;
        if (prev >= target) return prev;
        return prev + (target - prev) * 0.18;
      });
    }, PROGRESS_TICK_MS);
    return () => clearInterval(id);
  }, [flowState]);

  // Reinicio automático tras el desenlace.
  useEffect(() => {
    if (flowState !== 'result') return;
    if (resetCountdown <= 0) {
      resetScan();
      return;
    }
    const id = setTimeout(() => setResetCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [flowState, resetCountdown, resetScan]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundState(prev => {
      setSoundEnabled(!prev);
      return !prev;
    });
  }, []);

  const handlePrintReceipt = useCallback(() => {
    const denial = denialReason ? DENIAL_REASONS[denialReason] : null;
    const text = `
=============================================
    COMPROBANTE DE ENTRADA - FACEACCESS LAB
=============================================
Dispositivo: Terminal Kiosk #042
Ubicacion: Edificio de Computacion
Fecha: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
Resultados:
  - Estudiante: ${scannedStudent?.name ?? 'No identificado'}
  - Carrera: ${scannedStudent?.career ?? 'No aplica'}
  - Coincidencia: ${confidence.toFixed(1)}%
  - Estado: ${denial ? 'ACCESO DENEGADO' : 'ACCESO CONCEDIDO'}${denial ? `
  - Motivo: ${denial.code} ${denial.title}` : ''}
=============================================
`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FaceAccess_Recibo_${scannedStudent?.id ?? 'desconocido'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [confidence, denialReason, scannedStudent]);

  const isSuccess = flowState === 'result' && denialReason === null;
  const isError = flowState === 'result' && denialReason !== null;
  const isScanning = flowState === 'liveness' || flowState === 'scanning';
  const showFaceGuide = flowState === 'idle' || flowState === 'framing';
  const holdProgress = flowState === 'framing' ? Math.min(1, framing.stableMs / HOLD_MS) : 0;
  const cameraReady = cameraActive;

  const guidance = (() => {
    if (!isOnline || !serverReachable) {
      return { message: 'Sin conexión', hint: 'El kiosco reintentará automáticamente' };
    }
    if (scanBlocked) return { message: 'Detección en pausa', hint: 'Pulsa Reanudar para continuar' };
    if (flowState === 'framing') {
      if (framing.status === 'loading') return { message: 'Preparando la detección', hint: 'Un momento' };
      if (framing.status === 'unsupported') {
        return { message: 'Detección automática no disponible', hint: 'Pulsa Iniciar verificación' };
      }
      return { message: framing.feedback.message, hint: framing.feedback.hint };
    }
    if (flowState === 'liveness') return { message: 'Prueba de vida en curso', hint: 'Sigue las indicaciones en pantalla' };
    if (flowState === 'scanning') {
      const s = SCAN_STAGES.find(x => x.id === activeStage);
      return { message: s?.label ?? 'Verificando', hint: s?.desc ?? '' };
    }
    return IDLE_TEXT;
  })();

  return {
    stage,
    flowState,
    cameraDenied,
    scannedStudent,
    scannedPhotoUrl,
    confidence,
    scanBlocked,
    statusMessage: guidance.message,
    statusHint: guidance.hint,
    livenessSessionId,
    livenessRegion,
    kioskAttemptId,
    activeStage,
    scanProgress,
    denialReason,
    framing,
    holdProgress,
    resetCountdown,
    consecutiveDenials,
    sessionInfo,
    cameras,
    showSettings,
    selectedCamera,
    videoRef,
    isAllowed: isSuccess,
    isError,
    isSuccess,
    isScanning,
    showFaceGuide,
    cameraReady,
    isOnline,
    serverReachable,
    isFullscreen,
    toggleFullscreen,
    soundEnabled,
    toggleSound,
    attemptCountdown,
    startLiveness,
    switchCamera,
    retryWebcam,
    toggleSettings,
    resetScan,
    toggleScanBlocked,
    handleLivenessSuccess,
    handleLivenessFail,
    handlePrintReceipt,
  };
}
