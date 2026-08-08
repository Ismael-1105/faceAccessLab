'use client';

import { useEffect, useState } from 'react';
import {
  Check, X, Camera as CameraIcon, Loader2, ScanFace, ZoomIn, ZoomOut, Move, Sun,
  Users, Eye, CircleCheck, Volume2, VolumeX, Timer,
} from 'lucide-react';
import type { FlowState } from '@/src/hooks/useKioskFlow';
import type { NormalizedBox } from '@/src/hooks/useFaceFraming';
import type { DenialReason, FramingIssue } from '@/src/lib/kiosk-feedback';
import { DENIAL_REASONS } from '@/src/lib/kiosk-feedback';
import { isSoundEnabled, setSoundEnabled } from '@/src/lib/kiosk-sound';
import FaceLivenessView from '@/src/components/FaceLivenessView';
import KioskGuideOverlay from '@/src/components/kiosk/KioskGuideOverlay';

/** Un icono por instrucción, para que la orden se entienda sin leer. */
const ISSUE_ICON: Record<string, typeof ScanFace> = {
  'no-face': ScanFace,
  'multiple-faces': Users,
  'too-far': ZoomIn,
  'too-close': ZoomOut,
  'off-center': Move,
  'not-frontal': Eye,
  'low-light': Sun,
  ok: CircleCheck,
};

interface KioskCameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  flowState: FlowState;
  statusMessage: string;
  statusHint: string;
  scanBlocked: boolean;
  livenessSessionId: string | null;
  /** Región en la que el servidor creó la sesión de liveness (ISS-08). */
  livenessRegion: string | null;
  kioskAttemptId: string | null;
  cameras: MediaDeviceInfo[];
  selectedCamera: string;
  showSettings: boolean;
  isScanning: boolean;
  isSuccess: boolean;
  isError: boolean;
  showFaceGuide: boolean;
  framingIssue: FramingIssue | null;
  framingQuality: number;
  framingBox: NormalizedBox | null;
  holdProgress: number;
  scanProgress: number;
  denialReason: DenialReason | null;
  resetCountdown: number;
  startLiveness: () => void;
  toggleSettings: () => void;
  switchCamera: (deviceId: string) => void;
  toggleScanBlocked: () => void;
  resetScan: () => void;
  onLivenessSuccess: () => void;
  onLivenessFail: (message: string) => void;
}

