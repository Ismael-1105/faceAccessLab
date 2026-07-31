'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Student, AccessLog } from '@/src/types';
import { captureFrame } from '@/lib/capture';

export type FlowState = 'idle' | 'detecting' | 'liveness' | 'scanning' | 'result';

export interface KioskFlow {
  students: Student[];
  cameraDenied: boolean;
  flowState: FlowState;
  scannedStudent: Student | null;
  confidence: number;
  scanBlocked: boolean;
  statusMessage: string;
  livenessSessionId: string | null;
  scanStage: number;
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
  handleLivenessSuccess: (confidence: number) => void;
  handleLivenessFail: (message: string) => void;
  handlePrintReceipt: () => void;
}

export function useKioskFlow(): KioskFlow {
  const [students, setStudents] = useState<Student[]>([]);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [scanBlocked, setScanBlocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Centra tu rostro frente a la cámara');
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null);
  const [scanStage, setScanStage] = useState(0);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState('');

  const scanningRef = useRef(false);
  const flowStateRef = useRef<FlowState>('idle');
  const detectLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const performScanRef = useRef<(frameArg?: string) => void>(() => {});

  const setFlow = useCallback((s: FlowState) => {
    flowStateRef.current = s;
    setFlowState(s);
  }, []);

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
      return true;
    } catch (err) {
      console.error('[Kiosk] Error cámara:', err);
      setCameraDenied(true);
      return false;
    }
  }, []);

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
    setScanBlocked(prev => !prev);
  }, []);

  const saveAccessLog = useCallback((student: Student, conf: number) => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const isAllowed = student.status === 'allowed';
    const log: AccessLog = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      studentId: student.id,
      studentName: student.name,
      avatarInitials: student.avatarInitials,
      date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
      result: isAllowed ? 'Permitido' : 'Denegado',
      similarity: parseFloat(conf.toFixed(1)),
    };
    fetch('/api/kiosk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    }).catch(err => console.error('[Kiosk] Error guardando AccessLog:', err));
  }, []);

  const startLiveness = useCallback(async () => {
    try {
      const res = await fetch('/api/rekognition/liveness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init: true }),
      });
      const data = await res.json();
      if (data.ok && data.sessionId) {
        setLivenessSessionId(data.sessionId);
        setFlow('liveness');
        setStatusMessage('Verificación anti-suplantación');
      } else {
        console.error('[Kiosk] Error creando sesión liveness:', data.error);
        setStatusMessage('Error iniciando verificación');
      }
    } catch (err) {
      console.error('[Kiosk] Error creando sesión liveness:', err);
      setStatusMessage('Error de conexión');
    }
  }, [setFlow]);

  const handleLivenessSuccess = useCallback((conf: number) => {
    setLivenessSessionId(null);
    console.log('[Kiosk] Liveness superado con confianza:', conf);
    performScanRef.current();
  }, []);

  const handleLivenessFail = useCallback((message: string) => {
    setLivenessSessionId(null);
    setStatusMessage(message || 'Verificación anti-suplantación fallida');
    setFlow('idle');
    setTimeout(() => setStatusMessage('Centra tu rostro frente a la cámara'), 3000);
  }, [setFlow]);

  const performScan = useCallback(async (frameArg?: string) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setFlow('scanning');
    setScanStage(0);

    const video = videoRef.current;
    const frame = frameArg || (video ? captureFrame(video, { quality: 0.9 }) : null);
    if (!frame) {
      setStatusMessage('No se detectó rostro. Acércate a la cámara.');
      setFlow('detecting');
      scanningRef.current = false;
      setTimeout(() => setStatusMessage('Centra tu rostro frente a la cámara'), 2500);
      return;
    }

    setScanStage(1);
    setStatusMessage('Verificando identidad...');

    try {
      const res = await fetch('/api/rekognition/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: frame }),
      });
      const result = await res.json();
      console.log('[Kiosk] Compare:', result.match ? 'match' : 'no-match', 'confidence=', result.confidence, 'studentId=', result.studentId);

      setScanStage(2);
      const finalConfidence = result.confidence || 0;
      const candidate = result.ok && result.match && result.studentId
        ? students.find(s => s.id === result.studentId)
        : undefined;

      if (candidate) {
        const threshold = candidate.matchPercentage > 0 ? candidate.matchPercentage : 85;

        if (finalConfidence >= threshold) {
          setScanStage(3);
          const access = candidate.status === 'allowed';
          setScannedStudent(candidate);
          setConfidence(finalConfidence);
          setFlow('result');
          scanningRef.current = false;
          saveAccessLog(candidate, finalConfidence);
          console.log(`[Kiosk] ${access ? 'ACCESO CONCEDIDO' : 'ACCESO DENEGADO'} — ${candidate.name} (${finalConfidence}%)`);
          return;
        }
      }

      const unknown: Student = {
        id: 'unknown',
        name: 'Persona Desconocida',
        career: 'No Registrado',
        lab: 'Acceso Denegado',
        photoUrl: '/images/students/persona-desconocida.jpg',
        matchPercentage: 22.8,
        status: 'denied',
        avatarInitials: '?',
      };
      setScannedStudent(unknown);
      setConfidence(finalConfidence >= 60 ? finalConfidence : 22.8);
      setFlow('result');
      scanningRef.current = false;
      saveAccessLog(unknown, finalConfidence >= 60 ? finalConfidence : 22.8);
      console.log('[Kiosk] ACCESO DENEGADO — rostro no reconocido');
    } catch (err) {
      console.error('[Kiosk] Error en compare:', err);
      setStatusMessage('Error de conexión. Reintentando...');
      setFlow('detecting');
      scanningRef.current = false;
      setTimeout(() => setStatusMessage('Centra tu rostro frente a la cámara'), 3000);
    }
  }, [students, saveAccessLog, setFlow]);

  useEffect(() => {
    performScanRef.current = performScan;
  }, [performScan]);

  const detectPresence = useCallback(async () => {
    if (scanningRef.current || flowStateRef.current !== 'idle' || scanBlocked) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    console.log('[Kiosk] Presencia detectada — iniciando Face Liveness oficial');
    setStatusMessage('Rostro detectado. Verificando...');
    startLiveness();
  }, [scanBlocked, startLiveness]);

  const resetScan = useCallback(() => {
    scanningRef.current = false;
    setFlow('idle');
    setScannedStudent(null);
    setConfidence(0);
    setScanBlocked(false);
    setStatusMessage('Centra tu rostro frente a la cámara');
    setLivenessSessionId(null);
    setScanStage(0);
  }, [setFlow]);

  // Inicialización: estudiantes, cámaras y webcam
  useEffect(() => {
    let cancelled = false;

    fetch('/api/kiosk')
      .then(r => r.json())
      .then((data: Student[]) => {
        if (!cancelled) setStudents(data);
      })
      .catch(err => console.error('[Kiosk] Error cargando estudiantes:', err));

    navigator.mediaDevices?.enumerateDevices?.().then(devices => {
      if (!cancelled) setCameras(devices.filter(d => d.kind === 'videoinput'));
    }).catch(() => {});

    startWebcam();

    return () => {
      cancelled = true;
      stopWebcam();
      if (detectLoopRef.current) clearTimeout(detectLoopRef.current);
    };
  }, [startWebcam, stopWebcam]);

  // Loop de detección de presencia
  useEffect(() => {
    if (flowState !== 'idle' || scanBlocked) return;

    detectPresence();
    detectLoopRef.current = setTimeout(function tick() {
      detectPresence();
      detectLoopRef.current = setTimeout(tick, 600);
    }, 600);

    return () => {
      if (detectLoopRef.current) clearTimeout(detectLoopRef.current);
    };
  }, [flowState, scanBlocked, detectPresence]);

  const handlePrintReceipt = useCallback(() => {
    if (!scannedStudent) return;
    const isAllowed = scannedStudent.status === 'allowed';
    const text = `
=============================================
    COMPROBANTE DE ENTRADA - FACEACCESS LAB
=============================================
Dispositivo: Terminal Kiosk #042
Ubicacion: Edificio de Computacion
Fecha: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
Resultados:
  - Estudiante: ${scannedStudent.name}
  - Carrera: ${scannedStudent.career}
  - Coincidencia: ${isAllowed ? confidence : '22.8'}%
  - Estado: ${isAllowed ? 'ACCESO CONCEDIDO' : 'ACCESO DENEGADO'}
=============================================
`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FaceAccess_Recibo_${scannedStudent.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [scannedStudent, confidence]);

  const isAllowed = scannedStudent?.status === 'allowed';
  const isError = flowState === 'result' && !isAllowed;
  const isSuccess = flowState === 'result' && isAllowed;
  const isScanning = flowState === 'scanning' || flowState === 'liveness';
  const showFaceGuide = flowState === 'idle' || flowState === 'detecting' || flowState === 'scanning';

  return {
    students,
    cameraDenied,
    flowState,
    scannedStudent,
    confidence,
    scanBlocked,
    statusMessage,
    livenessSessionId,
    scanStage,
    cameras,
    showSettings,
    selectedCamera,
    videoRef,
    isAllowed,
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
