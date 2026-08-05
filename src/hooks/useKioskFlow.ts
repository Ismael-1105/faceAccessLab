'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Student } from '@/src/types';
import { captureFrame } from '@/lib/capture';
import { useFaceFraming, type FaceFraming } from '@/src/hooks/useFaceFraming';
import { playCue } from '@/src/lib/kiosk-sound';
import {
  DENIAL_REASONS,
  SCAN_STAGES,
  type DenialReason,
  type ScanStageId,
} from '@/src/lib/kiosk-feedback';

export type FlowState = 'idle' | 'framing' | 'liveness' | 'scanning' | 'result';

export interface KioskFlow {
  cameraDenied: boolean;
  flowState: FlowState;
  scannedStudent: Student | null;
  confidence: number;
  scanBlocked: boolean;
  statusMessage: string;
  statusHint: string;
  livenessSessionId: string | null;
  kioskAttemptId: string | null;
  /** Etapa real en curso dentro del escaneo. */
  activeStage: ScanStageId;
  /** Avance del escaneo, de 0 a 1. */
  scanProgress: number;
  /** Causa exacta del rechazo, o null si hubo acceso. */
  denialReason: DenialReason | null;
  /** Encuadre en vivo: instrucciones de acercarse, alejarse o centrarse. */
  framing: FaceFraming;
  /** Avance del tiempo de encuadre estable exigido antes de verificar, de 0 a 1. */
  holdProgress: number;
  /** Segundos que faltan para volver solo a la pantalla de espera. */
  resetCountdown: number;
  /** Intentos fallidos consecutivos; ≥5 aplica un bloqueo temporal extendido. */
  consecutiveDenials: number;
  /** Clase vigente del laboratorio del kiosco (se muestra antes del acceso). */
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
  startLiveness: () => void;
  switchCamera: (deviceId: string) => void;
  toggleSettings: () => void;
  resetScan: () => void;
  toggleScanBlocked: () => void;
  handleLivenessSuccess: () => void;
  handleLivenessFail: (message: string) => void;
  handlePrintReceipt: () => void;
}

/** Encuadre válido sostenido que se exige antes de iniciar la verificación. */
const HOLD_MS = 1200;
/** Cadencia con la que avanza la barra de progreso. */
const PROGRESS_TICK_MS = 100;
/** Espera antes del reinicio automático, según el desenlace. */
const RESET_MS = { granted: 6000, denied: 12000 } as const;

const STAGE_TARGET = Object.fromEntries(
  SCAN_STAGES.map(s => [s.id, s.progress]),
) as Record<ScanStageId, number>;

const IDLE_TEXT = {
  message: 'Colócate frente a la cámara',
  hint: 'La detección está activa y comienza sola',
};