export default function KioskCameraView({
  videoRef,
  flowState,
  statusMessage,
  statusHint,
  scanBlocked,
  livenessSessionId,
  livenessRegion,
  kioskAttemptId,
  cameras,
  selectedCamera,
  showSettings,
  isScanning,
  isSuccess,
  isError,
  showFaceGuide,
  framingIssue,
  framingQuality,
  framingBox,
  holdProgress,
  scanProgress,
  denialReason,
  resetCountdown,
  startLiveness,
  toggleSettings,
  switchCamera,
  toggleScanBlocked,
  resetScan,
  onLivenessSuccess,
  onLivenessFail,
}: KioskCameraViewProps) {
  const cameraLoading = !videoRef.current || videoRef.current.readyState < 2;
  const [soundOn, setSoundOn] = useState(true);
  const denial = denialReason ? DENIAL_REASONS[denialReason] : null;
  const GuideIcon = ISSUE_ICON[framingIssue ?? 'ok'] ?? ScanFace;

  // La preferencia vive en localStorage, que no existe durante el render en servidor.
  useEffect(() => { setSoundOn(isSoundEnabled()); }, []);

  const toggleSound = () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    setSoundOn(next);
  };

  return (
    <section className="md:col-span-7 lg:col-span-8 flex flex-col gap-4 animate-kiosk-fade-in">
      {/* Viewport de cámara */}
      <div
        className={`relative bg-black rounded-[20px] overflow-hidden aspect-[1.7/1.4] shadow-xl shadow-zinc-900/10 dark:shadow-black/40 border-2 transition-colors duration-300 ${
          isSuccess ? 'border-green-500' : isError ? 'border-red-500' : 'border-zinc-200/60 dark:border-zinc-800'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />

        {/* Fondo negro mientras carga */}
        {cameraLoading && flowState !== 'liveness' && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
          </div>
        )}

        {/* Guía biométrica viva: color según encuadre y anillo de espera */}
        {showFaceGuide && (
          <KioskGuideOverlay
            quality={framingQuality}
            valid={framingIssue === null}
            holdProgress={holdProgress}
            box={framingBox}
          />
        )}

        {/* Esquina superior izquierda: en vivo */}
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-black/45 backdrop-blur-md rounded-xl">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-white">En vivo</span>
        </div>

        {/* Esquina superior derecha: sonido, cámara y cerrar */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="w-10 h-10 min-h-11 rounded-xl bg-black/45 backdrop-blur-md flex items-center justify-center text-white/90 hover:bg-black/60 transition-colors"
            aria-label={soundOn ? 'Silenciar avisos sonoros' : 'Activar avisos sonoros'}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
          </button>
          <button
            onClick={toggleSettings}
            className="w-10 h-10 min-h-11 rounded-xl bg-black/45 backdrop-blur-md flex items-center justify-center text-white/90 hover:bg-black/60 transition-colors"
            aria-label="Configuración de cámara"
          >
            <CameraIcon className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={resetScan}
            className="w-10 h-10 min-h-11 rounded-xl bg-black/45 backdrop-blur-md flex items-center justify-center text-white/90 hover:bg-black/60 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Instrucción de encuadre: debajo del óvalo, nunca sobre el rostro */}
        {(flowState === 'idle' || flowState === 'framing') && (
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[min(90%,26rem)] flex items-center gap-3 px-4 py-3 bg-black/65 backdrop-blur-md rounded-2xl animate-kiosk-message"
            role="status"
            aria-live="polite"
          >
            <GuideIcon
              className={`w-6 h-6 shrink-0 ${framingIssue === null ? 'text-green-400' : 'text-amber-300'}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-tight">{statusMessage}</p>
              <p className="text-[11px] text-zinc-300 mt-0.5 leading-tight">{statusHint}</p>
            </div>
          </div>
        )}

        {/* Progreso real del escaneo */}
        {isScanning && (
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-10 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-white">{statusMessage}</p>
              <p className="text-xs font-mono text-zinc-300">{Math.round(scanProgress * 100)}%</p>
            </div>
            <div
              className="h-2 w-full rounded-full bg-white/20 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(scanProgress * 100)}
              aria-label="Avance de la verificación"
            >
              <div
                className="h-full bg-accent-400 rounded-full transition-[width] duration-200 ease-out"
                style={{ width: `${Math.round(scanProgress * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-300 mt-1.5">{statusHint}</p>
          </div>
        )}

        {/* Menú de cámara */}
        {showSettings && (
          <div className="absolute top-14 right-4 w-60 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-3 z-20 animate-kiosk-scale-in">
            <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-2 py-1">Cámara</p>
            <div className="space-y-1 max-h-44 overflow-auto">
              {cameras.length === 0 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 px-2 py-2">Sin cámaras detectadas</p>
              )}
              {cameras.map((cam, i) => (
                <button
                  key={cam.deviceId || i}
                  onClick={() => switchCamera(cam.deviceId)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                    selectedCamera === cam.deviceId || (!selectedCamera && i === 0)
                      ? 'bg-accent-50 dark:bg-accent-950/30 text-accent-700 dark:text-accent-300'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <CameraIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{cam.label || `Cámara ${i + 1}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Desenlace: veredicto legible a distancia, con la causa real */}
        {flowState === 'result' && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center animate-kiosk-scale-in backdrop-blur-sm ${
              isSuccess ? 'bg-green-950/70' : 'bg-red-950/70'
            }`}
            role="status"
            aria-live="assertive"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isSuccess ? 'bg-green-600' : 'bg-red-600'}`}>
              {isSuccess
                ? <Check className="w-9 h-9 text-white" strokeWidth={2.5} />
                : <X className="w-9 h-9 text-white" strokeWidth={2.5} />}
            </div>
            <p className="text-2xl font-black text-white uppercase tracking-wide">
              {isSuccess ? 'Acceso concedido' : 'Acceso denegado'}
            </p>
            {denial && (
              <p className="text-base font-semibold text-white/90">
                <span className="font-mono mr-2">{denial.code}</span>
                {denial.title}
              </p>
            )}
            <p className="text-sm text-white/80 max-w-md leading-relaxed">
              {denial ? denial.action : 'Puedes ingresar al laboratorio'}
            </p>
            {resetCountdown > 0 && (
              <p className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-white/60 mt-1">
                <Timer className="w-3.5 h-3.5" aria-hidden="true" />
                Reinicia en {resetCountdown} s
              </p>
            )}
          </div>
        )}

        {/* Overlay Face Liveness */}
        {flowState === 'liveness' && livenessSessionId && kioskAttemptId && (
          <div className="absolute inset-0 animate-kiosk-fade-in">
            <FaceLivenessView
              attemptId={kioskAttemptId}
              sessionId={livenessSessionId}
              region={livenessRegion}
              onSuccess={onLivenessSuccess}
              onFail={onLivenessFail}
            />
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="flex items-center gap-3">
        {(flowState === 'idle' || flowState === 'framing') && !scanBlocked && (
          <button
            onClick={startLiveness}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 min-h-14 bg-accent-600 hover:bg-accent-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98] shadow-lg shadow-accent-600/20"
          >
            <ScanFace className="w-5 h-5" />
            Iniciar verificación
          </button>
        )}
        {(flowState === 'idle' || flowState === 'framing') && (
          <button
            onClick={toggleScanBlocked}
            className={`px-6 py-4 min-h-14 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] ${
              scanBlocked
                ? 'bg-accent-600 text-white'
                : 'bg-white dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {scanBlocked ? 'Reanudar' : 'Pausar'}
          </button>
        )}
        {isScanning && (
          <button
            onClick={resetScan}
            className="px-6 py-4 min-h-14 bg-white dark:bg-zinc-800/70 hover:bg-red-50 dark:hover:bg-red-950/30 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] border border-zinc-200 dark:border-zinc-700"
          >
            Cancelar
          </button>
        )}
        {flowState === 'result' && (
          <button
            onClick={resetScan}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 min-h-14 bg-accent-600 hover:bg-accent-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98] shadow-lg shadow-accent-600/20"
          >
            <ScanFace className="w-5 h-5" />
            {isSuccess ? 'Nuevo escaneo' : denial?.retryable ? 'Reintentar ahora' : 'Continuar'}
          </button>
        )}
      </div>
    </section>
  );
}