export function useKioskFlow(): KioskFlow {
  const [cameraDenied, setCameraDenied] = useState(false);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [scanBlocked, setScanBlocked] = useState(false);
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null);
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

  const scanningRef = useRef(false);
  const startingRef = useRef(false);
  const flowStateRef = useRef<FlowState>('idle');
  const stageTargetRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const performScanRef = useRef<(frameArg?: string) => void>(() => {});
  /** Instante de inicio del escaneo para medir la latencia del reconocimiento. */
  const scanStartRef = useRef(0);

  const setFlow = useCallback((s: FlowState) => {
    flowStateRef.current = s;
    setFlowState(s);
  }, []);

  // El detector solo consume CPU mientras se busca el encuadre.
  const framing = useFaceFraming(videoRef, flowState === 'framing' && !scanBlocked && !cameraDenied);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startWebcam = useCallback(async (deviceId?: string) => {
    try {
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
      setCameraDenied(false);
      if (flowStateRef.current === 'idle') setFlow('framing');
      return true;
    } catch (err) {
      console.error('[Kiosk] Error cámara:', err);
      setCameraDenied(true);
      return false;
    }
  }, [setFlow]);

  const switchCamera = useCallback((deviceId: string) => {
    stopWebcam();
    setSelectedCamera(deviceId);
    startWebcam(deviceId);
    setShowSettings(false);
  }, [stopWebcam, startWebcam]);

  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const toggleScanBlocked = useCallback(() => {
    setScanBlocked(prev => {
      const next = !prev;
      setFlow(next ? 'idle' : 'framing');
      return next;
    });
  }, [setFlow]);

  /** Fija la etapa en curso y hacia dónde debe avanzar la barra. */
  const goToStage = useCallback((stage: ScanStageId) => {
    stageTargetRef.current = STAGE_TARGET[stage];
    setActiveStage(stage);
  }, []);

  /** Renderiza un acceso concedido que ya fue decidido y persistido por el backend. */
  const finishGranted = useCallback((student: Student, conf: number) => {
    scanningRef.current = false;
    setScannedStudent(student);
    setConfidence(conf);
    setDenialReason(null);
    setScanProgress(1);
    setFlow('result');
    setResetCountdown(Math.round(RESET_MS.granted / 1000));
    playCue('granted');
    console.log(`[Kiosk] ACCESO CONCEDIDO: ${student.name} (${conf.toFixed(1)}%)`);
  }, [setFlow]);

  /** Cierra el ciclo con acceso denegado, guardando la causa real. */
  const finishDenied = useCallback((reason: DenialReason, conf: number, student: Student | null = null) => {
    scanningRef.current = false;
    setScannedStudent(student);
    setConfidence(conf);
    setDenialReason(reason);
    setScanProgress(1);
    setFlow('result');
    // Bloqueo temporal: 3 fallos consecutivos de liveness/red = 15s; 5+ = 30s (comportamiento sospechoso).
    setConsecutiveDenials(prev => {
      const next = prev + 1;
      const base = Math.round(RESET_MS.denied / 1000);
      const penalty = next >= 5 ? 30 : next >= 3 ? 15 : 0;
      setResetCountdown(base + penalty);
      return next;
    });
    playCue('denied');
    console.log(`[Kiosk] ACCESO DENEGADO: ${DENIAL_REASONS[reason].code} ${DENIAL_REASONS[reason].title}`);
  }, [setFlow]);

  const startLiveness = useCallback(async () => {
    if (startingRef.current || scanningRef.current) return;
    startingRef.current = true;
    goToStage('liveness');

    try {
      const res = await fetch('/api/kiosk/attempt', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok && data.sessionId && data.attemptId) {
        setKioskAttemptId(data.attemptId);
        setLivenessSessionId(data.sessionId);
        setFlow('liveness');
        playCue('ready');
      } else {
        console.error('[Kiosk] Error creando sesión liveness:', data.error);
        finishDenied('network-error', 0);
      }
    } catch (err) {
      console.error('[Kiosk] Error creando sesión liveness:', err);
      finishDenied('network-error', 0);
    } finally {
      startingRef.current = false;
    }
  }, [finishDenied, goToStage, setFlow]);

  const handleLivenessSuccess = useCallback(() => {
    setLivenessSessionId(null);
    console.log('[Kiosk] Desafío liveness completado; el backend validará el resultado.');
    performScanRef.current();
  }, []);

  const handleLivenessFail = useCallback((message: string) => {
    setLivenessSessionId(null);
    console.warn('[Kiosk] Liveness no superado:', message);
    // El navegador no decide la denegación. El backend consulta el resultado
    // oficial de la sesión AWS, persiste AccessLog/evidencia/incidente y devuelve
    // la causa autoritativa que debe mostrarse.
    performScanRef.current();
  }, []);

  const performScan = useCallback(async (frameArg?: string) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setFlow('scanning');
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
      console.log('[Kiosk] Resultado autoritativo:', result.allowed ? 'allowed' : 'denied', result.reason);

      const finalConfidence = result.confidence || 0;
      goToStage('authorize');
      if (!result.ok || !result.allowed || !result.student) {
        finishDenied((result.reason || 'network-error') as DenialReason, finalConfidence, result.student || null);
        return;
      }
      finishGranted(result.student as Student, finalConfidence);
    } catch (err) {
      console.error('[Kiosk] Error en compare:', err);
      finishDenied('network-error', 0);
    }
  }, [kioskAttemptId, finishDenied, finishGranted, goToStage, setFlow]);

  useEffect(() => {
    performScanRef.current = performScan;
  }, [performScan]);

  const resetScan = useCallback(() => {
    scanningRef.current = false;
    startingRef.current = false;
    setScannedStudent(null);
    setConfidence(0);
    setDenialReason(null);
    setLivenessSessionId(null);
    setKioskAttemptId(null);
    setScanProgress(0);
    setResetCountdown(0);
    setConsecutiveDenials(0);
    goToStage('capture');
    setFlow(cameraDenied || scanBlocked ? 'idle' : 'framing');
  }, [cameraDenied, goToStage, scanBlocked, setFlow]);

  // Inicialización: sesión vigente del laboratorio, cámaras y webcam.
  useEffect(() => {
    let cancelled = false;

    // Sesión vigente del laboratorio (Funcionalidad 7): se muestra antes del acceso.
    // La ubicación del kiosco se resuelve exclusivamente en el servidor.
    fetch('/api/kiosk/session')
      .then(r => r.json())
      .then((data: { session: KioskFlow['sessionInfo'] | null }) => {
        if (!cancelled) setSessionInfo(data.session);
      })
      .catch(err => console.error('[Kiosk] Error cargando sesión:', err));

    navigator.mediaDevices?.enumerateDevices?.().then(devices => {
      if (!cancelled) setCameras(devices.filter(d => d.kind === 'videoinput'));
    }).catch(() => {});

    startWebcam();

    return () => {
      cancelled = true;
      stopWebcam();
    };
  }, [startWebcam, stopWebcam]);

  // Disparo automático: el encuadre debe sostenerse, no basta un cuadro suelto.
  useEffect(() => {
    if (flowState !== 'framing' || scanBlocked) return;
    if (framing.status !== 'ready' || framing.stableMs < HOLD_MS) return;
    startLiveness();
  }, [flowState, scanBlocked, framing.status, framing.stableMs, startLiveness]);

  // Avance de la barra: se acerca a la meta de la etapa sin superarla, porque
  // el tiempo de respuesta de Rekognition no se conoce de antemano.
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

  // Reinicio automático del kiosco tras mostrar el desenlace.
  useEffect(() => {
    if (flowState !== 'result') return;
    if (resetCountdown <= 0) {
      resetScan();
      return;
    }
    const id = setTimeout(() => setResetCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [flowState, resetCountdown, resetScan]);

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
  const isScanning = flowState === 'scanning' || flowState === 'liveness';
  const showFaceGuide = flowState === 'idle' || flowState === 'framing';
  const holdProgress = flowState === 'framing' ? Math.min(1, framing.stableMs / HOLD_MS) : 0;

  const guidance = (() => {
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
      const stage = SCAN_STAGES.find(s => s.id === activeStage);
      return { message: stage?.label ?? 'Verificando', hint: stage?.desc ?? '' };
    }
    return IDLE_TEXT;
  })();

  return {
    cameraDenied,
    flowState,
    scannedStudent,
    confidence,
    scanBlocked,
    statusMessage: guidance.message,
    statusHint: guidance.hint,
    livenessSessionId,
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
    startLiveness,
    switchCamera,
    toggleSettings,
    resetScan,
    toggleScanBlocked,
    handleLivenessSuccess,
    handleLivenessFail,
    handlePrintReceipt,
  };
}
